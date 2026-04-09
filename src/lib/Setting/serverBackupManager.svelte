<script lang="ts">
    import { language } from "src/lang";
    import { alertConfirm, alertError, alertNormal, alertWait, alertStore } from "src/ts/alert";
    import { forageStorage, downloadFile } from "src/ts/globalApi.svelte";
    import { XIcon, RotateCcwIcon, DownloadIcon, TrashIcon } from "@lucide/svelte";

    interface Props {
        close: () => void;
    }
    let { close }: Props = $props();

    interface BackupEntry {
        filename: string;
        size: number;
        createdAt: number;
    }

    let backups = $state<BackupEntry[]>([]);
    let loading = $state(true);

    function formatBytes(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
    }

    async function loadBackups() {
        loading = true;
        try {
            const result = await forageStorage.listServerBackups();
            backups = result.backups;
        } catch (error) {
            alertError(error instanceof Error ? error.message : 'Failed to load backups');
        }
        loading = false;
    }

    async function restoreBackup(backup: BackupEntry) {
        if (!(await alertConfirm(language.backupLoadConfirm))) return;
        if (!(await alertConfirm(language.backupLoadConfirm2))) return;
        alertWait(language.serverBackupRestoring);
        try {
            await forageStorage.restoreServerBackup(backup.filename, (bytes, totalBytes) => {
                if (totalBytes > 0) {
                    const pct = ((bytes / totalBytes) * 100).toFixed(1);
                    alertWait(`${language.serverBackupRestoring} (${pct}%)`);
                }
            });
            alertStore.set({ type: "wait", msg: "Success, Refreshing your app." });
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
            alertNormal('Success');
        } catch (error) {
            alertError(error instanceof Error ? error.message : 'Download failed');
        }
    }

    async function deleteBackup(backup: BackupEntry) {
        if (!(await alertConfirm(language.serverBackupDeleteConfirm(backup.filename)))) return;
        try {
            await forageStorage.deleteServerBackup(backup.filename);
            backups = backups.filter(b => b.filename !== backup.filename);
            alertNormal(language.serverBackupDeleteSuccess);
        } catch (error) {
            alertError(error instanceof Error ? error.message : 'Delete failed');
        }
    }

    loadBackups();
</script>

<div class="fixed inset-0 z-40 bg-black/50 flex justify-center items-center" role="dialog" tabindex="-1"
    onclick={(e) => { if (e.target === e.currentTarget) close() }}
    onkeydown={(e) => { if (e.key === 'Escape') close() }}>
    <div class="bg-darkbg p-4 rounded-md flex flex-col max-w-3xl w-124 max-h-[80vh] overflow-y-auto">
        <div class="flex items-center text-textcolor mb-4">
            <h2 class="mt-0 mb-0">{language.serverBackupHeader}</h2>
            <div class="grow flex justify-end">
                <button class="text-textcolor2 hover:text-green-500 cursor-pointer" onclick={close}>
                    <XIcon size={24}/>
                </button>
            </div>
        </div>

        {#if loading}
            <p class="text-textcolor2 text-sm">{language.serverBackupLoading}</p>
        {:else if backups.length === 0}
            <p class="text-textcolor2 text-sm">{language.serverBackupEmpty}</p>
        {:else}
            {#each backups as backup}
                <div class="flex items-center text-textcolor border-t-1 border-solid border-0 border-darkborderc p-2">
                    <div class="flex flex-col min-w-0">
                        <span class="text-sm">{new Date(backup.createdAt).toLocaleString()}</span>
                        <span class="text-xs text-textcolor2">{formatBytes(backup.size)}</span>
                    </div>
                    <div class="grow flex justify-end items-center">
                        <button class="text-textcolor2 hover:text-green-500 cursor-pointer mr-2" title={language.serverBackupRestore}
                            onclick={() => restoreBackup(backup)}>
                            <RotateCcwIcon size={18}/>
                        </button>
                        <button class="text-textcolor2 hover:text-green-500 cursor-pointer mr-2" title={language.serverBackupDownload}
                            onclick={() => downloadBackup(backup)}>
                            <DownloadIcon size={18}/>
                        </button>
                        <button class="text-textcolor2 hover:text-red-500 cursor-pointer" title={language.serverBackupDelete}
                            onclick={() => deleteBackup(backup)}>
                            <TrashIcon size={18}/>
                        </button>
                    </div>
                </div>
            {/each}
        {/if}
    </div>
</div>
