/**
 * Portable updater — runs with the bundled bin/node, no npm dependencies.
 * Downloads the latest portable zip/tar.gz from GitHub Releases,
 * replaces app files while preserving save/ and bin/.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'mrbart3885/Risuai-NodeOnly';
const ROOT = path.resolve(__dirname, '..');
const SAVE_DIR = path.join(ROOT, 'save');
const BIN_DIR = path.join(ROOT, 'bin');

const isWin = process.platform === 'win32';

function log(msg) { process.stdout.write(`[updater] ${msg}\n`); }
function error(msg) { process.stderr.write(`[ERROR] ${msg}\n`); process.exit(1); }

function getCurrentVersion() {
    const markerPath = path.join(ROOT, '.installed-version');
    if (fs.existsSync(markerPath)) {
        return fs.readFileSync(markerPath, 'utf-8').trim();
    }
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
        return 'v' + pkg.version;
    } catch {
        return 'unknown';
    }
}

const MAX_REDIRECTS = 10;

function httpsGet(url, redirectCount = 0) {
    return new Promise((resolve, reject) => {
        if (redirectCount > MAX_REDIRECTS) return reject(new Error('Too many redirects'));
        const get = url.startsWith('https') ? https.get : http.get;
        get(url, { headers: { 'User-Agent': 'RisuAI-Updater' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return httpsGet(res.headers.location, redirectCount + 1).then(resolve, reject);
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode}`));
            }
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        }).on('error', reject);
    });
}

function downloadToFile(url, dest, redirectCount = 0) {
    return new Promise((resolve, reject) => {
        if (redirectCount > MAX_REDIRECTS) return reject(new Error('Too many redirects'));
        const file = fs.createWriteStream(dest);
        const get = url.startsWith('https') ? https.get : http.get;
        get(url, { headers: { 'User-Agent': 'RisuAI-Updater' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                file.close();
                fs.unlinkSync(dest);
                return downloadToFile(res.headers.location, dest, redirectCount + 1).then(resolve, reject);
            }
            if (res.statusCode !== 200) {
                file.close();
                return reject(new Error(`HTTP ${res.statusCode}`));
            }
            const total = parseInt(res.headers['content-length'] || '0', 10);
            let downloaded = 0;
            res.on('data', (chunk) => {
                downloaded += chunk.length;
                if (total > 0) {
                    const pct = ((downloaded / total) * 100).toFixed(1);
                    process.stdout.write(`\r[updater] Downloading... ${pct}%  `);
                }
            });
            res.pipe(file);
            file.on('finish', () => { file.close(); process.stdout.write('\n'); resolve(); });
            file.on('error', reject);
        }).on('error', reject);
    });
}

function getPlatformSuffix() {
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
    if (isWin) return `win-${arch}`;
    if (process.platform === 'darwin') return `macos-${arch}`;
    return `linux-${arch}`;
}

async function main() {
    const current = getCurrentVersion();
    log(`Current version: ${current}`);
    log('Checking for updates...');

    const data = await httpsGet(`https://api.github.com/repos/${REPO}/releases/latest`);
    const release = JSON.parse(data.toString());
    const latest = release.tag_name;

    if (!latest) error('Could not determine latest version.');

    if (current === latest) {
        log(`Already up to date (${current}).`);
        return;
    }

    log(`New version available: ${latest}`);

    const suffix = getPlatformSuffix();
    const asset = (release.assets || []).find(a => a.name.includes(suffix));
    if (!asset) {
        error(`No portable package found for ${suffix}. Download manually from:\n  ${release.html_url}`);
    }

    const tmpDir = path.join(ROOT, '.update-tmp');
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
    fs.mkdirSync(tmpDir, { recursive: true });

    const downloadPath = path.join(tmpDir, asset.name);
    log(`Downloading ${asset.name}...`);
    await downloadToFile(asset.browser_download_url, downloadPath);

    log('Extracting...');
    const extractedPath = path.join(tmpDir, 'extracted');
    fs.mkdirSync(extractedPath, { recursive: true });
    if (asset.name.endsWith('.zip')) {
        execSync(`powershell -Command "Expand-Archive -Path '${downloadPath}' -DestinationPath '${extractedPath}' -Force"`, { stdio: 'inherit' });
    } else {
        execSync(`tar -xzf "${downloadPath}" -C "${extractedPath}"`, { stdio: 'inherit' });
    }

    const extractedDir = path.join(tmpDir, 'extracted');

    // Remove old files (keep save/, bin/, .installed-version, .update-tmp)
    log('Replacing files...');
    const keep = new Set(['save', 'bin', '.installed-version', '.update-tmp', 'scripts']);
    for (const entry of fs.readdirSync(ROOT)) {
        if (keep.has(entry)) continue;
        fs.rmSync(path.join(ROOT, entry), { recursive: true, force: true });
    }

    // Move new files
    for (const entry of fs.readdirSync(extractedDir)) {
        if (entry === 'save' || entry === 'bin') continue;
        const src = path.join(extractedDir, entry);
        const dest = path.join(ROOT, entry);
        fs.renameSync(src, dest);
    }

    // Update scripts/ from new release
    const newScripts = path.join(extractedDir, 'scripts');
    if (fs.existsSync(newScripts)) {
        if (!fs.existsSync(path.join(ROOT, 'scripts'))) {
            fs.mkdirSync(path.join(ROOT, 'scripts'));
        }
        for (const f of fs.readdirSync(newScripts)) {
            fs.copyFileSync(path.join(newScripts, f), path.join(ROOT, 'scripts', f));
        }
    }

    // Write version marker
    fs.writeFileSync(path.join(ROOT, '.installed-version'), latest);

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });

    log(`Update complete! ${current} → ${latest}`);
    log('');
    if (isWin) {
        log('Restart by running RisuAI.bat');
    } else {
        log('Restart by running ./start.sh');
    }
}

main().catch((e) => error(e.message));
