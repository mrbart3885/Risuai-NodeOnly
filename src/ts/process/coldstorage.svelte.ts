import { forageStorage } from "../globalApi.svelte"
import { DBState } from "../stores.svelte"
import type { NodeStorage } from "../storage/nodeStorage"
import { compress as fflateCompress, decompress as fflateDecompress } from "fflate"
import { alertError } from "../alert"
import { language } from "src/lang"

export const coldStorageHeader = '\uEF01COLDSTORAGE\uEF01'

async function decompress(data:Uint8Array) {
    return new Promise<Uint8Array>((resolve, reject) => {
        fflateDecompress(data, (err, decompressed) => {
            if (err) {
                return reject(err)
            }
            resolve(decompressed)
        })
    })
}

async function getColdStorageItem(key:string) {
    try {
        const storage = forageStorage.realStorage as NodeStorage
        const f = await storage.getItem('coldstorage/' + key)
        if(!f){
            return null
        }
        const text = new TextDecoder().decode(await decompress(new Uint8Array(f)))
        return JSON.parse(text)
    }
    catch (error) {
        return null
    }
}

async function setColdStorageItem(key:string, value:any):Promise<boolean> {

    let compressed:Uint8Array
    try {
        const json = JSON.stringify(value)
        compressed = await (new Promise<Uint8Array>((resolve, reject) => {
            fflateCompress(new TextEncoder().encode(json), (err, result) => {
                if (err) {
                    return reject(err)
                }
                resolve(result)
            })
        }))
    } catch (error) {
        console.error('Cold storage compression failed:', error)
        return false
    }

    try {
        const storage = forageStorage.realStorage as NodeStorage
        await storage.setItem('coldstorage/' + key, compressed)
        return true
    } catch (error) {
        console.error('Cold storage node write failed:', error)
        return false
    }
}


export async function makeColdData(){

    if(!DBState.db.chatCompression){
        return
    }

    const currentTime = Date.now()
    const coldTime = currentTime - 1000 * 60 * 60 * 24 * 30 //30 days before now

    for(let i=0;i<DBState.db.characters.length;i++){
        for(let j=0;j<DBState.db.characters[i].chats.length;j++){

            const chat = DBState.db.characters[i].chats[j]
            let greatestTime = chat.lastDate ?? 0

            if(chat.message.length < 4){
                //it is inefficient to store small data
                continue
            }

            if(chat.message?.[0]?.data?.startsWith(coldStorageHeader)){
                //already cold storage
                continue
            }


            for(let k=0;k<chat.message.length;k++){
                const message = chat.message[k]
                const time = message.time
                if(!time){
                    continue
                }

                if(time > greatestTime){
                    greatestTime = time
                }
            }

            if(greatestTime < coldTime){
                const id = crypto.randomUUID()
                const writeSuccess = await setColdStorageItem(id, {
                    message: chat.message,
                    hypaV2Data: chat.hypaV2Data,
                    hypaV3Data: chat.hypaV3Data,
                    scriptstate: chat.scriptstate,
                    localLore: chat.localLore
                })

                if(!writeSuccess){
                    console.error(`Cold storage write failed for chat ${chat.id ?? j} in character ${i}, keeping original data`)
                    alertError(language.errors.coldStorageWriteFailed)
                    continue
                }

                // Verify the data can be read back before replacing
                const verifyData = await getColdStorageItem(id)
                if(!verifyData || (!Array.isArray(verifyData) && !verifyData.message)){
                    console.error(`Cold storage verification failed for chat ${chat.id ?? j}, keeping original data`)
                    alertError(language.errors.coldStorageVerifyFailed)
                    continue
                }

                chat.message = [{
                    time: currentTime,
                    data: coldStorageHeader + id,
                    role: 'char'
                }]
                chat.hypaV2Data = {
                    chunks:[],
                    mainChunks: [],
                    lastMainChunkID: 0,
                }
                chat.hypaV3Data = {
                    summaries:[]
                }
                chat.scriptstate = {}
                chat.localLore = []

            }
        }
    }
}

export async function preLoadChat(characterIndex:number, chatIndex:number){
    const chat = DBState.db?.characters?.[characterIndex]?.chats?.[chatIndex]

    if(!chat){
        return
    }

    if(chat.message?.[0]?.data?.startsWith(coldStorageHeader)){
        //bring back from cold storage
        const coldDataKey = chat.message[0].data.slice(coldStorageHeader.length)
        const coldData = await getColdStorageItem(coldDataKey)
        if(coldData && Array.isArray(coldData)){
            chat.message = coldData
            chat.lastDate = Date.now()
        }
        else if(coldData?.message){
            chat.message = coldData.message
            chat.hypaV2Data = coldData.hypaV2Data
            chat.hypaV3Data = coldData.hypaV3Data
            chat.scriptstate = coldData.scriptstate
            chat.localLore = coldData.localLore
            chat.lastDate = Date.now()
        }
        else{
            console.error(`Cold storage data not found for key: ${coldDataKey}`)
            chat.message = [{
                time: Date.now(),
                data: `[Cold storage data could not be loaded. Key: ${coldDataKey}]`,
                role: 'char'
            }]
            chat.lastDate = Date.now()
            return
        }
        await setColdStorageItem(coldDataKey + '_accessMeta', {
            lastAccess: Date.now()
        })
    }

}
