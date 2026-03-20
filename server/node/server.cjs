const express = require('express');
const app = express();
const path = require('path');
const compression = require('compression');
const htmlparser = require('node-html-parser');
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('fs');
const fs = require('fs/promises')
const nodeCrypto = require('crypto')
const { kvGet, kvSet, kvDel, kvList,
        charGet, charSet, charDel, charList,
        chatGet, chatSet, chatDel, chatList,
        settingsGet, settingsSet,
        presetGet, presetSet, presetDel, presetList,
        moduleGet, moduleSet, moduleDel, moduleList,
        kvDelPrefix, kvListWithSizes, kvSize, kvGetUpdatedAt, clearEntities, checkpointWal,
        db: sqliteDb } = require('./db.cjs');

function shouldCompress(req, res) {
    const contentType = String(res.getHeader('Content-Type') || '').toLowerCase();
    if (contentType.includes('text/event-stream')) {
        return false;
    }
    // Already-compressed media formats: gzip adds CPU cost with ~0% size gain
    if (contentType.startsWith('image/') || contentType.startsWith('video/') || contentType.startsWith('audio/')) {
        return false;
    }
    if (contentType.includes('application/octet-stream')) {
        return true;
    }
    return compression.filter(req, res);
}

app.use(compression({
    filter: shouldCompress,
}));
// Vite 산출물은 해시 파일명이므로 /assets는 장기 캐시 안전
app.use('/assets', express.static(path.join(process.cwd(), 'dist/assets'), {
    maxAge: '1y',
    immutable: true,
}));
app.use(express.static(path.join(process.cwd(), 'dist'), {index: false, maxAge: 0}));
app.use(express.json({ limit: '100mb' }));
app.use(express.raw({ type: 'application/octet-stream', limit: '100mb' }));
app.use(express.text({ limit: '100mb' }));
const {pipeline} = require('stream/promises')
const https = require('https');
const sslPath = path.join(process.cwd(), 'server/node/ssl/certificate');
const hubURL = 'https://sv.risuai.xyz';

let password = ''
let knownPublicKeysHashes = []

// Ensure /save/ exists for password file and migration source
const savePath = path.join(process.cwd(), "save")
if(!existsSync(savePath)){
    mkdirSync(savePath)
}

const passwordPath = path.join(process.cwd(), 'save', '__password')
if(existsSync(passwordPath)){
    password = readFileSync(passwordPath, 'utf-8')
}

const authCodePath = path.join(process.cwd(), 'save', '__authcode')
const hexRegex = /^[0-9a-fA-F]+$/;
const BACKUP_IMPORT_MAX_BYTES = Number(process.env.RISU_BACKUP_IMPORT_MAX_BYTES ?? '0');
const BACKUP_ENTRY_NAME_MAX_BYTES = 1024;
// Minimum free disk space headroom multiplier: require 2× the backup size to be free
const BACKUP_DISK_HEADROOM = 2;

let importInProgress = false;

// ── Update check ─────────────────────────────────────────────────────────────
const UPDATE_CHECK_DISABLED = process.env.RISU_UPDATE_CHECK === 'false';
const UPDATE_CHECK_REPO = process.env.RISU_UPDATE_REPO || '';
const UPDATE_CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

const currentVersion = (() => {
    try {
        const pkg = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
        return pkg.version || '0.0.0';
    } catch { return '0.0.0'; }
})();

let latestReleaseCache = null;

function compareVersions(a, b) {
    const pa = a.replace(/^v/, '').split('.').map(Number);
    const pb = b.replace(/^v/, '').split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        const diff = (pa[i] || 0) - (pb[i] || 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

function parseReleaseMeta(body) {
    const meta = { updateType: 'optional', minVersion: null };
    if (!body) return meta;
    const typeMatch = body.match(/<!--\s*RISU_UPDATE:\s*(\w+)\s*-->/);
    if (typeMatch) meta.updateType = typeMatch[1];
    const minMatch = body.match(/<!--\s*RISU_MIN_VERSION:\s*([\d.]+)\s*-->/);
    if (minMatch) meta.minVersion = minMatch[1];
    return meta;
}

async function fetchLatestRelease() {
    if (UPDATE_CHECK_DISABLED || !UPDATE_CHECK_REPO) return null;
    try {
        const url = `https://api.github.com/repos/${UPDATE_CHECK_REPO}/releases/latest`;
        const res = await fetch(url, {
            headers: {
                'Accept': 'application/vnd.github+json',
                'User-Agent': 'RisuAI-NodeOnly/' + currentVersion,
            },
        });
        if (!res.ok) return null;
        const data = await res.json();
        const meta = parseReleaseMeta(data.body);
        const latestVer = (data.tag_name || '').replace(/^v/, '');
        const hasUpdate = compareVersions(latestVer, currentVersion) > 0;
        let severity = 'none';
        if (hasUpdate) {
            severity = meta.updateType === 'required' ? 'required' : 'optional';
            if (meta.minVersion && compareVersions(currentVersion, meta.minVersion) < 0) {
                severity = 'outdated';
            }
        }
        latestReleaseCache = {
            currentVersion,
            latestVersion: latestVer,
            hasUpdate,
            severity,
            releaseUrl: data.html_url || '',
            releaseName: data.name || '',
            publishedAt: data.published_at || '',
            checkedAt: Date.now(),
        };
        if (hasUpdate) {
            console.log(`[Update] New version available: v${latestVer} (current: v${currentVersion}, ${severity})`);
        }
        return latestReleaseCache;
    } catch (e) {
        console.error('[Update] Failed to check for updates:', e.message);
        return null;
    }
}

// ── Session store for direct asset URL auth (F-0) ──────────────────────────
// <img src="/api/asset/..."> cannot send custom headers, so we use a session
// cookie issued after initial JWT auth. Single-user environment: Map is fine.
const sessions = new Map() // token → expiresAt (ms)

function parseSessionCookie(req) {
    const cookieHeader = req.headers.cookie || ''
    for (const part of cookieHeader.split(';')) {
        const eq = part.indexOf('=')
        if (eq === -1) continue
        if (part.slice(0, eq).trim() === 'risu-session') return part.slice(eq + 1).trim()
    }
    return null
}

function sessionAuthMiddleware(req, res, next) {
    const token = parseSessionCookie(req)
    if (token && (sessions.get(token) ?? 0) > Date.now()) return next()
    res.status(401).end()
}

// MIME detection by magic bytes (fallback when key has no extension)
function detectMime(buf) {
    if (!buf || buf.length < 12) return 'application/octet-stream'
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
    if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg'
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif'
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
        buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp'
    if (buf[0] === 0x1a && buf[1] === 0x45) return 'video/webm'
    if (buf.length >= 8 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) return 'video/mp4'
    return 'application/octet-stream'
}
const ASSET_EXT_MIME = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', webp: 'image/webp',
    mp4: 'video/mp4', webm: 'video/webm',
    mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav',
}

async function checkDiskSpace(requiredBytes) {
    try {
        const saveDir = path.join(process.cwd(), 'save');
        const stats = await fs.statfs(saveDir);
        const availableBytes = stats.bavail * stats.bsize;
        return { ok: availableBytes >= requiredBytes, available: availableBytes };
    } catch {
        // statfs unavailable on this platform — skip check
        return { ok: true, available: -1 };
    }
}

function isHex(str) {
    return hexRegex.test(str.toUpperCase().trim()) || str === '__password';
}

async function hashJSON(json){
    const hash = nodeCrypto.createHash('sha256');
    hash.update(JSON.stringify(json));
    return hash.digest('hex');
}

function encodeBackupEntry(name, data) {
    const encodedName = Buffer.from(name, 'utf-8');
    const nameLength = Buffer.allocUnsafe(4);
    nameLength.writeUInt32LE(encodedName.length, 0);
    const dataLength = Buffer.allocUnsafe(4);
    dataLength.writeUInt32LE(data.length, 0);
    return Buffer.concat([nameLength, encodedName, dataLength, data]);
}

function writeBackupEntry(res, name, data) {
    const encodedName = Buffer.from(name, 'utf-8');
    const header = Buffer.allocUnsafe(4);
    header.writeUInt32LE(encodedName.length, 0);
    res.write(header);
    res.write(encodedName);
    header.writeUInt32LE(data.length, 0);
    res.write(header);
    res.write(data);
}

function isInvalidBackupPathSegment(name) {
    return (
        !name ||
        name.includes('\0') ||
        name.includes('\\') ||
        name.startsWith('/') ||
        name.includes('../') ||
        name.includes('/..') ||
        name === '.' ||
        name === '..'
    );
}

function resolveBackupStorageKey(name) {
    if (Buffer.byteLength(name, 'utf-8') > BACKUP_ENTRY_NAME_MAX_BYTES) {
        throw new Error(`Backup entry name too long: ${name.slice(0, 64)}`);
    }

    if (name === 'database.risudat') {
        return 'database/database.bin';
    }

    if (
        name.startsWith('inlay/') ||
        name.startsWith('inlay_thumb/') ||
        name.startsWith('inlay_meta/')
    ) {
        if (isInvalidBackupPathSegment(name)) {
            throw new Error(`Invalid backup entry name: ${name}`);
        }
        return name;
    }

    if (isInvalidBackupPathSegment(name) || name !== path.basename(name)) {
        throw new Error(`Invalid asset backup entry name: ${name}`);
    }

    return `assets/${name}`;
}

function parseBackupChunk(buffer, onEntry) {
    let offset = 0;
    while (offset + 4 <= buffer.length) {
        const nameLength = buffer.readUInt32LE(offset);
        if (offset + 4 + nameLength > buffer.length) {
            break;
        }
        const nameStart = offset + 4;
        const nameEnd = nameStart + nameLength;
        const name = buffer.subarray(nameStart, nameEnd).toString('utf-8');
        if (nameEnd + 4 > buffer.length) {
            break;
        }
        const dataLength = buffer.readUInt32LE(nameEnd);
        const dataStart = nameEnd + 4;
        const dataEnd = dataStart + dataLength;
        if (dataEnd > buffer.length) {
            break;
        }
        onEntry(name, buffer.subarray(dataStart, dataEnd));
        offset = dataEnd;
    }
    return buffer.subarray(offset);
}

app.get('/', async (req, res, next) => {

    const clientIP = req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress || 'Unknown IP';
    const timestamp = new Date().toISOString();
    console.log(`[Server] ${timestamp} | Connection from: ${clientIP}`);
    
    try {
        const mainIndex = await fs.readFile(path.join(process.cwd(), 'dist', 'index.html'))
        const root = htmlparser.parse(mainIndex)
        const head = root.querySelector('head')
        head.innerHTML = `<script>globalThis.__NODE__ = true</script>` + head.innerHTML
        
        res.send(root.toString())
    } catch (error) {
        console.log(error)
        next(error)
    }
})

async function checkAuth(req, res, returnOnlyStatus = false){
    try {
        const authHeader = req.headers['risu-auth'];

        if(!authHeader){
            console.log('No auth header')
            if(returnOnlyStatus){
                return false;
            }
            res.status(400).send({
                error:'No auth header'
            });
            return false
        }


        //jwt token
        const [
            jsonHeaderB64,
            jsonPayloadB64,
            signatureB64,
        ] = authHeader.split('.');

        //alg, typ
        const jsonHeader = JSON.parse(Buffer.from(jsonHeaderB64, 'base64url').toString('utf-8'));

        //iat, exp, pub
        const jsonPayload = JSON.parse(Buffer.from(jsonPayloadB64, 'base64url').toString('utf-8'));

        //signature
        const signature = Buffer.from(signatureB64, 'base64url');

        
        //check expiration
        const now = Math.floor(Date.now() / 1000);
        if(jsonPayload.exp < now){
            console.log('Token expired')
            if(returnOnlyStatus){
                return false;
            }
            res.status(400).send({
                error:'Token Expired'
            });
            return false
        }

        //check if public key is known
        const pubKeyHash = await hashJSON(jsonPayload.pub)
        if(!knownPublicKeysHashes.includes(pubKeyHash)){
            console.log('Unknown public key')
            if(returnOnlyStatus){
                return false;
            }
            res.status(400).send({
                error:'Unknown Public Key'
            });
            return false
        }

        //check signature
        if(jsonHeader.alg !== "ES256"){
            //only support ECDSA for now
            console.log('Unsupported algorithm')
            if(returnOnlyStatus){
                return false;
            }
            res.status(400).send({
                error:'Unsupported Algorithm'
            });
            return false
        }

        const isValid = await crypto.subtle.verify(
            {
                name: 'ECDSA',
                hash: {name: 'SHA-256'},
            },
            await crypto.subtle.importKey(
                'jwk',
                jsonPayload.pub,
                {
                    name: 'ECDSA',
                    namedCurve: 'P-256',
                },
                false,
                ['verify']
            ),
            signature,
            Buffer.from(`${jsonHeaderB64}.${jsonPayloadB64}`)
        );

        if(!isValid){
            console.log('Invalid signature')
            if(returnOnlyStatus){
                return false;
            }
            res.status(400).send({
                error:'Invalid Signature'
            });
            return false
        }
        
        return true   
    } catch (error) {
        console.log(error)
        if(returnOnlyStatus){
            return false;
        }
        res.status(500).send({
            error:'Internal Server Error'
        });
        return false
    }
}

const reverseProxyFunc = async (req, res, next) => {
    if(!await checkAuth(req, res)){
        return;
    }
    
    const urlParam = req.headers['risu-url'] ? decodeURIComponent(req.headers['risu-url']) : req.query.url;

    if (!urlParam) {
        res.status(400).send({
            error:'URL has no param'
        });
        return;
    }
    const header = req.headers['risu-header'] ? JSON.parse(decodeURIComponent(req.headers['risu-header'])) : req.headers;
    if (req.headers['x-risu-tk'] && !header['x-risu-tk']) {
        header['x-risu-tk'] = req.headers['x-risu-tk'];
    }
    if (req.headers['risu-location'] && !header['risu-location']) {
        header['risu-location'] = req.headers['risu-location'];
    }
    if(!header['x-forwarded-for']){
        header['x-forwarded-for'] = req.ip
    }

    if(req.headers['authorization']?.startsWith('X-SERVER-REGISTER')){
        if(!existsSync(authCodePath)){
            delete header['authorization']
        }
        else{
            const authCode = await fs.readFile(authCodePath, {
                encoding: 'utf-8'
            })
            header['authorization'] = `Bearer ${authCode}`
        }
    }
    let originalResponse;
    try {
        let requestBody = undefined;
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            if (Buffer.isBuffer(req.body) || typeof req.body === 'string') {
                requestBody = req.body;
            }
            else if (req.body !== undefined) {
                requestBody = JSON.stringify(req.body);
            }
        }
        // make request to original server
        originalResponse = await fetch(urlParam, {
            method: req.method,
            headers: header,
            body: requestBody,
            duplex: requestBody ? 'half' : undefined
        });
        // get response body as stream
        const originalBody = originalResponse.body;
        // get response headers
        const head = new Headers(originalResponse.headers);
        head.delete('content-security-policy');
        head.delete('content-security-policy-report-only');
        head.delete('clear-site-data');
        head.delete('Cache-Control');
        head.delete('Content-Encoding');
        const headObj = {};
        for (let [k, v] of head) {
            headObj[k] = v;
        }
        // send response headers to client
        res.header(headObj);
        // send response status to client
        res.status(originalResponse.status);
        // send response body to client
        await pipeline(originalResponse.body, res);


    }
    catch (err) {
        next(err);
        return;
    }
}

const reverseProxyFunc_get = async (req, res, next) => {
    if(!await checkAuth(req, res)){
        return;
    }
    
    const urlParam = req.headers['risu-url'] ? decodeURIComponent(req.headers['risu-url']) : req.query.url;

    if (!urlParam) {
        res.status(400).send({
            error:'URL has no param'
        });
        return;
    }
    const header = req.headers['risu-header'] ? JSON.parse(decodeURIComponent(req.headers['risu-header'])) : req.headers;
    if (req.headers['x-risu-tk'] && !header['x-risu-tk']) {
        header['x-risu-tk'] = req.headers['x-risu-tk'];
    }
    if (req.headers['risu-location'] && !header['risu-location']) {
        header['risu-location'] = req.headers['risu-location'];
    }
    if(!header['x-forwarded-for']){
        header['x-forwarded-for'] = req.ip
    }
    let originalResponse;
    try {
        // make request to original server
        originalResponse = await fetch(urlParam, {
            method: 'GET',
            headers: header
        });
        // get response body as stream
        const originalBody = originalResponse.body;
        // get response headers
        const head = new Headers(originalResponse.headers);
        head.delete('content-security-policy');
        head.delete('content-security-policy-report-only');
        head.delete('clear-site-data');
        head.delete('Cache-Control');
        head.delete('Content-Encoding');
        const headObj = {};
        for (let [k, v] of head) {
            headObj[k] = v;
        }
        // send response headers to client
        res.header(headObj);
        // send response status to client
        res.status(originalResponse.status);
        // send response body to client
        await pipeline(originalResponse.body, res);
    }
    catch (err) {
        next(err);
        return;
    }
}

let accessTokenCache = {
    token: null,
    expiry: 0
}
async function getSionywAccessToken() {
    if(accessTokenCache.token && Date.now() < accessTokenCache.expiry){
        return accessTokenCache.token;
    }
    //Schema of the client data file
    // {
    //     refresh_token: string;
    //     client_id: string;
    //     client_secret: string;
    // }
    
    const clientDataPath = path.join(process.cwd(), 'save', '__sionyw_client_data.json');
    let refreshToken = ''
    let clientId = ''
    let clientSecret = ''
    if(!existsSync(clientDataPath)){
        throw new Error('No Sionyw client data found');
    }
    const clientDataRaw = readFileSync(clientDataPath, 'utf-8');
    const clientData = JSON.parse(clientDataRaw);
    refreshToken = clientData.refresh_token;
    clientId = clientData.client_id;
    clientSecret = clientData.client_secret;

    //Oauth Refresh Token Flow
    
    const tokenResponse = await fetch('account.sionyw.com/account/api/oauth/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret
        })
    })

    if(!tokenResponse.ok){
        throw new Error('Failed to refresh Sionyw access token');
    }

    const tokenData = await tokenResponse.json();

    //Update the refresh token in the client data file
    if(tokenData.refresh_token && tokenData.refresh_token !== refreshToken){
        clientData.refresh_token = tokenData.refresh_token;
        writeFileSync(clientDataPath, JSON.stringify(clientData), 'utf-8');
    }

    accessTokenCache.token = tokenData.access_token;
    accessTokenCache.expiry = Date.now() + (tokenData.expires_in * 1000) - (5 * 60 * 1000); //5 minutes early

    return tokenData.access_token;
}


async function hubProxyFunc(req, res) {
    const excludedHeaders = [
        'content-encoding',
        'content-length',
        'transfer-encoding'
    ];

    try {
        let externalURL = '';

        const pathHeader = req.headers['x-risu-node-path'];
        if (pathHeader) {
            const decodedPath = decodeURIComponent(pathHeader);
            externalURL = decodedPath;
        } else {
            const pathAndQuery = req.originalUrl.replace(/^\/hub-proxy/, '');
            externalURL = hubURL + pathAndQuery;
        }
        
        const headersToSend = { ...req.headers };
        delete headersToSend.host;
        delete headersToSend.connection;
        delete headersToSend['content-length'];
        delete headersToSend['x-risu-node-path'];

        const hubOrigin = new URL(hubURL).origin;
        headersToSend.origin = hubOrigin;

        //if Authorization header is "Server-Auth, set the token to be Server-Auth
        if(headersToSend['Authorization'] === 'X-Node-Server-Auth'){
            //this requires password auth
            if(!await checkAuth(req, res)){
                return;
            }

            headersToSend['Authorization'] = "Bearer " + await getSionywAccessToken();
            delete headersToSend['risu-auth'];
        }
        
        
        const response = await fetch(externalURL, {
            method: req.method,
            headers: headersToSend,
            body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
            redirect: 'manual',
            duplex: 'half'
        });
        
        for (const [key, value] of response.headers.entries()) {
            // Skip encoding-related headers to prevent double decoding
            if (excludedHeaders.includes(key.toLowerCase())) {
                continue;
            }
            res.setHeader(key, value);
        }
        res.status(response.status);

        if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
            const redirectUrl = response.headers.get('location');
            const newHeaders = { ...headersToSend };
            const redirectResponse = await fetch(redirectUrl, {
                method: req.method,
                headers: newHeaders,
                body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
                redirect: 'manual',
                duplex: 'half'
            });
            for (const [key, value] of redirectResponse.headers.entries()) {
                if (excludedHeaders.includes(key.toLowerCase())) {
                    continue;
                }
                res.setHeader(key, value);
            }
            res.status(redirectResponse.status);
            if (redirectResponse.body) {
                await pipeline(redirectResponse.body, res);
            } else {
                res.end();
            }
            return;
        }
        
        if (response.body) {
            await pipeline(response.body, res);
        } else {
            res.end();
        }
        
    } catch (error) {
        console.error("[Hub Proxy] Error:", error);
        if (!res.headersSent) {
            res.status(502).send({ error: 'Proxy request failed: ' + error.message });
        } else {
            res.end();
        }
    }
}

app.get('/proxy', reverseProxyFunc_get);
app.get('/proxy2', reverseProxyFunc_get);
app.get('/hub-proxy/*', hubProxyFunc);

app.post('/proxy', reverseProxyFunc);
app.post('/proxy2', reverseProxyFunc);
app.put('/proxy', reverseProxyFunc);
app.put('/proxy2', reverseProxyFunc);
app.delete('/proxy', reverseProxyFunc);
app.delete('/proxy2', reverseProxyFunc);
app.post('/hub-proxy/*', hubProxyFunc);

// app.get('/api/password', async(req, res)=> {
//     if(password === ''){
//         res.send({status: 'unset'})
//     }
//     else if(req.body.password && req.body.password.trim() === password.trim()){
//         res.send({status:'correct'})
//     }
//     else{
//         res.send({status:'incorrect'})
//     }
// })

app.get('/api/test_auth', async(req, res) => {

    if(!password){
        res.send({status: 'unset'})
    }
    else if(!await checkAuth(req, res, true)){
        res.send({status: 'incorrect'})
    }
    else{
        res.send({status: 'success'})
    }
})

let loginTries = 0;
let loginTriesResetsIn = 0;
app.post('/api/login', async (req, res) => {

    if(loginTriesResetsIn < Date.now()){
        loginTriesResetsIn = Date.now() + (30 * 1000); //30 seconds
        loginTries = 0;
    }

    if(loginTries >= 10){
        res.status(429).send({error: 'Too many attempts. Please wait and try again later.'})
        return;
    }
    else{
        loginTries++;
    }

    if(password === ''){
        res.status(400).send({error: 'Password not set'})
        return;
    }
    if(req.body.password && req.body.password.trim() === password.trim()){
        knownPublicKeysHashes.push(await hashJSON(req.body.publicKey))
        res.send({status:'success'})
    }
    else{
        res.status(400).send({error: 'Password incorrect'})
    }
})

// ── Session cookie issuance (F-0) ──────────────────────────────────────────
// Called once after JWT auth succeeds. Issues a long-lived cookie so that
// <img src="/api/asset/..."> requests can be authenticated without JS.
app.post('/api/session', async (req, res) => {
    if (!await checkAuth(req, res)) return
    const token = nodeCrypto.randomBytes(32).toString('hex')
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000
    sessions.set(token, expiresAt)
    // Prune stale sessions (bounded by single-user usage, safe to do inline)
    for (const [t, exp] of sessions) {
        if (exp < Date.now()) sessions.delete(t)
    }
    const maxAge = 7 * 24 * 60 * 60 // seconds
    res.setHeader('Set-Cookie', `risu-session=${token}; HttpOnly; SameSite=Strict; Max-Age=${maxAge}; Path=/`)
    res.json({ ok: true })
})

// ── Direct asset serving (F-1) ─────────────────────────────────────────────
// Serves KV-stored assets as proper HTTP responses with long-term caching.
// Key is hex-encoded to safely pass through URL. Auth via session cookie.
//
// Storage formats differ by key prefix:
//   assets/*        → raw binary (Uint8Array)
//   inlay/*         → JSON { data: "data:<mime>;base64,...", ext, type, ... }
//   inlay_thumb/*   → JSON { data: "data:<mime>;base64,...", ext, type, ... }

/**
 * Extract raw binary and content-type from a KV value.
 * Handles both raw binary (assets/) and JSON+base64 wrapped (inlay/) formats.
 */
function resolveAssetPayload(key, rawValue) {
    // inlay/ and inlay_thumb/ keys store JSON with base64 data URI
    if (key.startsWith('inlay/') || key.startsWith('inlay_thumb/')) {
        try {
            const json = JSON.parse(rawValue.toString('utf-8'))
            const dataUri = json.data
            if (typeof dataUri === 'string' && dataUri.startsWith('data:')) {
                // Parse "data:<mime>;base64,<payload>"
                const commaIdx = dataUri.indexOf(',')
                const meta = dataUri.substring(5, commaIdx) // after "data:"
                const mime = meta.split(';')[0]
                const binary = Buffer.from(dataUri.substring(commaIdx + 1), 'base64')
                return { binary, contentType: mime || 'application/octet-stream' }
            }
            // Fallback: ext field
            const ext = (json.ext || '').toLowerCase()
            const mime = ASSET_EXT_MIME[ext] || 'application/octet-stream'
            return { binary: rawValue, contentType: mime }
        } catch {
            // JSON parse failed — treat as raw binary
        }
    }

    // assets/* and others: raw binary
    const ext = key.split('.').pop()?.toLowerCase()
    const contentType = ASSET_EXT_MIME[ext] || detectMime(rawValue)
    return { binary: rawValue, contentType }
}

app.get('/api/asset/:hexKey', sessionAuthMiddleware, (req, res) => {
    try {
        const key = Buffer.from(req.params.hexKey, 'hex').toString('utf-8')

        // Fast-path 304: check updated_at BEFORE loading the blob.
        // Avoids full blob load + JSON parse + base64 decode + MD5 hash for cached assets.
        const updatedAt = kvGetUpdatedAt(key)
        if (updatedAt === null) return res.status(404).end()

        const etag = `"${updatedAt}"`
        if (req.headers['if-none-match'] === etag) {
            return res.status(304).end()
        }

        const data = kvGet(key)
        if (!data) return res.status(404).end()

        const { binary, contentType } = resolveAssetPayload(key, data)
        res.set({
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=0, must-revalidate',
            'ETag': etag,
        })
        res.send(binary)
    } catch (e) {
        res.status(500).end()
    }
})

app.post('/api/crypto', async (req, res) => {
    try {
        const hash = nodeCrypto.createHash('sha256')
        hash.update(Buffer.from(req.body.data, 'utf-8'))
        res.send(hash.digest('hex'))
    } catch (error) {
        res.status(500).send({ error: 'Crypto operation failed' });
    }
})


app.post('/api/set_password', async (req, res) => {
    if(password === ''){
        password = req.body.password
        writeFileSync(passwordPath, password, 'utf-8')
        res.send({status: 'success'})
    }
    else{
        res.status(400).send("already set")
    }
})

app.get('/api/read', async (req, res, next) => {
    if(!await checkAuth(req, res)){
        return;
    }
    const filePath = req.headers['file-path'];
    if (!filePath) {
        console.log('no path')
        res.status(400).send({ error:'File path required' });
        return;
    }
    if(!isHex(filePath)){
        res.status(400).send({ error:'Invaild Path' });
        return;
    }
    try {
        const key = Buffer.from(filePath, 'hex').toString('utf-8');
        const value = kvGet(key);
        if(value === null){
            res.send();
        } else {
            res.setHeader('Content-Type', 'application/octet-stream');
            res.send(value);
        }
    } catch (error) {
        next(error);
    }
});

app.get('/api/remove', async (req, res, next) => {
    if(!await checkAuth(req, res)){
        return;
    }
    const filePath = req.headers['file-path'];
    if (!filePath) {
        res.status(400).send({ error:'File path required' });
        return;
    }
    if(!isHex(filePath)){
        res.status(400).send({ error:'Invaild Path' });
        return;
    }
    try {
        const key = Buffer.from(filePath, 'hex').toString('utf-8');
        kvDel(key);
        res.send({ success: true });
    } catch (error) {
        next(error);
    }
});

app.get('/api/list', async (req, res, next) => {
    if(!await checkAuth(req, res)){
        return;
    }
    try {
        const keyPrefix = req.headers['key-prefix'] || '';
        const data = kvList(keyPrefix || undefined);
        res.send({ success: true, content: data });
    } catch (error) {
        next(error);
    }
});

app.post('/api/write', async (req, res, next) => {
    if(!await checkAuth(req, res)){
        return;
    }
    const filePath = req.headers['file-path'];
    const fileContent = req.body;
    if (!filePath || !fileContent) {
        res.status(400).send({ error:'File path required' });
        return;
    }
    if(!isHex(filePath)){
        res.status(400).send({ error:'Invaild Path' });
        return;
    }
    try {
        const key = Buffer.from(filePath, 'hex').toString('utf-8');
        kvSet(key, fileContent);
        res.send({ success: true });
    } catch (error) {
        next(error);
    }
});

// ─── Bulk asset endpoints (3-2-B) ─────────────────────────────────────────────
const BULK_BATCH = 50;

app.post('/api/assets/bulk-read', async (req, res, next) => {
    if(!await checkAuth(req, res)){ return; }
    try {
        const keys = req.body; // string[] — decoded key strings
        if(!Array.isArray(keys)){
            res.status(400).send({ error: 'Body must be a JSON array of keys' });
            return;
        }

        const acceptsBinary = (req.headers['accept'] || '').includes('application/octet-stream');

        if (acceptsBinary) {
            // Binary protocol: [count(4)] then per entry: [keyLen(4)][key][valLen(4)][value]
            // Eliminates ~33% base64 overhead
            const entries = [];
            let totalSize = 4; // count header
            for (let i = 0; i < keys.length; i += BULK_BATCH) {
                const batch = keys.slice(i, i + BULK_BATCH);
                for (const key of batch) {
                    const value = kvGet(key);
                    if (value !== null) {
                        const keyBuf = Buffer.from(key, 'utf-8');
                        const valBuf = Buffer.from(value);
                        entries.push({ keyBuf, valBuf });
                        totalSize += 4 + keyBuf.length + 4 + valBuf.length;
                    }
                }
            }
            const out = Buffer.allocUnsafe(totalSize);
            let offset = 0;
            out.writeUInt32BE(entries.length, offset); offset += 4;
            for (const { keyBuf, valBuf } of entries) {
                out.writeUInt32BE(keyBuf.length, offset); offset += 4;
                keyBuf.copy(out, offset); offset += keyBuf.length;
                out.writeUInt32BE(valBuf.length, offset); offset += 4;
                valBuf.copy(out, offset); offset += valBuf.length;
            }
            res.set('Content-Type', 'application/octet-stream');
            res.send(out);
        } else {
            // Legacy JSON+base64 fallback
            const results = [];
            for (let i = 0; i < keys.length; i += BULK_BATCH) {
                const batch = keys.slice(i, i + BULK_BATCH);
                for (const key of batch) {
                    const value = kvGet(key);
                    if (value !== null) {
                        results.push({ key, value: Buffer.from(value).toString('base64') });
                    }
                }
            }
            res.json(results);
        }
    } catch(error){ next(error); }
});

app.post('/api/assets/bulk-write', async (req, res, next) => {
    if(!await checkAuth(req, res)){ return; }
    try {
        const entries = req.body; // {key: string, value: base64}[]
        if(!Array.isArray(entries)){
            res.status(400).send({ error: 'Body must be a JSON array of {key, value}' });
            return;
        }
        for(let i = 0; i < entries.length; i += BULK_BATCH){
            const batch = entries.slice(i, i + BULK_BATCH);
            const writeBatch = sqliteDb.transaction(() => {
                for(const { key, value } of batch){
                    kvSet(key, Buffer.from(value, 'base64'));
                }
            });
            writeBatch();
        }
        res.json({ success: true, count: entries.length });
    } catch(error){ next(error); }
});

app.get('/api/backup/export', async (req, res, next) => {
    if(!await checkAuth(req, res)){ return; }
    try {
        const namespacedEntries = [
            ...kvListWithSizes('assets/').map((entry) => ({
                key: entry.key,
                backupName: path.basename(entry.key),
                size: entry.size,
            })),
            ...kvListWithSizes('inlay/').map((entry) => ({
                key: entry.key,
                backupName: entry.key,
                size: entry.size,
            })),
            ...kvListWithSizes('inlay_thumb/').map((entry) => ({
                key: entry.key,
                backupName: entry.key,
                size: entry.size,
            })),
            ...kvListWithSizes('inlay_meta/').map((entry) => ({
                key: entry.key,
                backupName: entry.key,
                size: entry.size,
            })),
        ].sort((a, b) => a.key.localeCompare(b.key));
        const dbSize = kvSize('database/database.bin');
        const totalBytes = namespacedEntries.reduce((sum, entry) => {
            return sum + 8 + Buffer.byteLength(entry.backupName, 'utf-8') + entry.size;
        }, 0) + (dbSize ? 8 + Buffer.byteLength('database.risudat', 'utf-8') + dbSize : 0);

        res.setHeader('content-type', 'application/octet-stream');
        res.setHeader('content-disposition', `attachment; filename="risu-backup-${Date.now()}.bin"`);
        res.setHeader('content-length', totalBytes);
        res.setHeader('x-risu-backup-assets', namespacedEntries.length);

        for (const entry of namespacedEntries) {
            const value = kvGet(entry.key);
            if (value) {
                writeBackupEntry(res, entry.backupName, value);
            }
        }

        if (dbSize) {
            const dbValue = kvGet('database/database.bin');
            if (dbValue) {
                writeBackupEntry(res, 'database.risudat', dbValue);
            }
        }
        res.end();
    } catch (error) {
        next(error);
    }
});

// Pre-flight check: auth + size + disk space before client starts uploading
app.post('/api/backup/import/prepare', async (req, res, next) => {
    if (!await checkAuth(req, res)) { return; }
    try {
        if (importInProgress) {
            res.status(409).json({ error: 'Another import is already in progress' });
            return;
        }

        const size = Number(req.body?.size ?? 0);
        if (BACKUP_IMPORT_MAX_BYTES > 0 && size > BACKUP_IMPORT_MAX_BYTES) {
            res.status(413).json({ error: `Backup exceeds max allowed size (${BACKUP_IMPORT_MAX_BYTES} bytes)` });
            return;
        }

        if (size > 0) {
            const disk = await checkDiskSpace(size * BACKUP_DISK_HEADROOM);
            if (!disk.ok) {
                res.status(507).json({
                    error: 'Insufficient disk space',
                    available: disk.available,
                    required: size * BACKUP_DISK_HEADROOM,
                });
                return;
            }
        }

        res.json({ ok: true });
    } catch (error) {
        next(error);
    }
});

app.post('/api/backup/import', async (req, res, next) => {
    if(!await checkAuth(req, res)){ return; }

    if (importInProgress) {
        res.status(409).json({ error: 'Another import is already in progress' });
        return;
    }
    importInProgress = true;

    try {
        const contentType = String(req.headers['content-type'] ?? '');
        if (contentType && !contentType.includes('application/x-risu-backup') && !contentType.includes('application/octet-stream')) {
            res.status(415).json({ error: 'Unsupported backup content-type' });
            return;
        }

        const contentLength = Number(req.headers['content-length'] ?? '0');
        if (BACKUP_IMPORT_MAX_BYTES > 0 && Number.isFinite(contentLength) && contentLength > BACKUP_IMPORT_MAX_BYTES) {
            res.status(413).json({ error: `Backup exceeds max allowed size (${BACKUP_IMPORT_MAX_BYTES} bytes)` });
            return;
        }

        let remainingBuffer = Buffer.alloc(0);
        let hasDatabase = false;
        let assetsRestored = 0;
        let bytesReceived = 0;
        const seenEntryNames = new Set();

        sqliteDb.exec('BEGIN');
        try {
            kvDelPrefix('assets/');
            kvDelPrefix('inlay/');
            kvDelPrefix('inlay_thumb/');
            kvDelPrefix('inlay_meta/');
            clearEntities();

            for await (const chunk of req) {
                bytesReceived += chunk.length;
                if (BACKUP_IMPORT_MAX_BYTES > 0 && bytesReceived > BACKUP_IMPORT_MAX_BYTES) {
                    throw new Error(`Backup exceeds max allowed size (${BACKUP_IMPORT_MAX_BYTES} bytes)`);
                }

                remainingBuffer = remainingBuffer.length === 0
                    ? Buffer.from(chunk)
                    : Buffer.concat([remainingBuffer, Buffer.from(chunk)]);
                remainingBuffer = parseBackupChunk(remainingBuffer, (name, data) => {
                    if (seenEntryNames.has(name)) {
                        throw new Error(`Duplicate backup entry: ${name}`);
                    }
                    seenEntryNames.add(name);

                    const storageKey = resolveBackupStorageKey(name);
                    if (storageKey === 'database/database.bin') {
                        kvSet(storageKey, Buffer.from(data));
                        hasDatabase = true;
                    } else {
                        kvSet(storageKey, Buffer.from(data));
                        assetsRestored += 1;
                    }
                });
            }

            if (remainingBuffer.length > 0) {
                throw new Error('Backup stream ended with incomplete entry');
            }
            if (!hasDatabase) {
                throw new Error('Backup does not contain database.risudat');
            }
            sqliteDb.exec('COMMIT');
        } catch (error) {
            sqliteDb.exec('ROLLBACK');
            throw error;
        }

        try {
            checkpointWal('TRUNCATE');
        } catch (checkpointError) {
            console.warn('[Backup Import] WAL checkpoint after import failed:', checkpointError);
        }

        res.json({
            ok: true,
            assetsRestored,
        });
    } catch (error) {
        next(error);
    } finally {
        importInProgress = false;
    }
});

// ─── Entity API endpoints (3-2) ───────────────────────────────────────────────

// SSE clients for 3-3
const sseClients = new Set();

function broadcastEvent(type, id) {
    const data = JSON.stringify({ type, id, updated_at: Date.now() });
    for(const res of sseClients){
        res.write(`data: ${data}\n\n`);
    }
}

app.get('/api/events', (req, res) => {
    // No auth required for SSE — same-origin browser context
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
});

// Characters
app.get('/api/db/characters', async (req, res, next) => {
    if(!await checkAuth(req, res)){ return; }
    try {
        res.json(charList());
    } catch(e){ next(e); }
});

app.get('/api/db/characters/:id', async (req, res, next) => {
    if(!await checkAuth(req, res)){ return; }
    try {
        const data = charGet(req.params.id);
        if(data === null){ res.status(404).send({ error: 'Not found' }); return; }
        res.setHeader('Content-Type', 'application/octet-stream');
        res.send(data);
    } catch(e){ next(e); }
});

app.post('/api/db/characters/:id', async (req, res, next) => {
    if(!await checkAuth(req, res)){ return; }
    try {
        charSet(req.params.id, req.body);
        broadcastEvent('character', req.params.id);
        res.json({ success: true });
    } catch(e){ next(e); }
});

app.delete('/api/db/characters/:id', async (req, res, next) => {
    if(!await checkAuth(req, res)){ return; }
    try {
        charDel(req.params.id);
        broadcastEvent('character', req.params.id);
        res.json({ success: true });
    } catch(e){ next(e); }
});

// Chats
app.get('/api/db/chats/:charId', async (req, res, next) => {
    if(!await checkAuth(req, res)){ return; }
    try {
        res.json(chatList(req.params.charId));
    } catch(e){ next(e); }
});

app.get('/api/db/chats/:charId/:chatId', async (req, res, next) => {
    if(!await checkAuth(req, res)){ return; }
    try {
        const data = chatGet(req.params.charId, req.params.chatId);
        if(data === null){ res.status(404).send({ error: 'Not found' }); return; }
        res.setHeader('Content-Type', 'application/octet-stream');
        res.send(data);
    } catch(e){ next(e); }
});

app.post('/api/db/chats/:charId/:chatId', async (req, res, next) => {
    if(!await checkAuth(req, res)){ return; }
    try {
        chatSet(req.params.charId, req.params.chatId, req.body);
        broadcastEvent('chat', `${req.params.charId}/${req.params.chatId}`);
        res.json({ success: true });
    } catch(e){ next(e); }
});

app.delete('/api/db/chats/:charId/:chatId', async (req, res, next) => {
    if(!await checkAuth(req, res)){ return; }
    try {
        chatDel(req.params.charId, req.params.chatId);
        res.json({ success: true });
    } catch(e){ next(e); }
});

// Settings
app.get('/api/db/settings', async (req, res, next) => {
    if(!await checkAuth(req, res)){ return; }
    try {
        const data = settingsGet();
        if(data === null){ res.status(404).send({ error: 'Not found' }); return; }
        res.setHeader('Content-Type', 'application/octet-stream');
        res.send(data);
    } catch(e){ next(e); }
});

app.post('/api/db/settings', async (req, res, next) => {
    if(!await checkAuth(req, res)){ return; }
    try {
        settingsSet(req.body);
        broadcastEvent('settings', 'root');
        res.json({ success: true });
    } catch(e){ next(e); }
});

// Presets
app.get('/api/db/presets', async (req, res, next) => {
    if(!await checkAuth(req, res)){ return; }
    try { res.json(presetList()); } catch(e){ next(e); }
});

app.get('/api/db/presets/:id', async (req, res, next) => {
    if(!await checkAuth(req, res)){ return; }
    try {
        const data = presetGet(req.params.id);
        if(data === null){ res.status(404).send({ error: 'Not found' }); return; }
        res.setHeader('Content-Type', 'application/octet-stream');
        res.send(data);
    } catch(e){ next(e); }
});

app.post('/api/db/presets/:id', async (req, res, next) => {
    if(!await checkAuth(req, res)){ return; }
    try {
        presetSet(req.params.id, req.body);
        broadcastEvent('preset', req.params.id);
        res.json({ success: true });
    } catch(e){ next(e); }
});

app.delete('/api/db/presets/:id', async (req, res, next) => {
    if(!await checkAuth(req, res)){ return; }
    try {
        presetDel(req.params.id);
        broadcastEvent('preset', req.params.id);
        res.json({ success: true });
    } catch(e){ next(e); }
});

// Modules
app.get('/api/db/modules', async (req, res, next) => {
    if(!await checkAuth(req, res)){ return; }
    try { res.json(moduleList()); } catch(e){ next(e); }
});

app.get('/api/db/modules/:id', async (req, res, next) => {
    if(!await checkAuth(req, res)){ return; }
    try {
        const data = moduleGet(req.params.id);
        if(data === null){ res.status(404).send({ error: 'Not found' }); return; }
        res.setHeader('Content-Type', 'application/octet-stream');
        res.send(data);
    } catch(e){ next(e); }
});

app.post('/api/db/modules/:id', async (req, res, next) => {
    if(!await checkAuth(req, res)){ return; }
    try {
        moduleSet(req.params.id, req.body);
        broadcastEvent('module', req.params.id);
        res.json({ success: true });
    } catch(e){ next(e); }
});

app.delete('/api/db/modules/:id', async (req, res, next) => {
    if(!await checkAuth(req, res)){ return; }
    try {
        moduleDel(req.params.id);
        broadcastEvent('module', req.params.id);
        res.json({ success: true });
    } catch(e){ next(e); }
});

// ── Update check endpoint ────────────────────────────────────────────────────
app.get('/api/update-check', async (req, res) => {
    if (UPDATE_CHECK_DISABLED || !UPDATE_CHECK_REPO) {
        res.json({ currentVersion, hasUpdate: false, severity: 'none', disabled: true });
        return;
    }
    if (latestReleaseCache) {
        res.json(latestReleaseCache);
    } else {
        const result = await fetchLatestRelease();
        res.json(result || { currentVersion, hasUpdate: false, severity: 'none' });
    }
});


async function getHttpsOptions() {

    const keyPath = path.join(sslPath, 'server.key');
    const certPath = path.join(sslPath, 'server.crt');

    try {
 
        await fs.access(keyPath);
        await fs.access(certPath);

        const [key, cert] = await Promise.all([
            fs.readFile(keyPath),
            fs.readFile(certPath)
        ]);
       
        return { key, cert };

    } catch (error) {
        console.error('[Server] SSL setup errors:', error.message);
        console.log('[Server] Start the server with HTTP instead of HTTPS...');
        return null;
    }
}

async function startServer() {
    try {
      
        const port = process.env.PORT || 6001;
        const httpsOptions = await getHttpsOptions();

        if (httpsOptions) {
            // HTTPS
            https.createServer(httpsOptions, app).listen(port, () => {
                console.log("[Server] HTTPS server is running.");
                console.log(`[Server] https://localhost:${port}/`);
            });
        } else {
            // HTTP
            app.listen(port, () => {
                console.log("[Server] HTTP server is running.");
                console.log(`[Server] http://localhost:${port}/`);
            });
        }
    } catch (error) {
        console.error('[Server] Failed to start server :', error);
        process.exit(1);
    }
}

(async () => {
    await startServer();

    // Periodically checkpoint WAL to reclaim disk space.
    // Without this, the -wal file grows unbounded as inlay/asset writes accumulate.
    setInterval(() => {
        try { checkpointWal('RESTART'); }
        catch { /* non-fatal */ }
    }, 5 * 60 * 1000); // every 5 minutes

    // Check for updates on startup and periodically
    if (!UPDATE_CHECK_DISABLED && UPDATE_CHECK_REPO) {
        fetchLatestRelease();
        setInterval(fetchLatestRelease, UPDATE_CHECK_INTERVAL);
    }
})();
