// ── NodeOnly: server-side JWT ────────────────────────────────────────────────
// Upstream uses client-side ECDSA JWT (crypto.subtle) which requires Secure
// Context (HTTPS/localhost). NodeOnly needs HTTP remote access, so JWT
// signing is moved to the server. The client only caches and forwards
// server-issued tokens. If upstream changes its auth flow, sync manually.
// Server counterpart: server/node/server.cjs (createServerJwt, checkAuth,
// /api/login, /api/token/refresh)
import { language } from "src/lang"
import { alertError, alertInput, alertNormal, waitAlert } from "../alert"

// Custom error class for database conflict detection
export class ConflictError extends Error {
    currentEtag: string
    constructor(message: string, currentEtag: string) {
        super(message)
        this.name = 'ConflictError'
        this.currentEtag = currentEtag
    }
}

// ── database.bin read cache (IndexedDB) ──────────────────────────────────────
// Caches the database.bin blob + ETag locally so that subsequent page loads can
// skip the full download when the server responds 304 Not Modified.
// Only database.bin is cached — this is not a general-purpose cache layer.

const DB_CACHE_DB_NAME = 'risu-db-cache'
const DB_CACHE_STORE = 'cache'
const DB_CACHE_KEY = 'database.bin'

async function dbCacheGet(): Promise<{ blob: Uint8Array, etag: string } | null> {
    try {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const req = indexedDB.open(DB_CACHE_DB_NAME, 1)
            req.onupgradeneeded = () => req.result.createObjectStore(DB_CACHE_STORE)
            req.onsuccess = () => resolve(req.result)
            req.onerror = () => reject(req.error)
        })
        const tx = db.transaction(DB_CACHE_STORE, 'readonly')
        const store = tx.objectStore(DB_CACHE_STORE)
        const result = await new Promise<any>((resolve, reject) => {
            const req = store.get(DB_CACHE_KEY)
            req.onsuccess = () => resolve(req.result)
            req.onerror = () => reject(req.error)
        })
        db.close()
        if (result && result.blob && result.etag) {
            return { blob: result.blob, etag: result.etag }
        }
        return null
    } catch {
        return null
    }
}

async function dbCacheSet(blob: Uint8Array, etag: string): Promise<void> {
    try {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const req = indexedDB.open(DB_CACHE_DB_NAME, 1)
            req.onupgradeneeded = () => req.result.createObjectStore(DB_CACHE_STORE)
            req.onsuccess = () => resolve(req.result)
            req.onerror = () => reject(req.error)
        })
        const tx = db.transaction(DB_CACHE_STORE, 'readwrite')
        const store = tx.objectStore(DB_CACHE_STORE)
        // Atomic: blob + etag written in a single transaction
        store.put({ blob, etag }, DB_CACHE_KEY)
        await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve()
            tx.onerror = () => reject(tx.error)
        })
        db.close()
    } catch {
        // Cache write failure is non-fatal
    }
}

export { dbCacheSet }

export class NodeStorage{
    private static readonly BULK_WRITE_CLIENT_BATCH = 20

    _lastDbEtag: string | null = null
    authChecked = false
    private cachedJwt: { token: string; expiresAt: number } | null = null
    private static sessionInitialized = false
    private static sessionPending: Promise<void> | null = null
    private static deviceKey: string | null = null
    private static deviceKeyPending: Promise<void> | null = null
    private static sessionDeactivated = false
    private refreshPending: Promise<string> | null = null

    async createAuth(){
        const now = Date.now()
        if (this.cachedJwt && this.cachedJwt.expiresAt - now > 30_000) {
            return this.cachedJwt.token
        }
        const token = await this._refreshToken()
        return token
    }

    // Called once after JWT auth is confirmed. Issues a session cookie so that
    // <img src="/api/asset/..."> can be served without JS-injected headers.
    private async initSession() {
        if (NodeStorage.sessionInitialized) return
        if (NodeStorage.sessionPending) return NodeStorage.sessionPending
        NodeStorage.sessionPending = this._doInitSession()
        return NodeStorage.sessionPending
    }

    private async _doInitSession() {
        try {
            const res = await fetch('/api/session', {
                method: 'POST',
                headers: { 'risu-auth': await this.createAuth() },
            })
            if (res.ok) {
                NodeStorage.sessionInitialized = true
            }
            // Non-ok (400/401/500): will retry on next checkAuth() call.
        } catch {
            // Network error: will retry on next checkAuth() call.
        } finally {
            NodeStorage.sessionPending = null
        }
    }

    // ── Active device session (single-writer lock) ─────────────────────────
    // Requests a unique device key from the server. Only the last device to
    // activate may perform write operations. Previous sessions get 423.
    private async activateDevice() {
        if (NodeStorage.deviceKey) return
        if (NodeStorage.deviceKeyPending) return NodeStorage.deviceKeyPending
        NodeStorage.deviceKeyPending = this._doActivateDevice()
        return NodeStorage.deviceKeyPending
    }

    private async _doActivateDevice() {
        try {
            const res = await fetch('/api/session/activate', {
                method: 'POST',
                headers: { 'risu-auth': await this.createAuth() },
            })
            if (res.ok) {
                const data = await res.json()
                NodeStorage.deviceKey = data.deviceKey
            }
        } catch {
            // Network error: will retry on next call
        } finally {
            NodeStorage.deviceKeyPending = null
        }
    }

    private handleSessionDeactivated() {
        if (NodeStorage.sessionDeactivated) return
        NodeStorage.sessionDeactivated = true
        // Show alert and reload page on confirmation
        alertNormal(language.sessionDeactivated ?? 'Session has been deactivated. The page will reload.')
        waitAlert().then(() => {
            location.reload()
        })
    }

    private async _refreshToken(): Promise<string> {
        if (this.refreshPending) return this.refreshPending
        this.refreshPending = this._doRefreshToken()
        try { return await this.refreshPending }
        finally { this.refreshPending = null }
    }

    private async _doRefreshToken(): Promise<string> {
        const res = await fetch('/api/token/refresh', {
            method: 'POST',
            headers: { 'risu-auth': this.cachedJwt?.token ?? '' }
        })
        if (res.ok) {
            const data = await res.json()
            this.cachedJwt = { token: data.token, expiresAt: Date.now() + 5 * 60 * 1000 }
            return data.token
        }
        return this.cachedJwt?.token ?? ''
    }

    private async loginWithPassword(password: string) {
        const response = await fetch('/api/login', {
            method: "POST",
            body: JSON.stringify({ password }),
            headers: {
                'content-type': 'application/json'
            }
        })

        if(response.status === 429){
            alertError(`Too many attempts. Please wait and try again later.`)
            await waitAlert()
            throw new Error('Too many login attempts')
        }

        if(response.status < 200 || response.status >= 300){
            let message = 'Node login failed'
            try {
                const data = await response.json()
                message = data.error ?? message
            } catch {
                // noop
            }
            throw new Error(message)
        }

        const data = await response.json()
        if (data.token) {
            this.cachedJwt = { token: data.token, expiresAt: Date.now() + 5 * 60 * 1000 }
        }
        this.authChecked = true
    }

    private async shouldRetryAuth(response: Response) {
        if(response.status !== 400 && response.status !== 401){
            return false
        }

        try {
            const data = await response.clone().json()
            return [
                'No auth header',
                'Invalid Signature',
                'Token Expired'
            ].includes(data?.error)
        } catch {
            return false
        }
    }

    private async authFetch(input: RequestInfo | URL, init: RequestInit = {}, retry = true) {
        if (NodeStorage.sessionDeactivated) {
            throw new Error('Session deactivated')
        }
        await this.checkAuth()
        const headers = new Headers(init.headers)
        headers.set('risu-auth', await this.createAuth())
        if (NodeStorage.deviceKey) {
            headers.set('x-device-key', NodeStorage.deviceKey)
        }

        const response = await fetch(input, {
            ...init,
            headers
        })

        if (response.status === 423) {
            this.handleSessionDeactivated()
            throw new Error('Session deactivated')
        }

        if(retry && await this.shouldRetryAuth(response)){
            this.authChecked = false
            this.cachedJwt = null
            await this.checkAuth()
            return this.authFetch(input, init, false)
        }

        return response
    }

    async setItem(key:string, value:Uint8Array, etag?:string) {
        const headers: Record<string, string> = {
            'content-type': 'application/octet-stream',
            'file-path': Buffer.from(key, 'utf-8').toString('hex')
        }
        if (etag) {
            headers['x-if-match'] = etag
        }
        const da = await this.authFetch('/api/write', {
            method: "POST",
            body: value as any,
            headers
        })
        if(da.status === 409){
            const data = await da.json()
            throw new ConflictError(data.error, data.currentEtag)
        }
        if(da.status < 200 || da.status >= 300){
            throw "setItem Error"
        }
        const data = await da.json()
        if(data.error){
            throw data.error
        }
        const nextEtag = data.etag as string | undefined
        if (key === 'database/database.bin' && nextEtag) {
            this._lastDbEtag = nextEtag
        }
    }
    async getItem(key:string):Promise<Buffer> {
        const headers: Record<string, string> = {
            'file-path': Buffer.from(key, 'utf-8').toString('hex')
        }

        // For database.bin, try to use cached version with ETag validation
        if (key === 'database/database.bin') {
            const cached = await dbCacheGet()
            if (cached) {
                headers['if-none-match'] = cached.etag
                const da = await this.authFetch('/api/read', { method: "GET", headers })
                if (da.status === 304) {
                    this._lastDbEtag = cached.etag
                    return Buffer.from(cached.blob)
                }
                if (da.status < 200 || da.status >= 300) {
                    throw "getItem Error"
                }
                const etag = da.headers.get('x-db-etag')
                if (etag) {
                    this._lastDbEtag = etag
                }
                const data = Buffer.from(await da.arrayBuffer())
                if (data.length === 0) return null
                if (etag) {
                    void dbCacheSet(new Uint8Array(data), etag)
                }
                return data
            }
        }

        const da = await this.authFetch('/api/read', { method: "GET", headers })
        if(da.status < 200 || da.status >= 300){
            throw "getItem Error"
        }

        // Capture ETag for database.bin
        const etag = da.headers.get('x-db-etag')
        if (etag) {
            this._lastDbEtag = etag
        }

        const data = Buffer.from(await da.arrayBuffer())
        if (data.length === 0){
            return null
        }

        // Cache database.bin after full download
        if (key === 'database/database.bin' && etag) {
            void dbCacheSet(new Uint8Array(data), etag)
        }

        return data
    }
    async keys(prefix: string = ''):Promise<string[]>{
        const headers: Record<string, string> = {
        }
        if (prefix) {
            headers['key-prefix'] = prefix
        }
        const da = await this.authFetch('/api/list', {
            method: "GET",
            headers
        })
        if(da.status < 200 || da.status >= 300){
            throw "listItem Error"
        }
        const data = await da.json()
        if(data.error){
            throw data.error
        }
        return data.content
    }
    async removeItem(key:string){
        const da = await this.authFetch('/api/remove', {
            method: "GET",
            headers: {
                'file-path': Buffer.from(key, 'utf-8').toString('hex')
            }
        })
        if(da.status < 200 || da.status >= 300){
            throw "removeItem Error"
        }
        const data = await da.json()
        if(data.error){
            throw data.error
        }
    }

    private async checkAuth(){

        if(!this.authChecked){
            const data = await (await fetch('/api/test_auth',{
                headers: {
                    'risu-auth': this.cachedJwt?.token ?? ''
                }
            })).json()

            if(data.status === 'unset'){
                const input = await digestPassword(await alertInput(language.setNodePassword))
                const response = await fetch('/api/set_password',{
                    method: "POST",
                    body:JSON.stringify({
                        password: input 
                    }),
                    headers: {
                        'content-type': 'application/json'
                    }
                })

                if(response.status < 200 || response.status >= 300){
                    throw new Error('Failed to set node password')
                }

                await this.loginWithPassword(input)
                await this.initSession()
                await this.activateDevice()
                return
            }
            else if(data.status === 'incorrect'){
                const input = await digestPassword(await alertInput(language.inputNodePassword))
                await this.loginWithPassword(input)
                await this.initSession()
                await this.activateDevice()
                return
            }
            else{
                if (data.token) {
                    this.cachedJwt = { token: data.token, expiresAt: Date.now() + 5 * 60 * 1000 }
                }
                this.authChecked = true
            }
        }
        await this.initSession()
        await this.activateDevice()
    }

    listItem = this.keys

    /** Set cached ETag for database.bin */
    setDbEtag(etag: string | null) {
        this._lastDbEtag = etag
    }

    async patchItem(key: string, patchData: { patch: any[], expectedHash: string }): Promise<{success: boolean, etag?: string}> {
        const da = await this.authFetch('/api/patch', {
            method: "POST",
            body: JSON.stringify(patchData),
            headers: {
                'content-type': 'application/json',
                'file-path': Buffer.from(key, 'utf-8').toString('hex')
            }
        })

        if (da.status === 409) {
            const data = await da.json()
            const currentEtag = data.currentEtag as string | undefined
            if (key === 'database/database.bin' && currentEtag) {
                this._lastDbEtag = currentEtag
            }
            return { success: false, etag: currentEtag }
        }
        if (da.status < 200 || da.status >= 300) {
            return { success: false }
        }
        const data = await da.json()
        if (data.error) {
            return { success: false }
        }
        const nextEtag = data.etag as string | undefined
        if (key === 'database/database.bin' && nextEtag) {
            this._lastDbEtag = nextEtag
        }
        return { success: true, etag: nextEtag }
    }

    // ── Bulk asset operations (3-2-B) ──────────────────────────────────────────
    async getItems(keys: string[]): Promise<{key: string, value: Buffer}[]> {
        const da = await this.authFetch('/api/assets/bulk-read', {
            method: 'POST',
            body: JSON.stringify(keys),
            headers: {
                'content-type': 'application/json',
                'accept': 'application/octet-stream'
            }
        })
        if (da.status < 200 || da.status >= 300) throw 'getItems Error'

        const ct = da.headers.get('content-type') || ''
        if (ct.includes('application/octet-stream')) {
            // Binary protocol: [count(4)] then per entry: [keyLen(4)][key][valLen(4)][value]
            const buf = Buffer.from(await da.arrayBuffer())
            let offset = 0
            const count = buf.readUInt32BE(offset); offset += 4
            const results: {key: string, value: Buffer}[] = []
            for (let i = 0; i < count; i++) {
                const keyLen = buf.readUInt32BE(offset); offset += 4
                const key = buf.subarray(offset, offset + keyLen).toString('utf-8'); offset += keyLen
                const valLen = buf.readUInt32BE(offset); offset += 4
                const value = buf.subarray(offset, offset + valLen) as Buffer; offset += valLen
                results.push({ key, value })
            }
            return results
        }

        // Fallback: JSON+base64
        const results: {key: string, value: string}[] = await da.json()
        return results.map(r => ({ key: r.key, value: Buffer.from(r.value, 'base64') }))
    }

    async setItems(entries: {key: string, value: Uint8Array}[]) {
        for (let i = 0; i < entries.length; i += NodeStorage.BULK_WRITE_CLIENT_BATCH) {
            const batch = entries.slice(i, i + NodeStorage.BULK_WRITE_CLIENT_BATCH)
            const body = batch.map(e => ({
                key: e.key,
                value: Buffer.from(e.value).toString('base64')
            }))
            const da = await this.authFetch('/api/assets/bulk-write', {
                method: 'POST',
                body: JSON.stringify(body),
                headers: {
                    'content-type': 'application/json'
                }
            })
            if (da.status < 200 || da.status >= 300) throw 'setItems Error'
        }
    }

    async exportBackup(): Promise<Response> {
        const da = await this.authFetch('/api/backup/export')
        if (da.status < 200 || da.status >= 300) throw `backup export error: ${da.status}`
        return da
    }

    async prepareImport(size: number): Promise<void> {
        const da = await this.authFetch('/api/backup/import/prepare', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ size }),
        })
        if (da.status === 409) throw new Error('Another import is already in progress')
        if (da.status === 413) throw new Error('Backup file is too large')
        if (da.status === 507) {
            const body = await da.json().catch(() => ({}))
            const avail = body.available != null ? ` (available: ${Math.round(body.available / 1024 / 1024)} MB)` : ''
            throw new Error(`Insufficient disk space${avail}`)
        }
        if (da.status < 200 || da.status >= 300) throw new Error(`backup prepare error: ${da.status}`)
    }

    async importBackup(
        file: Blob,
        onProgress?: (loaded: number, total: number) => void
    ): Promise<{ok: boolean, assetsRestored: number}> {
        await this.prepareImport(file.size)
        const authHeader = await this.createAuth()

        return await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest()
            xhr.open('POST', '/api/backup/import')
            xhr.setRequestHeader('content-type', 'application/x-risu-backup')
            xhr.setRequestHeader('risu-auth', authHeader)
            if (NodeStorage.deviceKey) {
                xhr.setRequestHeader('x-device-key', NodeStorage.deviceKey)
            }

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    onProgress?.(event.loaded, event.total)
                }
            }

            xhr.onerror = () => reject(new Error('backup import request failed'))
            xhr.onload = () => {
                if (xhr.status === 423) {
                    this.handleSessionDeactivated()
                    reject(new Error('Session deactivated'))
                    return
                }
                if (xhr.status < 200 || xhr.status >= 300) {
                    reject(new Error(`backup import error: ${xhr.status}`))
                    return
                }
                try {
                    resolve(JSON.parse(xhr.responseText))
                } catch (error) {
                    reject(error)
                }
            }

            xhr.send(file)
        })
    }

}

async function digestPassword(message:string) {
    const res = await fetch('/api/crypto', {
        body: JSON.stringify({
            data: message
        }),
        headers: {
            'content-type': 'application/json'
        },
        method: "POST"
    })
    if(res.status < 200 || res.status >= 300){
        throw new Error(`Password hashing failed (${res.status})`)
    }
    return await res.text()
}
