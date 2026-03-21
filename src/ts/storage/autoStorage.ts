import { NodeStorage } from "./nodeStorage"

export class AutoStorage{
    isAccount:boolean = false

    realStorage:NodeStorage

    async setItem(key:string, value:Uint8Array, etag?:string):Promise<string|null> {
        await this.realStorage.setItem(key, value, etag)
        return null
    }
    async getItem(key:string):Promise<Buffer> {
        return await this.realStorage.getItem(key)
    }
    async keys(prefix: string = ''):Promise<string[]>{
        await this.Init()
        return await this.realStorage.keys(prefix)
    }
    async removeItem(key:string){
        return await this.realStorage.removeItem(key)
    }

    async checkAccountSync(){
        return false
    }

    async Init(){
        if(!this.realStorage){
            console.log("using node storage")
            this.realStorage = new NodeStorage()
        }
    }

    async createAuth(): Promise<string> {
        if (!this.realStorage) {
            this.realStorage = new NodeStorage()
        }
        return this.realStorage.createAuth()
    }

    async exportBackup() {
        await this.Init()
        return this.realStorage.exportBackup()
    }

    async importBackup(file: Blob) {
        await this.Init()
        return this.realStorage.importBackup(file)
    }

    async patchItem(key: string, patchData: { patch: any[], expectedHash: string }): Promise<{success: boolean, etag?: string}> {
        return await this.realStorage.patchItem(key, patchData)
    }

    /** Get the last known ETag for database.bin */
    getDbEtag(): string | null {
        return this.realStorage._lastDbEtag
    }

    /** Update cached ETag for database.bin */
    setDbEtag(etag: string | null) {
        this.realStorage.setDbEtag(etag)
    }

    listItem = this.keys

    // ── Bulk asset operations ──────────────────────────────────────────────────
    async getItems(keys: string[]) { return this.realStorage.getItems(keys) }
    async setItems(entries: {key: string, value: Uint8Array}[]) { return this.realStorage.setItems(entries) }
}
