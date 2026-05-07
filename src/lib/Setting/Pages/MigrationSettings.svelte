<script lang="ts">
    import { language } from "src/lang";
    import SettingPage from "src/lib/UI/GUI/SettingPage.svelte";
    import ShButton from "src/lib/UI/GUI/ShButton.svelte";
    import ShAccordion from "src/lib/UI/GUI/ShAccordion.svelte";
    import Button from "src/lib/UI/GUI/Button.svelte";
    import { alertConfirm } from "src/ts/alert";
    import {
        LoadLocalBackup,
        SaveLocalBackupForUpstream,
        SavePartialLocalBackup,
        ImportFromSaveZip,
        CleanupMigratedFiles,
    } from "src/ts/drive/backuplocal";
    import { exportAsDataset } from "src/ts/storage/exportAsDataset";
    import { openSettings, SettingsRoute, SystemTab } from "src/ts/routing";
    import { InfoIcon } from "@lucide/svelte";

    function gotoBackupTab() {
        openSettings(SettingsRoute.System, SystemTab.Backups);
    }
</script>

<SettingPage title={language.migration}>
    <p class="text-textcolor2 text-sm leading-relaxed mb-4">{language.migrationDesc}</p>

    <div class="bg-blue-900/30 border border-blue-700/40 rounded-md px-4 py-3 mb-4 flex items-center justify-between gap-3 flex-wrap text-blue-300">
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
            <InfoIcon class="size-4 shrink-0 text-blue-400" />
            <span class="leading-relaxed text-sm">{language.migrationInfoBackupMoved}</span>
        </div>
        <ShButton variant="outline" size="sm" onclick={gotoBackupTab}>
            {language.migrationGotoBackupTab}
        </ShButton>
    </div>

    <!-- Migration: upstream RisuAI ↔ NodeOnly ─────────────────────────── -->
    <Button
        onclick={async () => {
            if (await alertConfirm(language.saveBackupForUpstreamConfirm)) {
                SaveLocalBackupForUpstream();
            }
        }} className="mt-2">
        {language.saveBackupForUpstream}
    </Button>

    <Button
        onclick={async () => {
            if ((await alertConfirm(language.backupLoadConfirm)) && (await alertConfirm(language.backupLoadConfirm2))) {
                LoadLocalBackup();
            }
        }} className="mt-2">
        {language.migrationLoadUpstreamBackup}
    </Button>

    <!-- Save folder import (collapsed by default) ────────────────────── -->
    <div class="mt-6">
        <ShAccordion name={language.migrationSaveFolderAccordion} variant="card">
            <p class="text-textcolor2 text-sm leading-relaxed mb-3">{language.migrationSaveFolderDesc}</p>

            <p class="text-textcolor2 text-sm leading-relaxed mb-2">{language.importSaveZipDesc}</p>
            <div class="flex flex-col gap-2">
                <Button onclick={ImportFromSaveZip} className="w-full">
                    {language.importSaveZip}
                </Button>
            </div>

            <p class="text-textcolor2 text-sm leading-relaxed mt-4 mb-2">{language.cleanupMigratedDesc}</p>
            <div class="flex flex-col gap-2">
                <Button onclick={CleanupMigratedFiles} className="w-full">
                    {language.cleanupMigratedFiles}
                </Button>
            </div>
        </ShAccordion>
    </div>

    <!-- Legacy backup options (collapsed by default) ──────────────────── -->
    <div class="mt-3">
        <ShAccordion name={language.migrationLegacyAccordion} variant="card">
            <p class="text-textcolor2 text-sm leading-relaxed mb-3">{language.migrationLegacyDesc}</p>
            <div class="flex flex-col gap-2">
                <Button
                    onclick={async () => {
                        if (await alertConfirm(language.backupConfirm)) {
                            SavePartialLocalBackup();
                        }
                    }} className="w-full">
                    {language.savePartialLocalBackup}
                </Button>

                <Button onclick={exportAsDataset} className="w-full">
                    {language.exportAsDataset}
                </Button>
            </div>
        </ShAccordion>
    </div>
</SettingPage>
