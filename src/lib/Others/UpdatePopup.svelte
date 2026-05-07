<script lang="ts">
    import { updatePopupStore, dismissUpdatePopup, selfUpdateProgressStore, executeSelfUpdate, type UpdateInfo, type SelfUpdateProgress } from "src/ts/update";
    import { openURL } from "src/ts/globalApi.svelte";
    import { SaveServerBackup } from "src/ts/drive/backuplocal";
    import { language } from "src/lang";
    import { ArrowUpCircle, AlertTriangle, Download, Loader, CheckCircle, XCircle, SaveIcon } from "@lucide/svelte";
    import ShDialog from "src/lib/UI/GUI/ShDialog.svelte";
    import ShButton from "src/lib/UI/GUI/ShButton.svelte";

    const info: UpdateInfo | null = $derived($updatePopupStore);
    const progress: SelfUpdateProgress | null = $derived($selfUpdateProgressStore);

    /** True while a self-update is running (or just finished/failed) */
    const isUpdating = $derived(progress != null);

    /** Closable iff idle, or the update reached its terminal state. */
    const canClose = $derived(!isUpdating || progress?.step === 'done' || progress?.step === 'error');

    function getTitle(severity: string): string {
        if (severity === 'required') return language.updatePopupTitleRequired
        if (severity === 'outdated') return language.updatePopupTitleOutdated
        return language.updatePopupTitle
    }

    function handleSelfUpdate() {
        executeSelfUpdate()
    }

    function handleDone() {
        const isDone = progress?.step === 'done'
        selfUpdateProgressStore.set(null)
        dismissUpdatePopup()
        if (isDone) {
            location.reload()
        }
    }

    /** ShDialog.onOpenChange close path — routes through handleDone when an
     *  update has finished (so reload fires) and through dismiss otherwise. */
    function handleClose() {
        if (isUpdating) handleDone()
        else dismissUpdatePopup()
    }
</script>

<!--
    tier="base" so any alertError / alertConfirm fired during the update
    surfaces above this popup. closeOnOutsideClick stays false because
    showUpdatePopupOnce() persists the dismiss before render — accidental
    backdrop clicks would silently drop the version forever. ESC stays
    blocked per branch convention.
-->
{#if info}
    <ShDialog
        open={true}
        onOpenChange={(v) => { if (!v) handleClose() }}
        closable={canClose}
        closeOnEscape={false}
        closeOnOutsideClick={false}
        tier="base"
        size="sm"
        footer={canClose ? footerActions : undefined}
    >
        {#snippet title()}
            <span class="inline-flex items-center gap-2.5">
                {#if isUpdating}
                    {#if progress?.step === 'error'}
                        <span class="p-2 rounded-full bg-draculared/20" aria-hidden="true">
                            <XCircle size={20} class="text-red-400" />
                        </span>
                    {:else if progress?.step === 'done'}
                        <span class="p-2 rounded-full bg-success/20" aria-hidden="true">
                            <CheckCircle size={20} class="text-success" />
                        </span>
                    {:else}
                        <span class="p-2 rounded-full bg-borderc/20" aria-hidden="true">
                            <Loader size={20} class="text-borderc animate-spin" />
                        </span>
                    {/if}
                {:else if info.severity === 'optional'}
                    <span class="p-2 rounded-full bg-success/20" aria-hidden="true">
                        <ArrowUpCircle size={20} class="text-success" />
                    </span>
                {:else}
                    <span class="p-2 rounded-full bg-draculared/20" aria-hidden="true">
                        <AlertTriangle size={20} class="text-red-400" />
                    </span>
                {/if}
                <span>
                    {#if isUpdating}
                        {progress?.step === 'done' ? language.selfUpdateDone
                            : progress?.step === 'error' ? language.selfUpdateFailed
                            : language.selfUpdateInProgress}
                    {:else}
                        {getTitle(info.severity)}
                    {/if}
                </span>
            </span>
        {/snippet}

        {#if isUpdating}
            <p class="text-sm text-textcolor2 leading-relaxed">{progress?.message}</p>
            {#if progress?.step === 'done'}
                <p class="mt-2 text-sm text-textcolor2">{language.selfUpdateReloadHint}</p>
            {/if}
            {#if progress?.step === 'downloading' && progress.progress != null}
                <div class="mt-3 w-full bg-selected rounded-full h-2 overflow-hidden">
                    <div class="h-full bg-borderc rounded-full transition-all duration-300"
                        style="width: {progress.progress}%"></div>
                </div>
                <p class="mt-1 text-xs text-textcolor2 text-right">{progress.progress}%</p>
            {/if}
        {:else}
            <p class="text-sm text-textcolor2 leading-relaxed">
                {@html language.updatePopupDesc
                    .replace('{{latest}}', info.latestVersion)
                    .replace('{{current}}', info.currentVersion)}
            </p>

            {#if info.releaseName}
                <p class="mt-2 text-sm text-textcolor">{info.releaseName}</p>
            {/if}

            {#if info.popupMessage}
                <div class="mt-3 text-sm text-textcolor2 leading-relaxed whitespace-pre-line border-t border-darkborderc pt-3">
                    {info.popupMessage}
                </div>
            {/if}
        {/if}
    </ShDialog>
{/if}

{#snippet footerActions()}
    {#if isUpdating}
        {#if progress?.step === 'done'}
            <ShButton variant="success" onclick={handleDone}>
                {language.selfUpdateReload}
            </ShButton>
        {:else if progress?.step === 'error'}
            <ShButton variant="outline" onclick={handleDone}>
                {language.close}
            </ShButton>
        {/if}
    {:else if info}
        <ShButton variant="outline" onclick={dismissUpdatePopup}>
            {language.updatePopupLater}
        </ShButton>
        <ShButton variant="outline" onclick={() => SaveServerBackup()}>
            <SaveIcon size={14} />
            {language.updatePopupBackup}
        </ShButton>
        {#if info.canSelfUpdate}
            <ShButton
                variant={info.severity === 'optional' ? 'success' : 'destructive'}
                onclick={handleSelfUpdate}
            >
                <Download size={14} />
                {language.selfUpdateNow}
            </ShButton>
        {:else}
            <ShButton
                variant={info.severity === 'optional' ? 'success' : 'destructive'}
                onclick={() => { openURL(info.releaseUrl); dismissUpdatePopup(); }}
            >
                {language.updatePopupViewRelease}
            </ShButton>
        {/if}
    {/if}
{/snippet}
