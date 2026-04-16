/**
 * Portable updater — runs with the bundled bin/node, no npm dependencies.
 * Downloads the latest portable zip/tar.gz from GitHub Releases,
 * replaces app files while preserving save/.
 * On Windows, bundled Node (bin/) is staged and copied by update.bat
 * after this process exits, to avoid self-replacement file locks.
 */

const https = require('https');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'mrbart3885/Risuai-NodeOnly';
const ROOT = path.resolve(__dirname, '..');

const isWin = process.platform === 'win32';
const REQUIRED_ENTRIES = ['dist', 'server', 'package.json'];
const REQUIRED_DIST_FILES = ['index.html'];
const REQUIRED_WIN_ENTRIES = ['bin'];

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

function resolveExtractedRoot(extractedDir) {
    const entries = fs.readdirSync(extractedDir, { withFileTypes: true });
    if (entries.length === 1 && entries[0].isDirectory()) {
        return path.join(extractedDir, entries[0].name);
    }
    return extractedDir;
}

function validateExtractedRoot(extractedRoot) {
    for (const entry of REQUIRED_ENTRIES) {
        if (!fs.existsSync(path.join(extractedRoot, entry))) {
            throw new Error(`Downloaded package is missing required entry: ${entry}`);
        }
    }
    if (isWin) {
        for (const entry of REQUIRED_WIN_ENTRIES) {
            if (!fs.existsSync(path.join(extractedRoot, entry))) {
                throw new Error(`Downloaded Windows package is missing required entry: ${entry}`);
            }
        }
    }
    for (const file of REQUIRED_DIST_FILES) {
        if (!fs.existsSync(path.join(extractedRoot, 'dist', file))) {
            throw new Error(`Downloaded package is missing dist/${file}`);
        }
    }
}

function restoreBackupIntoRoot(backupDir, overwrite = true) {
    if (!fs.existsSync(backupDir)) return;
    for (const entry of fs.readdirSync(backupDir)) {
        const src = path.join(backupDir, entry);
        const dest = path.join(ROOT, entry);
        try {
            if (overwrite && fs.existsSync(dest)) {
                fs.rmSync(dest, { recursive: true, force: true });
            }
            if (!fs.existsSync(dest)) {
                fs.renameSync(src, dest);
            }
        } catch { /* best effort */ }
    }
}

function listFilesRecursive(dir, baseDir = dir, files = []) {
    if (!fs.existsSync(dir)) return files;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            listFilesRecursive(fullPath, baseDir, files);
            continue;
        }
        if (entry.isFile()) {
            files.push(path.relative(baseDir, fullPath));
        }
    }
    files.sort();
    return files;
}

function hashFile(filePath) {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function areDirectoriesEquivalent(a, b) {
    const filesA = listFilesRecursive(a);
    const filesB = listFilesRecursive(b);
    if (filesA.length !== filesB.length) return false;

    for (let i = 0; i < filesA.length; i += 1) {
        if (filesA[i] !== filesB[i]) return false;
        const left = path.join(a, filesA[i]);
        const right = path.join(b, filesB[i]);
        const leftStat = fs.statSync(left);
        const rightStat = fs.statSync(right);
        if (leftStat.size !== rightStat.size) return false;
        if (hashFile(left) !== hashFile(right)) return false;
    }

    return true;
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
    if (fs.existsSync(tmpDir)) {
        const prevBackup = path.join(tmpDir, 'backup');
        if (fs.existsSync(prevBackup)) {
            log('Restoring files from previous interrupted update...');
            restoreBackupIntoRoot(prevBackup, true);
        }
        fs.rmSync(tmpDir, { recursive: true });
    }
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
    const extractedRoot = resolveExtractedRoot(extractedDir);
    validateExtractedRoot(extractedRoot);
    const currentBin = path.join(ROOT, 'bin');
    const newBin = path.join(extractedRoot, 'bin');
    const skipBinReplacement = fs.existsSync(currentBin)
        && fs.existsSync(newBin)
        && areDirectoriesEquivalent(currentBin, newBin);
    if (skipBinReplacement) {
        log('Bundled Node unchanged; skipping bin/ replacement.');
    }

    // Phase 1: move old files to backup (safer than immediate delete)
    log('Replacing files...');
    const keep = new Set(['save', 'backups', '.installed-version', '.update-tmp', 'scripts', '.env', '.npmrc', '.portable']);
    if (isWin || skipBinReplacement) keep.add('bin');
    const backupDir = path.join(tmpDir, 'backup');
    fs.mkdirSync(backupDir, { recursive: true });

    for (const entry of fs.readdirSync(ROOT)) {
        if (keep.has(entry)) continue;
        try {
            fs.renameSync(path.join(ROOT, entry), path.join(backupDir, entry));
        } catch (e) {
            log(`Error backing up ${entry}: ${e.message}`);
            log('Restoring files already moved to backup...');
            restoreBackupIntoRoot(backupDir, true);
            error(isWin
                ? 'Update failed because some files are in use. Close the running RisuAI window/console first, then run update.bat again.'
                : 'Update failed because some files are in use. Stop the running server first, then try again.');
        }
    }

    // Phase 2: move new files from extracted to root
    const moved = [];
    const skipMove = new Set(['save', 'scripts']);
    if (isWin || skipBinReplacement) skipMove.add('bin');
    try {
        for (const entry of fs.readdirSync(extractedRoot)) {
            if (skipMove.has(entry)) continue;
            const src = path.join(extractedRoot, entry);
            const dest = path.join(ROOT, entry);
            if (fs.existsSync(dest)) {
                fs.rmSync(dest, { recursive: true, force: true });
            }
            fs.renameSync(src, dest);
            moved.push(entry);
        }
        for (const entry of REQUIRED_ENTRIES) {
            if (!moved.includes(entry) && !fs.existsSync(path.join(ROOT, entry))) {
                throw new Error(`Required entry was not installed: ${entry}`);
            }
        }
        for (const file of REQUIRED_DIST_FILES) {
            if (!fs.existsSync(path.join(ROOT, 'dist', file))) {
                throw new Error(`Required file was not installed: dist/${file}`);
            }
        }
    } catch (e) {
        // Restore from backup on failure
        log(`Error moving files: ${e.message}`);
        log('Restoring from backup...');
        restoreBackupIntoRoot(backupDir, true);
        error('Update failed, previous version restored. Please try again.');
    }

    // Phase 3: update scripts/ from new release
    const newScripts = path.join(extractedRoot, 'scripts');
    if (fs.existsSync(newScripts)) {
        if (!fs.existsSync(path.join(ROOT, 'scripts'))) {
            fs.mkdirSync(path.join(ROOT, 'scripts'));
        }
        for (const f of fs.readdirSync(newScripts)) {
            fs.copyFileSync(path.join(newScripts, f), path.join(ROOT, 'scripts', f));
        }
    }

    // Phase 4 (Windows): stage bin/ update for update.bat post-step
    if (isWin) {
        if (!fs.existsSync(newBin)) {
            error('Downloaded Windows package is missing bin/. Update aborted before version finalize.');
        }
        const stagedBin = path.join(tmpDir, 'new-bin');
        const skipBinUpdate = path.join(tmpDir, 'skip-bin-update');
        try { fs.rmSync(stagedBin, { recursive: true, force: true }); } catch { /* noop */ }
        try { fs.rmSync(skipBinUpdate, { force: true }); } catch { /* noop */ }
        if (skipBinReplacement) {
            fs.writeFileSync(skipBinUpdate, 'same');
        } else {
            fs.cpSync(newBin, stagedBin, { recursive: true });
            log('Staged bundled Node update (will be applied after updater exits).');
        }
    }

    // Write version marker after all file replacement is truly complete.
    // On Windows, update.bat finalizes this after bin/ replacement succeeds.
    if (isWin) {
        fs.writeFileSync(path.join(tmpDir, 'latest-version'), latest);
        log('Staged version marker update for post-step finalize.');
    } else {
        fs.writeFileSync(path.join(ROOT, '.installed-version'), latest);
    }

    // Cleanup
    if (isWin) {
        log('Leaving .update-tmp for update.bat post-step cleanup.');
    } else {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); }
        catch { log('Warning: could not remove .update-tmp, you can delete it manually.'); }
    }

    log(`Update complete! ${current} → ${latest}`);
    log('');
    if (isWin) {
        log('Restart by running RisuAI.bat');
    } else {
        log('Restart by running ./start.sh');
    }
}

main().catch((e) => error(e.message));
