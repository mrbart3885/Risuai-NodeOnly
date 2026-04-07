import { alertError, alertNormal, alertStore, alertWait, alertMd, alertConfirm } from "../alert";
import { downloadFile, LocalWriter, forageStorage } from "../globalApi.svelte";
import { encodeRisuSaveLegacy } from "../storage/risuSave";
import { getDatabase } from "../storage/database.svelte";
import { language } from "src/lang";

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export async function SaveLocalBackup(){
    try {
        alertWait("Saving local backup...")
        const response = await forageStorage.exportBackup()
        const disposition = response.headers.get('content-disposition') ?? ''
        const fileName = disposition.match(/filename=\"?([^"]+)\"?/)?.[1] ?? `risu-backup-${Date.now()}.bin`
        const totalBytes = Number(response.headers.get('content-length') ?? '0')

        if (response.body) {
            const streamSaver = await import('streamsaver')
            const writableStream = streamSaver.createWriteStream(fileName)
            const writer = writableStream.getWriter()
            const reader = response.body.getReader()
            let downloadedBytes = 0

            while (true) {
                const { done, value } = await reader.read()
                if (done) {
                    break
                }
                downloadedBytes += value.length
                if (totalBytes > 0) {
                    const progress = ((downloadedBytes / totalBytes) * 100).toFixed(2)
                    alertWait(`Saving local backup... (${progress}%)`)
                } else {
                    alertWait(`Saving local backup... (${(downloadedBytes / (1024 * 1024)).toFixed(1)} MB)`)
                }
                await writer.write(value)
            }
            await writer.close()
        } else {
            await downloadFile(fileName, new Uint8Array(await response.arrayBuffer()))
        }

        alertNormal('Success')
    } catch (error) {
        console.error(error)
        alertError('Failed')
    }
}

/**
 * Saves a partial local backup with only critical assets.
 * 
 * Differences from SaveLocalBackup:
 * - Only includes profile images for characters/groups (excludes emotion images, additional assets, VITS files, CC assets)
 * - Additionally includes: persona icons, folder images, bot preset images
 * - Processes only assets in assetMap (selective) instead of all .png files in assets folder
 * - Faster and more efficient for quick backups
 * - Ideal for backing up core visual identity without bulk data
 */
export async function SavePartialLocalBackup(){
    // First confirmation: Explain the difference from regular backup
    const firstConfirm = await alertConfirm(language.partialBackupFirstConfirm)
    
    if (!firstConfirm) {
        return
    }
    
    // Second confirmation: Final warning about not saving assets
    const secondConfirm = await alertConfirm(language.partialBackupSecondConfirm)
    
    if (!secondConfirm) {
        return
    }
    
    alertWait("Saving partial local backup...")
    const writer = new LocalWriter()
    const r = await writer.init()
    if(!r){
        alertError('Failed')
        return
    }

    const db = getDatabase()
    const assetMap = new Map<string, { charName: string, assetName: string }>()
    
    // Only collect main profile images for both characters and groups
    if (db.characters) {
        for (const char of db.characters) {
            if (!char) continue
            const charName = char.name ?? 'Unknown Character'
            
            // Save the main profile image (supports both character and group types)
            // Note: emotionImages are intentionally excluded from partial backup
            if (char.image) {
                assetMap.set(char.image, { charName: charName, assetName: 'Profile Image' })
            }
        }
    }
    
    // User icon
    if (db.userIcon) {
        assetMap.set(db.userIcon, { charName: 'User Settings', assetName: 'User Icon' })
    }
    
    // Persona icons
    if (db.personas) {
        for (const persona of db.personas) {
            if (persona && persona.icon) {
                assetMap.set(persona.icon, { charName: 'Persona', assetName: `${persona.name} Icon` })
            }
        }
    }
    
    // Custom background
    if (db.customBackground) {
        assetMap.set(db.customBackground, { charName: 'User Settings', assetName: 'Custom Background' })
    }
    
    // Folder images in characterOrder
    if (db.characterOrder) {
        for (const item of db.characterOrder) {
            if (typeof item !== 'string' && item.img) {
                assetMap.set(item.img, { charName: 'Folder', assetName: `${item.name} Folder Image` })
            }
            if (typeof item !== 'string' && item.imgFile) {
                assetMap.set(item.imgFile, { charName: 'Folder', assetName: `${item.name} Folder Image File` })
            }
        }
    }
    
    // Bot preset images
    if (db.botPresets) {
        for (const preset of db.botPresets) {
            if (preset && preset.image) {
                assetMap.set(preset.image, { charName: 'Preset', assetName: `${preset.name} Preset Image` })
            }
        }
    }
    
    const missingAssets: string[] = []

    const assetKeys = Array.from(assetMap.keys())

    for(let i=0;i<assetKeys.length;i++){
        const key = assetKeys[i]
        let message = `Saving partial local backup... (${i + 1} / ${assetKeys.length})`
        if (missingAssets.length > 0) {
            const skippedItems = missingAssets.map(key => {
                const assetInfo = assetMap.get(key);
                return assetInfo ? `'${assetInfo.assetName}' from ${assetInfo.charName}` : `'${key}'`;
            }).join(', ');
            message += `\n(Skipping... ${skippedItems})`;
        }
        alertWait(message)

        if(!key || !key.endsWith('.png')){
            continue
        }

        const data = await forageStorage.getItem(key) as unknown as Uint8Array

        if (data) {
            await writer.writeBackup(key, data)
        } else {
            missingAssets.push(key)
        }
    }

    const dbWithoutAccount = { ...db, account: undefined }
    const dbData = encodeRisuSaveLegacy(dbWithoutAccount, 'compression')

    alertWait(`Saving partial local backup... (Saving database)`) 

    await writer.writeBackup('database.risudat', dbData)
    await writer.close()

    if (missingAssets.length > 0) {
        let message = 'Partial backup successful, but the following profile images were missing and skipped:\n\n'
        for (const key of missingAssets) {
            const assetInfo = assetMap.get(key)
            if (assetInfo) {
                message += `* **${assetInfo.assetName}** (from *${assetInfo.charName}*)  \n  *File: ${key}*\n`
            } else {
                message += `* **Unknown Asset**  \n  *File: ${key}*\n`
            }
        }
        alertMd(message)
    } else {
        alertNormal('Success')
    }
}

export function LoadLocalBackup(){
    try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.bin';
        input.onchange = async () => {
            if (!input.files || input.files.length === 0) {
                input.remove();
                return;
            }
            const file = input.files[0];
            input.remove();
            alertWait(`Loading local Backup... (Uploading ${file.name})`);
            await forageStorage.importBackup(file, (loaded, total) => {
                const progress = total > 0 ? ((loaded / total) * 100).toFixed(2) : '0.00'
                alertWait(`Loading local Backup... (${progress}%)`)
            })
            alertStore.set({
                type: "wait",
                msg: "Success, Refreshing your app."
            });
            location.search = ''
            location.reload()
        };

        input.click();
    } catch (error) {
        console.error(error);
        alertError('Failed, Is file corrupted?')
    }
}

export async function ImportFromSaveZip() {
    try {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.zip'
        input.onchange = async () => {
            if (!input.files || input.files.length === 0) {
                input.remove()
                return
            }
            const file = input.files[0]
            input.remove()

            if (!(await alertConfirm(language.importSaveFolderConfirmZip(file.name, formatBytes(file.size))))) return
            if (!(await alertConfirm(language.backupLoadConfirm2))) return

            alertWait(`Uploading ${file.name}...`)
            const result = await forageStorage.uploadSaveFolderZip(file, (loaded, total) => {
                const progress = total > 0 ? ((loaded / total) * 100).toFixed(2) : '0.00'
                alertWait(`Uploading ${file.name}... (${progress}%)`)
            })

            alertStore.set({
                type: "wait",
                msg: `${language.importSaveFolderSuccess} (${result.imported} files). Refreshing...`
            })
            location.search = ''
            location.reload()
        }

        input.click()
    } catch (error) {
        console.error(error)
        alertError(error instanceof Error ? error.message : 'Import failed')
    }
}

export async function CleanupMigratedFiles() {
    try {
        alertWait(language.importSaveFolderScanning)
        let scan: { count: number, totalSize: number }
        try {
            scan = await forageStorage.scanCleanup()
        } catch (error) {
            alertError(error instanceof Error ? error.message : language.cleanupMigratedNotReady)
            return
        }

        if (scan.count === 0) {
            alertNormal(language.cleanupMigratedNoFiles)
            return
        }

        const sizeStr = formatBytes(scan.totalSize)
        if (!(await alertConfirm(language.cleanupMigratedConfirm(scan.count, sizeStr)))) return

        alertWait(language.cleanupMigratedCleaning)
        const result = await forageStorage.executeCleanup()

        alertNormal(language.cleanupMigratedSuccess(result.removed, formatBytes(result.freedBytes)))
    } catch (error) {
        console.error(error)
        alertError(error instanceof Error ? error.message : 'Cleanup failed')
    }
}

// ── Server-side backup functions ─────────────────────────────────────────────

export async function SaveServerBackup() {
    try {
        alertWait(language.serverBackupSaving)
        const result = await forageStorage.saveServerBackup((current, total, bytes) => {
            const pct = total > 0 ? ((current / total) * 100).toFixed(1) : '0'
            const bytesStr = formatBytes(bytes)
            alertWait(`${language.serverBackupSaving} (${pct}% - ${bytesStr})`)
        })
        alertNormal(language.serverBackupSaveSuccess(result.filename, formatBytes(result.size)))
    } catch (error) {
        console.error(error)
        alertError(error instanceof Error ? error.message : 'Server backup failed')
    }
}

