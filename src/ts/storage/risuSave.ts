import { Packr, Unpackr, decode } from "msgpackr/index-no-eval";
import * as fflate from "fflate";
import { getDatabase, presetTemplate, type Database } from "./database.svelte";
import { forageStorage } from "../globalApi.svelte";

const packr = new Packr({
    useRecords:false
});

const unpackr = new Unpackr({
    int64AsType: 'number',
    useRecords:false
})


// NodeOnly: server cannot resolve remote blocks, always disable
const disableRemoteSaving = () => true
const checkedRemoteExistence = new Set<string>();
const magicHeader = new Uint8Array([0, 82, 73, 83, 85, 83, 65, 86, 69, 0, 7]); 
const magicCompressedHeader = new Uint8Array([0, 82, 73, 83, 85, 83, 65, 86, 69, 0, 8]);
const magicStreamCompressedHeader = new Uint8Array([0, 82, 73, 83, 85, 83, 65, 86, 69, 0, 9]);
const magicRisuSaveHeader = new TextEncoder().encode("RISUSAVE\0");


async function checkCompressionStreams(){
    if(!CompressionStream){
        const {makeCompressionStream} = await import('compression-streams-polyfill/ponyfill');
        //@ts-expect-error polyfill CompressionStream type is incompatible with globalThis.CompressionStream
        globalThis.CompressionStream = makeCompressionStream(TransformStream);
    }
    if(!DecompressionStream){
        const {makeDecompressionStream} = await import('compression-streams-polyfill/ponyfill');
        //@ts-expect-error polyfill DecompressionStream type is incompatible with globalThis.DecompressionStream
        globalThis.DecompressionStream = makeDecompressionStream(TransformStream);
    }
}

export function encodeRisuSaveLegacy(data:any, compression:'noCompression'|'compression' = 'noCompression'){
    let encoded:Uint8Array = packr.encode(data)
    if(compression === 'compression'){
        encoded = fflate.compressSync(encoded)
        const result = new Uint8Array(encoded.length + magicCompressedHeader.length);
        result.set(magicCompressedHeader, 0)
        result.set(encoded, magicCompressedHeader.length)
        return result
    }
    else{
        const result = new Uint8Array(encoded.length + magicHeader.length);
        result.set(magicHeader, 0)
        result.set(encoded, magicHeader.length)
        return result
    }
}

export async function encodeRisuSaveCompressionStream(data:any) {
    await checkCompressionStreams()
    let encoded:Uint8Array = packr.encode(data)
    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();
    writer.write(encoded as any);
    writer.close();
    const buf = await new Response(cs.readable).arrayBuffer()
    const result = new Uint8Array(new Uint8Array(buf).length + magicStreamCompressedHeader.length);
    result.set(magicStreamCompressedHeader, 0)
    result.set(new Uint8Array(buf), magicStreamCompressedHeader.length)
    return result
}

export type toSaveType = {
    character: string[];
    chat: [string, string][];
    root: boolean;
    botPreset: boolean;
    modules: boolean;
    loadouts: boolean;
    plugins: boolean;
    pluginCustomStorage: boolean;
}

enum RisuSaveType {
    CONFIG = 0,
    ROOT = 1,
    CHARACTER_WITH_CHAT = 2,
    CHAT = 3,
    BOTPRESET = 4,
    MODULES = 5,
    REMOTE = 6,
    CHARACTER_WITHOUT_CHAT = 7,
    ROOT_COMPONENT = 8,
    PLUGINS = 9,
    LOADOUTS = 10,
    PLUGIN_STORAGE = 11,
}

type EncodeBlockArg = {
    compression:boolean
    data:string
    type:RisuSaveType
    name:string
    cache?:boolean
    skipRemoteSaving?:boolean
}

type EncodeBlockOption = {
    remote: 'none'|'prefer'|'force'
}

const risuSaveCacheMap = new Map<string, {type: RisuSaveType, data: string, name: string}>();
export class RisuSaveEncoder {

    private blocks: { [key: string]: Uint8Array } = {};
    private compression: boolean = false;
    private characterHashes: { [key: string]: number } = {};

    async init(data:Database,arg:{
        compression?: boolean,
        skipRemoteSavingOnCharacters?: boolean
    } = {}){
        const {
            compression = false,
            skipRemoteSavingOnCharacters = true
        } = arg;
        this.compression = compression;
        let obj:Record<any,any> = {}
        let keys = Object.keys(data)
        for(const key of keys){
            if(
                key !== 'characters' && key !== 'botPresets' && key !== 'modules' &&
                key !== 'loadouts' && key !== 'plugins' && key !== 'pluginCustomStorage'
            ){
                obj[key] = data[key]
            }
        }
        this.blocks['root'] = await this.encodeBlock({
            compression,
            data: JSON.stringify(obj),
            type: RisuSaveType.ROOT,
            name: 'root'
        });
        this.blocks['preset'] = await this.encodeBlock({
            compression,
            data: JSON.stringify(data.botPresets),
            type: RisuSaveType.BOTPRESET,
            name: 'preset'
        });
        this.blocks['modules'] = await this.encodeBlock({
            compression,
            data: JSON.stringify(data.modules),
            type: RisuSaveType.MODULES,
            name: 'modules'
        });
        this.blocks['loadouts'] = await this.encodeBlock({
            compression,
            data: JSON.stringify(data.loadouts),
            type: RisuSaveType.LOADOUTS,
            name: 'loadouts'
        });
        this.blocks['plugins'] = await this.encodeBlock({
            compression,
            data: JSON.stringify(data.plugins),
            type: RisuSaveType.PLUGINS,
            name: 'plugins'
        });
        this.blocks['pluginStorage'] = await this.encodeBlock({
            compression,
            data: JSON.stringify(data.pluginCustomStorage),
            type: RisuSaveType.PLUGIN_STORAGE,
            name: 'pluginStorage'
        });
        this.characterHashes = {}
        for( const character of data.characters) {
            this.blocks[character.chaId] = await this.encodeBlock({
                compression,
                data: JSON.stringify(character),
                type: RisuSaveType.CHARACTER_WITH_CHAT,
                name: character.chaId,
                skipRemoteSaving: skipRemoteSavingOnCharacters
            }, {
                remote: 'prefer'
            });
            this.characterHashes[character.chaId] = calculateHash(normalizeJSON(character))
        }
        this.blocks['config'] = await this.encodeBlock({
            compression,
            data: JSON.stringify({
                version: 1
            }),
            type: RisuSaveType.CONFIG,
            name: "config"
        })
    }

    async set(data:Database, toSave:toSaveType){
        let obj:Record<any,any> = {}
        let keys = Object.keys(data)
        for(const key of keys){
            if(
                key !== 'characters' && key !== 'botPresets' && key !== 'modules' &&
                key !== 'loadouts' && key !== 'plugins' && key !== 'pluginCustomStorage'
            ){
                obj[key] = data[key]
            }
        }

        const savedId = new Set<string>();
        for(const character of data.characters) {
            if (!character?.chaId) {
                continue
            }
            const chaId = character.chaId
            savedId.add(chaId)
            const index = toSave.character.indexOf(chaId);
            const currentHash = calculateHash(normalizeJSON(character))
            const hasChanged = this.characterHashes[chaId] !== currentHash

            if (index !== -1 || hasChanged || !this.blocks[chaId]) {
                this.blocks[character.chaId] = await this.encodeBlock({
                    compression: this.compression,
                    data: JSON.stringify(character),
                    type: RisuSaveType.CHARACTER_WITH_CHAT,
                    name: character.chaId
                }, {
                    remote: 'prefer'
                });
                this.characterHashes[chaId] = currentHash
                if (index !== -1) {
                    toSave.character.splice(index, 1);
                }
            }
        }
        if(toSave.character.length > 0){
            console.log(`Deleting character data: ${toSave.character.join(', ')}`);
            //probably deleted characters
            for(const chaId of toSave.character){
                if(!savedId.has(chaId)){
                    delete this.blocks[chaId];
                    delete this.characterHashes[chaId];
                }
            }
        }

        // Ensure stale character blocks are always removed even when deletion wasn't tracked in toSave.
        // This prevents deleted characters from being resurrected after full-write fallback.
        const currentCharacterIds = new Set<string>((data.characters ?? []).map((character) => character?.chaId).filter(Boolean));
        for (const key of Object.keys(this.blocks)) {
            if (key === 'root' || key === 'preset' || key === 'modules' || key === 'config'
                || key === 'loadouts' || key === 'plugins' || key === 'pluginStorage') {
                continue;
            }
            if (!currentCharacterIds.has(key)) {
                delete this.blocks[key];
                delete this.characterHashes[key];
            }
        }

        if(toSave.botPreset){
            this.blocks['preset'] = await this.encodeBlock({
                compression: this.compression,
                data: JSON.stringify(data.botPresets),
                type: RisuSaveType.BOTPRESET,
                name: 'preset'
            });
        }
        if(toSave.modules){
            this.blocks['modules'] = await this.encodeBlock({
                compression: this.compression,
                data: JSON.stringify(data.modules),
                type: RisuSaveType.MODULES,
                name: 'modules'
            });
        }

        if(toSave.loadouts){
            this.blocks['loadouts'] = await this.encodeBlock({
                compression: this.compression,
                data: JSON.stringify(data.loadouts),
                type: RisuSaveType.LOADOUTS,
                name: 'loadouts'
            });
        }

        if(toSave.pluginCustomStorage){
            this.blocks['pluginStorage'] = await this.encodeBlock({
                compression: this.compression,
                data: JSON.stringify(data.pluginCustomStorage),
                type: RisuSaveType.PLUGIN_STORAGE,
                name: 'pluginStorage'
            });
        }

        if(toSave.plugins){
            this.blocks['plugins'] = await this.encodeBlock({
                compression: this.compression,
                data: JSON.stringify(data.plugins),
                type: RisuSaveType.PLUGINS,
                name: 'plugins'
            });
        }

        obj["__directory"] = Object.keys(this.blocks).filter(key => key !== 'root');
        this.blocks['root'] = await this.encodeBlock({
            compression: this.compression,
            data: JSON.stringify(obj),
            type: RisuSaveType.ROOT,
            name: 'root'
        });
    }

    encode(arg:{
        compression?: boolean
    } = {}){
        if(!this.blocks['config']){
            return null
        }
        let totalLength = 0
        for(const key in this.blocks){
            totalLength += this.blocks[key].length;
        }
        totalLength += magicRisuSaveHeader.length;
        const arrayBuf = new ArrayBuffer(totalLength);
        const view = new Uint8Array(arrayBuf);
        let offset = 0;
        view.set(magicRisuSaveHeader, offset);
        offset += magicRisuSaveHeader.length;
        for(const key in this.blocks){
            view.set(this.blocks[key], offset);
            offset += this.blocks[key].length;
        }
        console.log(Object.keys(this.blocks).length, 'blocks encoded');
        return arrayBuf;
    }

    async encodeBlock(arg:EncodeBlockArg, option:EncodeBlockOption = { remote: 'none' }){
        if(
            option.remote === 'force' ||
            (option.remote === 'prefer' && !disableRemoteSaving())
        ){
            return await this.encodeRemoteBlock(arg);
        }
        return await this.encodeRawBlock(arg);
    }

    async encodeRawBlock(arg:EncodeBlockArg){
        let databuf: Uint8Array;
        const cacheBlock = arg.cache ?? true;
        if(arg.compression){
            await checkCompressionStreams();
            const cs = new CompressionStream('gzip');
            const writer = cs.writable.getWriter();
            writer.write(new TextEncoder().encode(arg.data));
            writer.close();
            const compressedData = await new Response(cs.readable).arrayBuffer();
            databuf = (new Uint8Array(compressedData));
        }
        else{
            databuf = (new TextEncoder().encode(arg.data));
        }
        const nameBuf = new TextEncoder().encode(arg.name);
        const lengthBuf = new ArrayBuffer(4);
        new Uint32Array(lengthBuf)[0] = databuf.length;
        const arrayBuf = new ArrayBuffer(2 + 1 + nameBuf.length + 4 + databuf.length);
        const buf = new Uint8Array(arrayBuf);
        buf.set(new Uint8Array([arg.type, arg.compression ? 1 : 0]), 0);
        buf.set(new Uint8Array([nameBuf.length]), 2);
        buf.set(nameBuf, 3);
        buf.set(new Uint8Array(lengthBuf), 3 + nameBuf.length);
        buf.set(databuf, 7 + nameBuf.length);
        risuSaveCacheMap.set(`risuSaveBlock_${arg.name}`, {
            type: arg.type,
            data: arg.data,
            name: arg.name,
        });
        return buf;
    }

    async encodeRemoteBlock(arg:EncodeBlockArg){
        console.log(`Encoding remote block: ${arg.name}`);
        const encoded = new TextEncoder().encode(arg.data);
        const fileName = `remotes/${arg.name}.local.bin`

        if(arg.skipRemoteSaving && checkedRemoteExistence.has(arg.name) === false){
            let fileExists = false;
            const stored = await forageStorage.keys();
            if(stored.includes(fileName)){
                fileExists = true;
            }
            if(!fileExists){
                console.log(`Remote file ${fileName} does not exist, disabling skipRemoteSaving for this block.`);
                arg.skipRemoteSaving = false;
            }
            checkedRemoteExistence.add(arg.name);
        }

        if(!arg.skipRemoteSaving){
            await forageStorage.setItem(fileName, encoded);
        }
        return await this.encodeBlock({
            compression: false,
            data: JSON.stringify({
                v: 1,
                type: arg.type,
                name: arg.name,
            }),
            type: RisuSaveType.REMOTE,
            name: arg.name
        });
    }
}

export class RisuSaveDecoder {
    private blocks: {
        name: string;
        type: RisuSaveType;
        compression: boolean;
        content: string;
    }[] = []
    async decode(data: Uint8Array): Promise<Database> {
        console.log('Decoding RisuSave data');
        let offset = magicRisuSaveHeader.length;
        //@ts-expect-error Database has required fields, but we initialize empty and populate incrementally during decode
        let db:Database = {}
        const loadedBlocks = new Set<string>();
        while (offset < data.length) {
            try {
                const type = data[offset];
                const compression = data[offset + 1] === 1;
                offset += 2;

                const nameLength = data[offset];
                offset += 1;
                const name = new TextDecoder().decode(data.subarray(offset, offset + nameLength));
                offset += nameLength;

                const newArrayBuf = new ArrayBuffer(4);
                const lengthSubUint8Buf = data.slice(offset, offset + 4);
                new Uint8Array(newArrayBuf).set(lengthSubUint8Buf);
                const length = new Uint32Array(newArrayBuf)[0];
                offset += 4;

                let blockData = data.subarray(offset, offset + length);
                offset += length;

                if (compression) {
                    //decode using DecompressionStream
                    await checkCompressionStreams();
                    const cs = new DecompressionStream('gzip');
                    const writer = cs.writable.getWriter();
                    writer.write(blockData as any);
                    writer.close();
                    const buf = await new Response(cs.readable).arrayBuffer();
                    blockData = new Uint8Array(buf);
                }

                loadedBlocks.add(name);
                this.blocks.push({
                    name,
                    type,
                    compression,
                    content: new TextDecoder().decode(blockData)
                })   
            } catch (error) {
                continue
            }
        }
        console.log('blocks',this.blocks)
        let directory: string[] = []
        for(let i = 0; i < this.blocks.length; i++){
            const key = i;
            try {
            switch(this.blocks[key].type){
                case RisuSaveType.ROOT:{
                    const rootData = JSON.parse(this.blocks[key].content);
                    for(const rootKey in rootData){
                        if(!db[rootKey] && !rootKey.startsWith('__')){
                            db[rootKey] = rootData[rootKey];
                        }
                        if(rootKey === '__directory'){
                            directory = rootData[rootKey];
                            console.log('RisuSave directory:', directory);
                            for(const dirKey of directory){
                                if(!loadedBlocks.has(dirKey)){
                                    try {
                                        console.log(`Loading directory block ${dirKey} from cache`);
                                        const dirData:{
                                            type:RisuSaveType
                                            data:string
                                            name:string
                                        } = risuSaveCacheMap.get(`risuSaveBlock_${dirKey}`) ?? null;

                                        if(dirData){
                                            this.blocks.push({
                                                name: dirData.name,
                                                type: dirData.type,
                                                compression: false,
                                                content: dirData.data
                                            });
                                            loadedBlocks.add(dirKey);
                                        }
                                    } catch (error) {
                                        console.error(`Error loading directory block ${dirKey}:`, error);
                                    }
                                }
                            }
                        }
                    }
                    break;
                }
                case RisuSaveType.CHARACTER_WITH_CHAT:
                case RisuSaveType.CHARACTER_WITHOUT_CHAT:{
                    db.characters ??= [];
                    const character = JSON.parse(this.blocks[key].content);
                    db.characters.push(character);
                    break
                }
                case RisuSaveType.BOTPRESET:{
                    db.botPresets = JSON.parse(this.blocks[key].content);
                    break;
                }
                case RisuSaveType.MODULES:{
                    db.modules = JSON.parse(this.blocks[key].content);
                    break;
                }
                case RisuSaveType.CONFIG:{
                    //ignore for now
                    break;
                }
                case RisuSaveType.PLUGINS:{
                    db.plugins = JSON.parse(this.blocks[key].content);
                    break;
                }
                case RisuSaveType.LOADOUTS:{
                    db.loadouts = JSON.parse(this.blocks[key].content);
                    break;
                }
                case RisuSaveType.PLUGIN_STORAGE:{
                    db.pluginCustomStorage = JSON.parse(this.blocks[key].content);
                    break;
                }
                case RisuSaveType.REMOTE:{
                    const remoteInfo:{
                        v:number
                        type:RisuSaveType
                        name:string
                    } = JSON.parse(this.blocks[key].content);
                    const fileName = `remotes/${remoteInfo.name}.local.bin`
                    let remoteData:Uint8Array|null = null
                    const stored = await forageStorage.getItem(fileName);
                    if(stored){
                        remoteData = stored as Uint8Array;
                    }

                    if(!remoteData){
                        console.warn(`Remote file ${fileName} not found.`);
                        break;
                    }
                    const decoded = new TextDecoder().decode(remoteData)

                    //add to blocks for further processing
                    this.blocks.push({
                        name: remoteInfo.name,
                        type: remoteInfo.type,
                        compression: false,
                        content: decoded
                    });
                    break;
                }
                case RisuSaveType.ROOT_COMPONENT:{
                    const componentData:{
                        data:any
                        key:string
                    } = JSON.parse(this.blocks[key].content);
                    db[componentData.key] = componentData.data;
                    break;
                }
                default:{
                    console.warn(`Not Implemented RisuSaveType: ${this.blocks[key].type} for ${this.blocks[key].name}`);
                }
            }
            } catch (error) {
                console.error(`Error processing block ${this.blocks[key].name}:`, error);

                if(this.blocks[key].type === RisuSaveType.ROOT){
                    throw new Error('Failed to decode root block, cannot proceed with decoding RisuSave data');
                }
            }
        }
        //to fix botpreset bugs
        if(!Array.isArray(db.botPresets) || db.botPresets.length === 0){
            db.botPresets = [presetTemplate]
            db.botPresetsId = 0
        }
        console.log('Decoded RisuSave data', db);
        return db;
    }
}

export async function decodeRisuSave(data:Uint8Array){
    try {
        const header = checkHeader(data)
        switch(header){
            case "compressed":
                data = data.slice(magicCompressedHeader.length)
                return decode(fflate.decompressSync(data))
            case "raw":
                data = data.slice(magicHeader.length)
                return unpackr.decode(data)
            case "stream":{
                await checkCompressionStreams()
                data = data.slice(magicStreamCompressedHeader.length)
                const cs = new DecompressionStream('gzip');
                const writer = cs.writable.getWriter();
                writer.write(data as any);
                writer.close();
                const buf = await new Response(cs.readable).arrayBuffer()
                return unpackr.decode(new Uint8Array(buf))
            }
            case "risusave":{
                const decoder = new RisuSaveDecoder();
                return await decoder.decode(data);
            }
        }
        return unpackr.decode(data)
    }
    catch (error) {
        console.error('Error decoding RisuSave data:', error);
        try {
            console.log('risudecode')
            const risuSaveHeader = new Uint8Array(Buffer.from("\u0000\u0000RISU",'utf-8'))
            const realData = data.subarray(risuSaveHeader.length)
            const dec = unpackr.decode(realData)
            return dec   
        } catch (error) {
            const buf = Buffer.from(fflate.decompressSync(Buffer.from(data)))
            try {
                return JSON.parse(buf.toString('utf-8'))                            
            } catch (error) {
                return unpackr.decode(buf)
            }
        }
    }
}

function checkHeader(data: Uint8Array) {

    let header:'none'|'compressed'|'raw'|'stream'|'risusave' = 'raw'

    if (data.length < magicHeader.length) {
      return false;
    }
  
    for (let i = 0; i < magicHeader.length; i++) {
      if (data[i] !== magicHeader[i]) {
        header = 'none'
        break
      }
    }

    if(header === 'none'){
        header = 'compressed'
        for (let i = 0; i < magicCompressedHeader.length; i++) {
            if (data[i] !== magicCompressedHeader[i]) {
                header = 'none'
                break
            }
        }
    }

    if(header === 'none'){
        header = 'stream'
        for (let i = 0; i < magicStreamCompressedHeader.length; i++) {
            if (data[i] !== magicStreamCompressedHeader[i]) {
                header = 'none'
                break
            }
        }
    }

    if(header === 'none'){
        header = 'risusave'
        for (let i = 0; i < magicRisuSaveHeader.length; i++) {
            if (data[i] !== magicRisuSaveHeader[i]) {
                header = 'none'
                break
            }
        }
    }

    // All bytes matched
    return header;
}

// --- Hash & normalization utilities for patch-based sync ---

const PRIME_MULTIPLIER = 31;

const SEED_OBJECT = 17;
const SEED_ARRAY = 19;
const SEED_STRING = 23;
const SEED_NUMBER = 29;
const SEED_BOOLEAN = 31;
const SEED_NULL = 37;

export function calculateHash(node: any): number {
    if (node === null || node === undefined) return SEED_NULL;
    switch (typeof node) {
        case 'object':
            if (Array.isArray(node)) {
                let arrayHash = SEED_ARRAY;
                for (const item of node)
                    arrayHash = (Math.imul(arrayHash, PRIME_MULTIPLIER) + calculateHash(item)) >>> 0;
                return arrayHash;
            } else {
                // Independent of key order
                let objectHash = SEED_OBJECT;
                for (const key in node)
                    objectHash += (Math.imul(calculateHash(key), PRIME_MULTIPLIER) + calculateHash(node[key]));
                return objectHash >>> 0;
            }
        case 'string':
            let strHash = 2166136261;
            for (let i = 0; i < node.length; i++)
                strHash = Math.imul(strHash ^ node.charCodeAt(i), 16777619);
            return Math.imul(SEED_STRING, PRIME_MULTIPLIER) + (strHash >>> 0);
        case 'number':
            let numHash;
            if (Number.isInteger(node) && node >= -2147483648 && node <= 2147483647)
                numHash = node >>> 0;
            else {
                const str = node.toString();
                numHash = 2166136261;
                for (let i = 0; i < str.length; i++)
                    numHash = Math.imul(numHash ^ str.charCodeAt(i), 16777619);
                numHash = numHash >>> 0;
            }
            return Math.imul(SEED_NUMBER, PRIME_MULTIPLIER) + numHash;
        case 'boolean':
            return Math.imul(SEED_BOOLEAN, PRIME_MULTIPLIER) + (node ? 1 : 0);

        default:
            return 0;
    }
}

export function normalizeJSON(value: any, seen?: WeakSet<object>): any {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'object') {
        if (typeof value === 'number' && !isFinite(value)) return null;
        if (typeof value === 'function' ||
            typeof value === 'symbol' ||
            typeof value === 'bigint')
            return undefined;
        return value;
    }
    if (value instanceof Date) return value.toISOString();
    if (value instanceof RegExp || value instanceof Error) return {};
    if (!seen) seen = new WeakSet();
    if (seen.has(value)) {
        console.warn('[normalizeJSON] Circular reference detected and replaced with null')
        return null;
    }
    seen.add(value);
    if (Array.isArray(value)) {
        const result: any[] = [];
        for (const item of value) {
            if (item === undefined) {
                result.push(null);
            } else {
                const normalized = normalizeJSON(item, seen);
                result.push(normalized === undefined ? null : normalized);
            }
        }
        return result;
    }
    const result: Record<string, any> = {};
    for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
            const propValue = value[key];
            if (propValue !== undefined) {
                const normalized = normalizeJSON(propValue, seen);
                if (normalized !== undefined)
                    result[key] = normalized;
            }
        }
    }
    return result;
}

export class RisuSavePatcher {
    private lastSyncedDb: any;
    private hashBlocks: { [key: string]: number } = {};

    hash(): string {
        this.hashBlocks['characters'] = SEED_ARRAY;
        for (const character of this.lastSyncedDb.characters) {
            this.hashBlocks['characters'] = (Math.imul(this.hashBlocks['characters'], PRIME_MULTIPLIER) + this.hashBlocks[character.chaId]) >>> 0;
        }

        const keys = Object.keys(this.lastSyncedDb)
        let rootHash = SEED_OBJECT;
        for (const key of keys) {
            rootHash += (Math.imul(calculateHash(key), PRIME_MULTIPLIER) + this.hashBlocks[key])
        }
        return (rootHash >>> 0).toString(16);
    }

    async init(data: any) {
        this.lastSyncedDb = normalizeJSON(data);
        if (!Array.isArray(this.lastSyncedDb.characters)) {
            this.lastSyncedDb.characters = [];
        }
        this.hashBlocks = {};

        const keys = Object.keys(this.lastSyncedDb)

        for (const key of keys) {
            if (key !== 'characters') {
                this.hashBlocks[key] = calculateHash(this.lastSyncedDb[key]);
            }
        }

        for (const character of this.lastSyncedDb.characters) {
            this.hashBlocks[character.chaId] = calculateHash(character);
        }
    }

    async set(data: any, toSave: toSaveType): Promise<{ patch: any[]; expectedHash: string }> {
        const { compare } = await import('fast-json-patch')
        const expectedHash: string = this.hash();
        const patch: any[] = []

        const {
            characters: lastCharacters = [],
            botPresets: lastBotPresets,
            modules: lastModules,
            ...lastRoot
        } = this.lastSyncedDb

        const {
            characters: curCharacters = [],
            botPresets: curBotPresets,
            modules: curModules,
            ...curRoot
        } = data

        const normRoot = normalizeJSON(curRoot)
        patch.push(...compare(lastRoot, normRoot))
        const keys = Object.keys(normRoot)
        for (const key of keys) {
            this.hashBlocks[key] = calculateHash(normRoot[key]);
        }

        if (toSave.botPreset) {
            const normBotPresets = normalizeJSON(curBotPresets)
            patch.push(...compare({ botPresets: lastBotPresets }, { botPresets: normBotPresets }))
            this.hashBlocks['botPresets'] = calculateHash(normBotPresets);
            this.lastSyncedDb.botPresets = normBotPresets;
        }

        if (toSave.modules) {
            const normModules = normalizeJSON(curModules)
            patch.push(...compare({ modules: lastModules }, { modules: normModules }))
            this.hashBlocks['modules'] = calculateHash(normModules);
            this.lastSyncedDb.modules = normModules;
        }

        // Detect structural changes (additions, deletions, reordering)
        const lastIds = lastCharacters.map((c: any) => c?.chaId)
        const curIds = curCharacters.map((c: any) => c?.chaId)
        const structuralChange = lastIds.length !== curIds.length ||
            lastIds.some((id: string, i: number) => id !== curIds[i])

        if (structuralChange) {
            // Structural change → replace entire characters array (safe for deletions/additions)
            const normChars = normalizeJSON(curCharacters)
            patch.push({ op: 'replace', path: '/characters', value: normChars })
            // Update all character hashes
            for (const lastId of lastIds) {
                if (lastId) delete this.hashBlocks[lastId];
            }
            for (const char of normChars) {
                if (char?.chaId) {
                    this.hashBlocks[char.chaId] = calculateHash(char);
                }
            }
            this.lastSyncedDb.characters = normChars;
        } else {
            // Same structure → per-character field-level diff (efficient)
            for (let i = 0; i < curCharacters.length; i++) {
                const lastChar = lastCharacters[i]
                const curChar = curCharacters[i]
                const normChar = normalizeJSON(curChar)
                const curCharId = curChar?.chaId
                const curCharHash = curCharId ? calculateHash(normChar) : undefined
                const trackedBySave = toSave.character.includes(curCharId ?? '')
                const changedByHash = !!(curCharId && curCharHash !== this.hashBlocks[curCharId])

                if (trackedBySave || changedByHash) {
                    let charPatch = compare(lastChar, normChar).map((v) => {
                        v.path = `/characters/${i}` + v.path;
                        return v;
                    })
                    patch.push(...charPatch);
                    this.hashBlocks[normChar.chaId] = curCharHash ?? calculateHash(normChar);
                    this.lastSyncedDb.characters[i] = normChar;
                }
            }
        }

        this.lastSyncedDb = {
            characters: this.lastSyncedDb.characters,
            botPresets: this.lastSyncedDb.botPresets,
            modules: this.lastSyncedDb.modules,
            ...normRoot
        }

        return {
            patch,
            expectedHash
        }
    }
}
