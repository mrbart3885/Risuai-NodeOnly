import { v4 } from "uuid";
import { getImageType } from "src/ts/media";
import { getDatabase } from "../../storage/database.svelte";
import { getModelInfo, LLMFlags, LLMFormat } from "src/ts/model/modellist";
import { asBuffer } from "../../util";
import { NodeStorage } from "../../storage/nodeStorage";
import {
    type InlayAssetMeta,
    buildInlayMeta,
    getInlayMeta,
    getInlayMetasBatch,
    removeInlayMeta,
    setInlayMeta,
} from "./inlayMeta";

export type InlayAsset = {
    data: string | Blob
    /** File extension */
    ext: string
    height?: number
    name: string
    type: 'image' | 'video' | 'audio' | 'signature'
    width?: number
}

/** Serialized form for server storage (Blob → base64 string) */
type SerializedInlayAsset = {
    data: string
    ext: string
    height?: number
    name: string
    type: 'image' | 'video' | 'audio' | 'signature'
    width?: number
}

export type InlayThumbnail = {
    data: string
    ext: string
    height?: number
    name: string
    type: 'image'
    width?: number
}

export type InlayExplorerInfo = {
    ext: string
    height?: number
    name: string
    type: InlayAsset['type']
    width?: number
}

export type InlayExplorerItem = {
    ext: string
    hasMeta: boolean
    hasThumb: boolean
    height?: number
    id: string
    meta: InlayAssetMeta | null
    name: string
    thumb: InlayThumbnail | null
    type: InlayAsset['type'] | 'unknown'
    width?: number
}

export type CharacterChatIndexItem = {
    chaId: string
    chats: {
        id: string
        name: string
    }[]
    name: string
}

const inlayImageExts = [
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'
]

const inlayAudioExts = [
    'wav', 'mp3', 'ogg', 'flac'
]

const inlayVideoExts = [
    'webm', 'mp4', 'mkv'
]

const INLAY_PREFIX = 'inlay/'
const INLAY_INFO_PREFIX = 'inlay_info/'
const INLAY_THUMB_PREFIX = 'inlay_thumb/'

// ── Memory LRU cache ──
type LRUEntry = {
    asset: InlayAsset
    lastAccessed: number
    size: number
}
const inlayLRUCache = new Map<string, LRUEntry>()
const MAX_CACHE_SIZE = 500 * 1024 * 1024 // 500 MB
let totalLRUSize = 0

function lruGet(id: string): InlayAsset | null {
    const entry = inlayLRUCache.get(id)
    if (!entry) return null
    entry.lastAccessed = Date.now()
    return entry.asset
}

function lruSet(id: string, asset: InlayAsset): void {
    const size = asset.data instanceof Blob ? asset.data.size : (asset.data as string).length
    const existing = inlayLRUCache.get(id)
    if (existing) totalLRUSize -= existing.size
    inlayLRUCache.set(id, { asset, lastAccessed: Date.now(), size })
    totalLRUSize += size
    // evict oldest entries if over limit
    if (totalLRUSize > MAX_CACHE_SIZE) {
        const sorted = [...inlayLRUCache.entries()].sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)
        for (const [key, entry] of sorted) {
            if (totalLRUSize <= MAX_CACHE_SIZE) break
            inlayLRUCache.delete(key)
            totalLRUSize -= entry.size
        }
    }
}

function lruDelete(id: string): void {
    const entry = inlayLRUCache.get(id)
    if (entry) {
        totalLRUSize -= entry.size
        inlayLRUCache.delete(id)
    }
}

/** @internal Reset module-level state for unit tests only */
export function __resetInlayStorageForTest(): void {
    inlayLRUCache.clear()
    totalLRUSize = 0
    _nodeInlayStorage = null
    _nodeInlayInfoStorage = null
    _nodeInlayThumbStorage = null
}

// ── NodeInlayStorage ──

class NodeInlayStorage {
    private nodeStorage = new NodeStorage()

    private serverKey(id: string): string {
        return `${INLAY_PREFIX}${id}`
    }

    private async serializeAsset(asset: InlayAsset): Promise<Uint8Array> {
        let dataStr: string
        if (asset.data instanceof Blob) {
            dataStr = await blobToBase64(asset.data)
        } else {
            dataStr = asset.data as string
        }
        const serialized: SerializedInlayAsset = {
            data: dataStr,
            ext: asset.ext,
            height: asset.height,
            name: asset.name,
            type: asset.type,
            width: asset.width,
        }
        return new TextEncoder().encode(JSON.stringify(serialized))
    }

    private deserializeAsset(buf: Buffer): InlayAsset {
        const json: SerializedInlayAsset = JSON.parse(new TextDecoder().decode(buf))
        let data: string | Blob
        if (json.type !== 'signature' && json.data.startsWith('data:')) {
            data = base64ToBlob(json.data)
        } else {
            data = json.data
        }
        return {
            data,
            ext: json.ext,
            height: json.height,
            name: json.name,
            type: json.type,
            width: json.width,
        }
    }

    async setItem(id: string, asset: InlayAsset): Promise<void> {
        const bytes = await this.serializeAsset(asset)
        await this.nodeStorage.setItem(this.serverKey(id), bytes)
        lruSet(id, toCoreInlayAsset(asset))
    }

    async getItem<T>(id: string): Promise<T | null> {
        // 1. Try memory LRU cache
        const cached = lruGet(id)
        if (cached) return cached as unknown as T

        // 2. Fetch from server
        try {
            const buf = await this.nodeStorage.getItem(this.serverKey(id))
            if (!buf || buf.length === 0) return null
            const asset = this.deserializeAsset(buf)
            lruSet(id, toCoreInlayAsset(asset))
            return asset as unknown as T
        } catch {
            return null
        }
    }

    async removeItem(id: string): Promise<void> {
        try {
            await this.nodeStorage.removeItem(this.serverKey(id))
            lruDelete(id)
        } catch {
            // ignore if not found
        }
    }

    async keys(): Promise<string[]> {
        const allKeys = await this.nodeStorage.keys(INLAY_PREFIX)
        return allKeys.map(k => k.replace(INLAY_PREFIX, ''))
    }

    async iterate<T, U>(callback: (value: T, key: string, iterationNumber: number) => U): Promise<U> {
        const allKeys = await this.nodeStorage.keys(INLAY_PREFIX)
        let result: U
        let i = 0
        for (const decodedKey of allKeys) {
            const id = decodedKey.replace(INLAY_PREFIX, '')
            try {
                const buf = await this.nodeStorage.getItem(decodedKey)
                if (buf && buf.length > 0) {
                    const asset = this.deserializeAsset(buf)
                    result = callback(asset as unknown as T, id, i)
                    i++
                }
            } catch {
                // skip corrupt entries
            }
        }
        return result
    }
}

// ── NodeInlayThumbStorage ──

class NodeInlayThumbStorage {
    private nodeStorage = new NodeStorage()

    private serverKey(id: string): string {
        return `${INLAY_THUMB_PREFIX}${id}`
    }

    async setItem(id: string, thumb: InlayThumbnail): Promise<void> {
        const bytes = new TextEncoder().encode(JSON.stringify(thumb))
        await this.nodeStorage.setItem(this.serverKey(id), bytes)
    }

    async getItem<T>(id: string): Promise<T | null> {
        try {
            const buf = await this.nodeStorage.getItem(this.serverKey(id))
            if (!buf || buf.length === 0) return null
            return JSON.parse(new TextDecoder().decode(buf)) as T
        } catch {
            return null
        }
    }

    async removeItem(id: string): Promise<void> {
        try {
            await this.nodeStorage.removeItem(this.serverKey(id))
        } catch {
            // ignore if not found
        }
    }

    async getItems<T>(ids: string[]): Promise<Record<string, T>> {
        const result: Record<string, T> = {}
        if (!Array.isArray(ids) || ids.length === 0) return result
        try {
            const rows = await this.nodeStorage.getItems(ids.map((id) => this.serverKey(id)))
            for (const row of rows) {
                try {
                    const id = row.key.replace(INLAY_THUMB_PREFIX, '')
                    result[id] = JSON.parse(new TextDecoder().decode(row.value)) as T
                } catch {
                    // skip corrupt thumb entries
                }
            }
        } catch {
            // best-effort batch read
        }
        return result
    }

    /** Return set of IDs that have thumbnails, without downloading thumb data */
    async existingIds(): Promise<Set<string>> {
        const allKeys = await this.nodeStorage.keys(INLAY_THUMB_PREFIX)
        return new Set(allKeys.map(k => k.replace(INLAY_THUMB_PREFIX, '')))
    }
}

// ── NodeInlayInfoStorage ──

class NodeInlayInfoStorage {
    private nodeStorage = new NodeStorage()

    private serverKey(id: string): string {
        return `${INLAY_INFO_PREFIX}${id}`
    }

    async setItem(id: string, info: InlayExplorerInfo): Promise<void> {
        const bytes = new TextEncoder().encode(JSON.stringify(info))
        await this.nodeStorage.setItem(this.serverKey(id), bytes)
    }

    async getItem<T>(id: string): Promise<T | null> {
        try {
            const buf = await this.nodeStorage.getItem(this.serverKey(id))
            if (!buf || buf.length === 0) return null
            return JSON.parse(new TextDecoder().decode(buf)) as T
        } catch {
            return null
        }
    }

    async getItems<T>(ids: string[]): Promise<Record<string, T>> {
        const result: Record<string, T> = {}
        if (!Array.isArray(ids) || ids.length === 0) return result
        try {
            const rows = await this.nodeStorage.getItems(ids.map((id) => this.serverKey(id)))
            for (const row of rows) {
                try {
                    const id = row.key.replace(INLAY_INFO_PREFIX, '')
                    result[id] = JSON.parse(new TextDecoder().decode(row.value)) as T
                } catch {
                    // skip corrupt explorer info entries
                }
            }
        } catch {
            // best-effort batch read
        }
        return result
    }

    async removeItem(id: string): Promise<void> {
        try {
            await this.nodeStorage.removeItem(this.serverKey(id))
        } catch {
            // ignore if not found
        }
    }
}

function toCoreInlayAsset(asset: any): InlayAsset {
    return {
        data: asset.data,
        ext: asset.ext,
        height: asset.height,
        name: asset.name,
        type: asset.type,
        width: asset.width,
    }
}

// ── Storage instance singletons ──

let _nodeInlayStorage: NodeInlayStorage | null = null
let _nodeInlayInfoStorage: NodeInlayInfoStorage | null = null
let _nodeInlayThumbStorage: NodeInlayThumbStorage | null = null

function getInlayStorage(): NodeInlayStorage {
    if (!_nodeInlayStorage) _nodeInlayStorage = new NodeInlayStorage()
    return _nodeInlayStorage
}

function getInlayInfoStorage(): NodeInlayInfoStorage {
    if (!_nodeInlayInfoStorage) _nodeInlayInfoStorage = new NodeInlayInfoStorage()
    return _nodeInlayInfoStorage
}

function getInlayThumbStorage(): NodeInlayThumbStorage {
    if (!_nodeInlayThumbStorage) _nodeInlayThumbStorage = new NodeInlayThumbStorage()
    return _nodeInlayThumbStorage
}

export { getInlayMeta } from "./inlayMeta";

// ── Helpers ──

function base64ToBlob(b64: string): Blob {
    const splitDataURI = b64.split(',');
    const byteString = atob(splitDataURI[1]);
    const mimeString = splitDataURI[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
}

function blobToBase64(blob: Blob): Promise<string> {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    return new Promise<string>((resolve, reject) => {
        reader.onloadend = () => { resolve(reader.result as string); };
        reader.onerror = reject;
    });
}

async function buildThumbnailDataUrl(asset: InlayAsset, maxSide = 512, quality = 0.84): Promise<string | null> {
    if (asset.type !== 'image') return null
    let src = ''
    let revokeUrl = ''
    try {
        if (asset.data instanceof Blob) {
            revokeUrl = URL.createObjectURL(asset.data)
            src = revokeUrl
        } else if (typeof asset.data === 'string') {
            src = asset.data
        }
        if (!src) return null
        const img = new Image()
        img.decoding = 'async'
        img.src = src
        if (img.decode) {
            await img.decode()
        } else {
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve()
                img.onerror = () => reject(new Error('thumbnail decode failed'))
            })
        }
        const w = img.naturalWidth || img.width || 0
        const h = img.naturalHeight || img.height || 0
        if (!w || !h) return null
        const ratio = Math.min(1, maxSide / Math.max(w, h))
        const tw = Math.max(1, Math.round(w * ratio))
        const th = Math.max(1, Math.round(h * ratio))
        const canvas = document.createElement('canvas')
        canvas.width = tw
        canvas.height = th
        const ctx = canvas.getContext('2d')
        if (!ctx) return null
        ctx.drawImage(img, 0, 0, tw, th)
        try {
            return canvas.toDataURL('image/webp', quality)
        } catch {
            return canvas.toDataURL('image/jpeg', quality)
        }
    } catch {
        return null
    } finally {
        if (revokeUrl) URL.revokeObjectURL(revokeUrl)
    }
}

async function buildInlayThumbnail(asset: InlayAsset): Promise<InlayThumbnail | null> {
    if (asset.type !== 'image') return null
    const data = await buildThumbnailDataUrl(asset)
    if (!data) return null
    return { data, ext: asset.ext, height: asset.height, name: asset.name, type: 'image', width: asset.width }
}

function buildInlayExplorerInfo(asset: InlayAsset): InlayExplorerInfo {
    return {
        ext: asset.ext,
        height: asset.height,
        name: asset.name,
        type: asset.type,
        width: asset.width,
    }
}

function buildExplorerItem(
    id: string,
    info: InlayExplorerInfo | null,
    hasThumb: boolean,
    meta: InlayAssetMeta | null
): InlayExplorerItem {
    return {
        ext: info?.ext ?? '',
        hasMeta: meta !== null,
        hasThumb,
        height: info?.height,
        id,
        meta,
        name: info?.name ?? id,
        thumb: null, // thumb data is no longer bulk-fetched; served via /api/asset/ URL
        type: info?.type ?? 'image',
        width: info?.width,
    }
}

function getSafeChatName(name: unknown, fallbackId: string, index: number): string {
    if (typeof name === 'string' && name.trim().length > 0) return name
    if (fallbackId.trim().length > 0) return fallbackId
    return `Chat ${index + 1}`
}

function getSafeCharacterName(name: unknown, fallbackId: string, index: number): string {
    if (typeof name === 'string' && name.trim().length > 0) return name
    if (fallbackId.trim().length > 0) return fallbackId
    return `Character ${index + 1}`
}

// ── Public API ──

export async function postInlayAsset(img: { name: string, data: Uint8Array }) {
    const extention = img.name.split('.').at(-1)
    const imgObj = new Image()

    if (inlayImageExts.includes(extention)) {
        imgObj.src = URL.createObjectURL(new Blob([asBuffer(img.data)], { type: `image/${extention}` }))
        return await writeInlayImage(imgObj, { name: img.name, ext: extention })
    }

    if (inlayAudioExts.includes(extention)) {
        const audioBlob = new Blob([asBuffer(img.data)], { type: `audio/${extention}` })
        const imgid = v4()
        await setInlayAsset(imgid, { name: img.name, data: audioBlob, ext: extention, type: 'audio' })
        return `${imgid}`
    }

    if (inlayVideoExts.includes(extention)) {
        const videoBlob = new Blob([asBuffer(img.data)], { type: `video/${extention}` })
        const imgid = v4()
        await setInlayAsset(imgid, { name: img.name, data: videoBlob, ext: extention, type: 'video' })
        return `${imgid}`
    }

    return null
}

export async function writeInlayImage(imgObj: HTMLImageElement, arg: { name?: string, ext?: string, id?: string } = {}) {
    let drawHeight = 0
    let drawWidth = 0
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    await new Promise((resolve) => {
        imgObj.onload = () => {
            drawHeight = imgObj.height
            drawWidth = imgObj.width
            const maxPixels = 1024 * 1024
            const currentPixels = drawHeight * drawWidth
            if (currentPixels > maxPixels) {
                const scaleFactor = Math.sqrt(maxPixels / currentPixels)
                drawWidth = Math.floor(drawWidth * scaleFactor)
                drawHeight = Math.floor(drawHeight * scaleFactor)
            }
            canvas.width = drawWidth
            canvas.height = drawHeight
            ctx.drawImage(imgObj, 0, 0, drawWidth, drawHeight)
            resolve(null)
        }
    })
    const imageBlob = await new Promise<Blob>(resolve => canvas.toBlob(resolve, 'image/png'))
    const imgid = arg.id ?? v4()
    await setInlayAsset(imgid, { name: arg.name ?? imgid, data: imageBlob, ext: 'png', height: drawHeight, width: drawWidth, type: 'image' })
    return `${imgid}`
}

export type InlaySignature = {
    signatures: {
        type: 'function' | 'text'
        content: string
    }[],
    sourceFormat: LLMFormat,
    source: string
}

export async function saveInlayedSignature(sigid: string, signature: InlaySignature) {
    await setInlayAsset(sigid, {
        name: sigid,
        data: JSON.stringify(signature),
        ext: 'json',
        type: 'signature'
    } satisfies InlayAsset)
    return sigid
}

// Returns with base64 data URI
export async function getInlayAsset(id: string) {
    const img = await getInlayStorage().getItem<InlayAsset | null>(id)
    if (img === null) return null
    let data: string
    if (img.data instanceof Blob) {
        data = await blobToBase64(img.data)
    } else {
        data = img.data as string
    }
    const existingInfo = await getInlayInfoStorage().getItem<InlayExplorerInfo>(id)
    if (!existingInfo) {
        await getInlayInfoStorage().setItem(id, buildInlayExplorerInfo(toCoreInlayAsset(img)))
    }
    return { ...toCoreInlayAsset(img), data }
}

// Returns with Blob
export async function getInlayAssetBlob(id: string) {
    const img = await getInlayStorage().getItem<InlayAsset | null>(id)
    if (img === null) return null
    let data: Blob
    if (typeof img.data === 'string') {
        data = base64ToBlob(img.data)
        await setInlayAsset(id, { ...toCoreInlayAsset(img), data })
    } else {
        data = img.data
        const existingInfo = await getInlayInfoStorage().getItem<InlayExplorerInfo>(id)
        if (!existingInfo) {
            await getInlayInfoStorage().setItem(id, buildInlayExplorerInfo(toCoreInlayAsset(img)))
        }
    }
    return { ...toCoreInlayAsset(img), data }
}

export async function listInlayAssets(): Promise<[id: string, InlayAsset][]> {
    const assets: [id: string, InlayAsset][] = []
    await getInlayStorage().iterate<InlayAsset, void>((value, key) => {
        assets.push([key, toCoreInlayAsset(value)])
    })
    return assets
}

export async function listInlayKeys(): Promise<string[]> {
    return await getInlayStorage().keys()
}

export function getCharacterChatIndex(): CharacterChatIndexItem[] {
    const db = getDatabase()
    const characters = Array.isArray(db?.characters) ? db.characters : []
    const result: CharacterChatIndexItem[] = []
    for (let i = 0; i < characters.length; i++) {
        const char = characters[i]
        const chaId = typeof char?.chaId === 'string' ? char.chaId : ''
        if (!chaId) continue
        const chats = Array.isArray(char?.chats) ? char.chats : []
        result.push({
            chaId,
            chats: chats
                .map((chat, chatIndex) => {
                    const id = typeof chat?.id === 'string' ? chat.id : ''
                    if (!id) return null
                    return {
                        id,
                        name: getSafeChatName(chat?.name, id, chatIndex),
                    }
                })
                .filter((chat): chat is CharacterChatIndexItem['chats'][number] => chat !== null),
            name: getSafeCharacterName(char?.name, chaId, i),
        })
    }
    return result
}

/**
 * Lightweight explorer list for Playground.
 * Use `getInlayAssetBlob(id)` on demand when the user opens or downloads the original file.
 */
// Gallery metadata cache — avoids re-fetching on gallery re-entry
let _explorerItemsCache: InlayExplorerItem[] | null = null
let _explorerItemsCacheTime = 0
const EXPLORER_CACHE_TTL = 30_000 // 30 seconds

export async function listInlayExplorerItems(forceRefresh = false): Promise<InlayExplorerItem[]> {
    if (!forceRefresh && _explorerItemsCache && Date.now() - _explorerItemsCacheTime < EXPLORER_CACHE_TTL) {
        return _explorerItemsCache
    }

    const ids = await listInlayKeys()
    if (ids.length === 0) {
        _explorerItemsCache = []
        _explorerItemsCacheTime = Date.now()
        return []
    }

    // Fetch info + meta + thumb key existence in parallel.
    // Thumb DATA is NOT fetched here — gallery renders thumbs via /api/asset/ URL.
    const [infos, thumbIds, metas] = await Promise.all([
        getInlayInfoStorage().getItems<InlayExplorerInfo>(ids),
        getInlayThumbStorage().existingIds(),
        getInlayMetas(ids),
    ])

    const items = ids.map((id) => buildExplorerItem(
        id,
        infos[id] ?? null,
        thumbIds.has(id),
        metas[id] ?? null,
    ))

    _explorerItemsCache = items
    _explorerItemsCacheTime = Date.now()
    return items
}

export async function setInlayAsset(id: string, img: InlayAsset) {
    const existingMeta = await getInlayMeta(id)
    const nextMeta = buildInlayMeta(existingMeta)
    await getInlayStorage().setItem(id, toCoreInlayAsset(img))
    await getInlayInfoStorage().setItem(id, buildInlayExplorerInfo(toCoreInlayAsset(img)))
    await setInlayMeta(id, nextMeta)
    const thumb = await buildInlayThumbnail(toCoreInlayAsset(img))
    if (thumb) {
        await getInlayThumbStorage().setItem(id, thumb)
    } else {
        await getInlayThumbStorage().removeItem(id)
    }
    _explorerItemsCache = null // invalidate gallery cache
}

export async function removeInlayAsset(id: string) {
    await getInlayStorage().removeItem(id)
    await getInlayInfoStorage().removeItem(id)
    await removeInlayMeta(id)
    await getInlayThumbStorage().removeItem(id)
    _explorerItemsCache = null // invalidate gallery cache
}

export async function removeInlayAssets(ids: string[]): Promise<number> {
    if (!Array.isArray(ids) || ids.length === 0) return 0
    let removed = 0
    for (const id of ids) {
        if (!id) continue
        try {
            await removeInlayAsset(id)
            removed++
        } catch {
            // best-effort bulk delete
        }
    }
    return removed
}

export async function setInlayMetaFields(
    id: string,
    patch: Partial<Pick<InlayAssetMeta, 'charId' | 'chatId' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
    const existing = await getInlayMeta(id)
    const now = Date.now()
    const next: InlayAssetMeta = {
        createdAt: (typeof patch.createdAt === 'number' && patch.createdAt > 0)
            ? patch.createdAt
            : (existing?.createdAt && existing.createdAt > 0 ? existing.createdAt : now),
        updatedAt: (typeof patch.updatedAt === 'number' && patch.updatedAt > 0) ? patch.updatedAt : now,
        charId: typeof patch.charId === 'string' ? patch.charId : existing?.charId,
        chatId: typeof patch.chatId === 'string' ? patch.chatId : existing?.chatId,
    }
    await setInlayMeta(id, next)
}

export async function getInlayMetas(ids: string[]): Promise<Record<string, InlayAssetMeta>> {
    if (!Array.isArray(ids) || ids.length === 0) return {}
    return await getInlayMetasBatch(ids)
}

export async function getInlayInfosBatch(ids: string[]): Promise<Record<string, InlayExplorerInfo>> {
    if (!Array.isArray(ids) || ids.length === 0) return {}
    return await getInlayInfoStorage().getItems<InlayExplorerInfo>(ids)
}

export async function getInlayListItem(id: string): Promise<InlayAsset | null> {
    const thumb = await getInlayThumbStorage().getItem<InlayThumbnail | null>(id)
    if (thumb && typeof thumb.data === 'string' && thumb.data.startsWith('data:')) {
        return { data: thumb.data, ext: thumb.ext, height: thumb.height, name: thumb.name || id, type: 'image', width: thumb.width }
    }
    const full = await getInlayAsset(id)
    if (!full) return null
    if (full.type === 'image') {
        const coreFull = toCoreInlayAsset(full)
        const generatedThumb = await buildInlayThumbnail(coreFull)
        if (generatedThumb) {
            await getInlayThumbStorage().setItem(id, generatedThumb)
            return { data: generatedThumb.data, ext: generatedThumb.ext, height: generatedThumb.height, name: generatedThumb.name || id, type: 'image', width: generatedThumb.width }
        }
    }
    return full
}

export type InlayScanResult = {
    scannedAt: number
    totalMessages: number
    refCounts: Record<string, number>
}

const INLAY_REF_REGEX = /\{\{(?:inlay|inlayed|inlayeddata)::(.+?)\}\}/g

/**
 * Scan all chat messages in the database and count how many times each inlay ID is referenced.
 * This is a synchronous read from the in-memory DB state — no async I/O needed.
 */
export function scanInlayReferences(): InlayScanResult {
    const db = getDatabase()
    const characters = Array.isArray(db?.characters) ? db.characters : []
    const refCounts: Record<string, number> = {}
    let totalMessages = 0

    for (const char of characters) {
        if (!Array.isArray(char?.chats)) continue
        for (const chat of char.chats) {
            if (!Array.isArray(chat?.message)) continue
            for (const msg of chat.message) {
                if (typeof msg?.data !== 'string') continue
                totalMessages++
                // Reset regex state and create fresh instance to avoid lastIndex issues
                const regex = new RegExp(INLAY_REF_REGEX.source, 'g')
                let m: RegExpExecArray | null
                while ((m = regex.exec(msg.data)) !== null) {
                    const id = m[1]
                    refCounts[id] = (refCounts[id] ?? 0) + 1
                }
            }
        }
    }

    return { scannedAt: Date.now(), totalMessages, refCounts }
}

export function supportsInlayImage() {
    const db = getDatabase()
    return getModelInfo(db.aiModel).flags.includes(LLMFlags.hasImageInput)
}

export async function reencodeImage(img: Uint8Array) {
    if (getImageType(img) === 'PNG') return img
    const canvas = document.createElement('canvas')
    const imgObj = new Image()
    imgObj.src = URL.createObjectURL(new Blob([asBuffer(img)], { type: `image/png` }))
    await imgObj.decode()
    let drawHeight = imgObj.height
    let drawWidth = imgObj.width
    canvas.width = drawWidth
    canvas.height = drawHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(imgObj, 0, 0, drawWidth, drawHeight)
    const b64 = canvas.toDataURL('image/png').split(',')[1]
    const b = Buffer.from(b64, 'base64')
    return b
}
