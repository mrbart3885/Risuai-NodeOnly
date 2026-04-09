<script lang="ts">
    import { language } from "src/lang";
    import { alertConfirm} from "src/ts/alert";
    import { loadInternalBackup } from "src/ts/globalApi.svelte";
    import { LoadLocalBackup, SaveLocalBackup, SavePartialLocalBackup, ImportFromSaveZip, CleanupMigratedFiles, SaveServerBackup } from "src/ts/drive/backuplocal";
    import Button from "src/lib/UI/GUI/Button.svelte";
    import { exportAsDataset } from "src/ts/storage/exportAsDataset";
    import ServerBackupManager from "src/lib/Setting/serverBackupManager.svelte";

    let showServerBackups = $state(false);
</script>

<h2 class="mb-2 text-2xl font-bold mt-2">{language.account} & {language.files}</h2>

<Button
    onclick={async () => {
        if(await alertConfirm(language.backupConfirm)){
            SaveLocalBackup()
        }
    }} className="mt-2">
    {language.saveBackupLocal}
</Button>

<Button
    onclick={async () => {
        if(await alertConfirm(language.backupConfirm)){
            SavePartialLocalBackup()
        }
    }} className="mt-2">
    {language.savePartialLocalBackup}
</Button>

<Button
    onclick={async () => {
        if((await alertConfirm(language.backupLoadConfirm)) && (await alertConfirm(language.backupLoadConfirm2))){
            LoadLocalBackup()
        }
    }} className="mt-2">
    {language.loadBackupLocal}
</Button>

<Button
    onclick={async () => {
        if((await alertConfirm(language.backupLoadConfirm)) && (await alertConfirm(language.backupLoadConfirm2))){
            loadInternalBackup()
        }
    }} className="mt-2">
    {language.loadInternalBackup}
</Button>

<Button onclick={exportAsDataset} className="mt-2">
    {language.exportAsDataset}
</Button>

<h3 class="mb-1 text-lg font-bold mt-6">{language.serverBackupHeader}</h3>
<p class="text-sm text-neutral-400 mb-2">{language.serverBackupDesc}</p>

<Button
    onclick={async () => {
        if(await alertConfirm(language.backupConfirm)){
            SaveServerBackup()
        }
    }} className="mt-2">
    {language.serverBackupSave}
</Button>

<Button onclick={() => { showServerBackups = true }} className="mt-2">
    {language.serverBackupManage}
</Button>

{#if showServerBackups}
    <ServerBackupManager close={() => { showServerBackups = false }} />
{/if}

<h3 class="mb-1 text-lg font-bold mt-6">{language.importSaveFolderHeader}</h3>

<p class="text-sm text-neutral-400 mb-2">{language.importSaveZipDesc}</p>
<Button onclick={ImportFromSaveZip} className="mt-1">
    {language.importSaveZip}
</Button>

<p class="text-sm text-neutral-400 mt-3 mb-2">{language.cleanupMigratedDesc}</p>
<Button onclick={CleanupMigratedFiles} className="mt-1">
    {language.cleanupMigratedFiles}
</Button>

<!--

    My song for dear, my old friend.

    Should old aquaintance be forgot,
    and never brought to mind?
    Should old lang syne be forgot,
    and auld lang syne?

    For auld lang syne, my dear,
    for auld lang syne,
    we'll take a cup o' kindness yet,
    for auld lang syne.

-->
