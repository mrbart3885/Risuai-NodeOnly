<script lang="ts">
    import { language } from "src/lang";
    import { alertConfirm} from "src/ts/alert";
    import { loadInternalBackup } from "src/ts/globalApi.svelte";
    import { LoadLocalBackup, SaveLocalBackup, SavePartialLocalBackup } from "src/ts/drive/backuplocal";
    import Button from "src/lib/UI/GUI/Button.svelte";
    import { exportAsDataset } from "src/ts/storage/exportAsDataset";
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
