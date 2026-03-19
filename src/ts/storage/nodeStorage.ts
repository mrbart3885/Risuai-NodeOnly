import { language } from "src/lang"
import { alertError, alertInput, waitAlert } from "../alert"
import { base64url, getKeypairStore, saveKeypairStore } from "../util"


export class NodeStorage{
    private static readonly BULK_WRITE_CLIENT_BATCH = 20

    authChecked = false
    private cachedJwt: { token: string; expiresAt: number } | null = null
    private static sessionInitialized = false
    JSONStringlifyAndbase64Url(obj:any){
        return base64url(Buffer.from(JSON.stringify(obj), 'utf-8'))
    }

    async createAuth(){
        const now = Date.now()
        if (this.cachedJwt && this.cachedJwt.expiresAt - now > 30_000) {
            return this.cachedJwt.token
        }
        const token = await this._createFreshAuth()
        this.cachedJwt = { token, expiresAt: now + 5 * 60 * 1000 }
        return token
    }

    // Called once after JWT auth is confirmed. Issues a session cookie so that
    // <img src="/api/asset/..."> can be served without JS-injected headers.
    private async initSession() {
        if (NodeStorage.sessionInitialized) return
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
        }
    }

    private async _createFreshAuth(){
        const keyPair = await this.getKeyPair()
        const date = Math.floor(Date.now() / 1000)

        const header = {
            alg: "ES256",
            typ: "JWT",
        }
        const payload = {
            iat: date,
            exp: date + 5 * 60, //5 minutes expiration
            pub: await crypto.subtle.exportKey('jwk', keyPair.publicKey)
        }
        const sig = await crypto.subtle.sign(
            {
                name: "ECDSA",
                hash: "SHA-256"
            },
            keyPair.privateKey,
            Buffer.from(
                this.JSONStringlifyAndbase64Url(header) + "." + this.JSONStringlifyAndbase64Url(payload)
            )
        )
        const sigString = base64url(new Uint8Array(sig))
        return this.JSONStringlifyAndbase64Url(header) + "." + this.JSONStringlifyAndbase64Url(payload) + "." + sigString
    }

    async getKeyPair():Promise<CryptoKeyPair>{
        
        const storedKey = await getKeypairStore('node')

        if(storedKey){
            return storedKey
        }

        const keyPair = await crypto.subtle.generateKey(
            {
                name: "ECDSA",
                namedCurve: "P-256"
            },
            false,
            ["sign", "verify"],
        );

        await saveKeypairStore('node', keyPair)

        return keyPair

    }

    private async loginWithPassword(password: string) {
        const keypair = await this.getKeyPair()
        const publicKey = await crypto.subtle.exportKey('jwk', keypair.publicKey)
        const response = await fetch('/api/login', {
            method: "POST",
            body: JSON.stringify({
                password,
                publicKey
            }),
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
                'Unknown Public Key',
                'Invalid Signature',
                'Token Expired'
            ].includes(data?.error)
        } catch {
            return false
        }
    }

    private async authFetch(input: RequestInfo | URL, init: RequestInit = {}, retry = true) {
        await this.checkAuth()
        const headers = new Headers(init.headers)
        headers.set('risu-auth', await this.createAuth())

        const response = await fetch(input, {
            ...init,
            headers
        })

        if(retry && await this.shouldRetryAuth(response)){
            this.authChecked = false
            this.cachedJwt = null
            await this.checkAuth()
            return this.authFetch(input, init, false)
        }

        return response
    }

    async setItem(key:string, value:Uint8Array) {
        const da = await this.authFetch('/api/write', {
            method: "POST",
            body: value as any,
            headers: {
                'content-type': 'application/octet-stream',
                'file-path': Buffer.from(key, 'utf-8').toString('hex')
            }
        })
        if(da.status < 200 || da.status >= 300){
            throw "setItem Error"
        }
        const data = await da.json()
        if(data.error){
            throw data.error
        }
    }
    async getItem(key:string):Promise<Buffer> {
        const da = await this.authFetch('/api/read', {
            method: "GET",
            headers: {
                'file-path': Buffer.from(key, 'utf-8').toString('hex')
            }
        })
        if(da.status < 200 || da.status >= 300){
            throw "getItem Error"
        }

        const data = Buffer.from(await da.arrayBuffer())
        if (data.length == 0){
            return null
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
                    'risu-auth': await this.createAuth()
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
                return
            }
            else if(data.status === 'incorrect'){
                const input = await digestPassword(await alertInput(language.inputNodePassword))
                await this.loginWithPassword(input)
                await this.initSession()
                return
            }
            else{
                this.authChecked = true
            }
        }
        await this.initSession()
    }

    listItem = this.keys

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

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    onProgress?.(event.loaded, event.total)
                }
            }

            xhr.onerror = () => reject(new Error('backup import request failed'))
            xhr.onload = () => {
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

    // ── Entity API methods (3-2) ───────────────────────────────────────────────
    private async entityFetch(path: string, method: string, body?: Uint8Array): Promise<Buffer | null> {
        const headers: Record<string, string> = {}
        if (body) headers['content-type'] = 'application/octet-stream'
        const da = await this.authFetch(path, { method, headers, body: body as any })
        if (da.status === 404) return null
        if (da.status < 200 || da.status >= 300) throw `entityFetch Error: ${da.status}`
        if (method === 'DELETE' || da.headers.get('content-type')?.includes('application/json')) return null
        return Buffer.from(await da.arrayBuffer())
    }

    async saveCharacter(id: string, data: Uint8Array) {
        await this.entityFetch(`/api/db/characters/${encodeURIComponent(id)}`, 'POST', data)
    }
    async loadCharacter(id: string): Promise<Buffer | null> {
        return this.entityFetch(`/api/db/characters/${encodeURIComponent(id)}`, 'GET')
    }
    async listCharacters(): Promise<{id: string, updated_at: number}[]> {
        const da = await this.authFetch('/api/db/characters')
        return da.json()
    }
    async deleteCharacter(id: string) {
        await this.entityFetch(`/api/db/characters/${encodeURIComponent(id)}`, 'DELETE')
    }

    async saveChat(charId: string, chatId: string, data: Uint8Array) {
        await this.entityFetch(`/api/db/chats/${encodeURIComponent(charId)}/${encodeURIComponent(chatId)}`, 'POST', data)
    }
    async loadChat(charId: string, chatId: string): Promise<Buffer | null> {
        return this.entityFetch(`/api/db/chats/${encodeURIComponent(charId)}/${encodeURIComponent(chatId)}`, 'GET')
    }
    async listChats(charId: string): Promise<string[]> {
        const da = await this.authFetch(`/api/db/chats/${encodeURIComponent(charId)}`)
        return da.json()
    }
    async deleteChat(charId: string, chatId: string) {
        await this.entityFetch(`/api/db/chats/${encodeURIComponent(charId)}/${encodeURIComponent(chatId)}`, 'DELETE')
    }

    async saveSettings(data: Uint8Array) {
        await this.entityFetch('/api/db/settings', 'POST', data)
    }
    async loadSettings(): Promise<Buffer | null> {
        return this.entityFetch('/api/db/settings', 'GET')
    }

    async savePreset(id: string, data: Uint8Array) {
        await this.entityFetch(`/api/db/presets/${encodeURIComponent(id)}`, 'POST', data)
    }
    async loadPreset(id: string): Promise<Buffer | null> {
        return this.entityFetch(`/api/db/presets/${encodeURIComponent(id)}`, 'GET')
    }
    async listPresets(): Promise<string[]> {
        const da = await this.authFetch('/api/db/presets')
        return da.json()
    }
    async deletePreset(id: string) {
        await this.entityFetch(`/api/db/presets/${encodeURIComponent(id)}`, 'DELETE')
    }

    async saveModule(id: string, data: Uint8Array) {
        await this.entityFetch(`/api/db/modules/${encodeURIComponent(id)}`, 'POST', data)
    }
    async loadModule(id: string): Promise<Buffer | null> {
        return this.entityFetch(`/api/db/modules/${encodeURIComponent(id)}`, 'GET')
    }
    async listModules(): Promise<string[]> {
        const da = await this.authFetch('/api/db/modules')
        return da.json()
    }
    async deleteModule(id: string) {
        await this.entityFetch(`/api/db/modules/${encodeURIComponent(id)}`, 'DELETE')
    }

    subscribeEvents(callback: (ev: {type: string, id: string, updated_at: number}) => void): () => void {
        const source = new EventSource('/api/events')
        source.onmessage = (e) => {
            try { callback(JSON.parse(e.data)) } catch {}
        }
        return () => source.close()
    }
}

async function digestPassword(message:string) {
    const crypt = await (await fetch('/api/crypto', {
        body: JSON.stringify({
            data: message
        }),
        headers: {
            'content-type': 'application/json'
        },
        method: "POST"
    })).text()
    
    return crypt;
}
