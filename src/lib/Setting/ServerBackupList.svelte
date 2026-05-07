<script lang="ts">
    // Inline server-backup list component (extracted from the legacy
    // serverBackupManager modal). Renders the list with restore / download /
    // delete actions but no modal chrome — embedded directly in pages.
    //
    // Restore flow forces a full page reload because the in-memory db cache
    // is replaced; download streams via streamsaver to avoid loading the
    // backup into memory.
    import { language } from "src/lang";
    import { alertConfirm, alertError, alertWait, alertStore, waitAlert, notifySuccess, notifyError } from "src/ts/alert";
    import { forageStorage, downloadFile } from "src/ts/globalApi.svelte";
    import { RotateCcwIcon, DownloadIcon, TrashIcon } from "@lucide/svelte";

    interface Props {
        onChange?: () => void;
    }
    let { onChange }: Props = $props();

    interface BackupEntry {
        filename: string;
        size: number;
        createdAt: number;
    }

    let backups = $state<BackupEntry[]>([]);
    let loading = $state(true);

    function formatBytes(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }

    export async function loadBackups() {
        loading = true;
        try {
            const result = await forageStorage.listServerBackups();
            backups = result.backups;
        } catch (error) {
            notifyError(error instanceof Error ? error.message : 'Failed to load backups');
        }
        loading = false;
    }

    async function restoreBackup(backup: BackupEntry) {
        if (!(await alertConfirm(language.backupLoadConfirm))) return;
        if (!(await alertConfirm(language.backupLoadConfirm2))) return;
        alertWait(language.serverBackupRestoring);
        try {
            const result = await forageStorage.restoreServerBackup(backup.filename, (bytes, totalBytes) => {
                if (totalBytes > 0) {
                    const pct = ((bytes / totalBytes) * 100).toFixed(1);
                    alertWait(`${language.serverBackupRestoring} (${pct}%)`);
                }
            });
            if (result.coldStorageFailed && result.coldStorageFailed > 0) {
                alertError(`Warning: ${result.coldStorageFailed} character(s) could not be restored from cold storage. The restored save may be incomplete. The app will now reload.`);
                await waitAlert();
            } else {
                alertStore.set({ type: "wait", msg: "Success, Refreshing your app." });
            }
            location.search = '';
            location.reload();
        } catch (error) {
            alertError(error instanceof Error ? error.message : 'Restore failed');
        }
    }

    async function downloadBackup(backup: BackupEntry) {
        alertWait(language.serverBackupDownloading);
        try {
            const response = await forageStorage.downloadServerBackup(backup.filename);
            if (response.body) {
                const streamSaver = await import('streamsaver');
                const writableStream = streamSaver.createWriteStream(backup.filename);
                const writer = writableStream.getWriter();
                const reader = response.body.getReader();
                const totalBytes = Number(response.headers.get('content-length') ?? '0');
                let downloaded = 0;
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    downloaded += value.length;
                    if (totalBytes > 0) {
                        alertWait(`${language.serverBackupDownloading} (${((downloaded / totalBytes) * 100).toFixed(1)}%)`);
                    }
                    await writer.write(value);
                }
                await writer.close();
            } else {
                await downloadFile(backup.filename, new Uint8Array(await response.arrayBuffer()));
            }
            notifySuccess('Success');
        } catch (error) {
            notifyError(error instanceof Error ? error.message : 'Download failed');
        }
    }

    async function deleteBackup(backup: BackupEntry) {
        if (!(await alertConfirm(language.serverBackupDeleteConfirm(backup.filename)))) return;
        try {
            await forageStorage.deleteServerBackup(backup.filename);
            backups = backups.filter(b => b.filename !== backup.filename);
            notifySuccess(language.serverBackupDeleteSuccess);
            onChange?.();
        } catch (error) {
            alertError(error instanceof Error ? error.message : 'Delete failed');
        }
    }

    loadBackups();
</script>

{#if loading}
    <p class="text-textcolor2 text-sm">{language.serverBackupLoading}</p>
{:else if backups.length === 0}
    <p class="text-textcolor2 text-sm">{language.serverBackupEmpty}</p>
{:else}
    <div class="border border-darkborderc rounded-md bg-darkbg/30 overflow-hidden">
        {#each backups as backup, i (backup.filename)}
            <div class="flex items-center text-textcolor px-3 py-2 {i > 0 ? 'border-t border-darkborderc/50' : ''}">
                <div class="flex flex-col min-w-0">
                    <span class="text-sm">{new Date(backup.createdAt).toLocaleString()}</span>
                    <span class="text-xs text-textcolor2 tabular-nums">{formatBytes(backup.size)}</span>
                </div>
                <div class="grow flex justify-end items-center gap-2">
                    <button class="text-textcolor2 hover:text-primary cursor-pointer" title={language.serverBackupRestore} aria-label={language.serverBackupRestore}
                        onclick={() => restoreBackup(backup)}>
                        <RotateCcwIcon size={18}/>
                    </button>
                    <button class="text-textcolor2 hover:text-primary cursor-pointer" title={language.serverBackupDownload} aria-label={language.serverBackupDownload}
                        onclick={() => downloadBackup(backup)}>
                        <DownloadIcon size={18}/>
                    </button>
                    <button class="text-textcolor2 hover:text-red-400 cursor-pointer" title={language.serverBackupDelete} aria-label={language.serverBackupDelete}
                        onclick={() => deleteBackup(backup)}>
                        <TrashIcon size={18}/>
                    </button>
                </div>
            </div>
        {/each}
    </div>
{/if}
