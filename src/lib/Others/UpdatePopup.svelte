<script lang="ts">
    import { updatePopupStore, dismissUpdatePopup, selfUpdateProgressStore, executeSelfUpdate, type UpdateInfo, type SelfUpdateProgress } from "src/ts/update";
    import { openURL } from "src/ts/globalApi.svelte";
    import { language } from "src/lang";
    import { X, ArrowUpCircle, AlertTriangle, Download, Loader, CheckCircle, XCircle } from "@lucide/svelte";

    const info: UpdateInfo | null = $derived($updatePopupStore);
    const progress: SelfUpdateProgress | null = $derived($selfUpdateProgressStore);

    /** True while a self-update is running (or just finished/failed) */
    const isUpdating = $derived(progress != null);

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
</script>

{#if info}
<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
    <div class="bg-darkbg border border-selected rounded-xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden">
        <!-- Header -->
        <div class="px-5 pt-5 pb-3 flex items-start justify-between">
            <div class="flex items-center gap-2.5">
                {#if isUpdating}
                    {#if progress?.step === 'error'}
                        <div class="p-2 rounded-full bg-red-900/30">
                            <XCircle size={20} class="text-red-400" />
                        </div>
                    {:else if progress?.step === 'done'}
                        <div class="p-2 rounded-full bg-green-900/30">
                            <CheckCircle size={20} class="text-green-400" />
                        </div>
                    {:else}
                        <div class="p-2 rounded-full bg-blue-900/30">
                            <Loader size={20} class="text-blue-400 animate-spin" />
                        </div>
                    {/if}
                {:else if info.severity === 'optional'}
                    <div class="p-2 rounded-full bg-green-900/30">
                        <ArrowUpCircle size={20} class="text-green-400" />
                    </div>
                {:else}
                    <div class="p-2 rounded-full bg-red-900/30">
                        <AlertTriangle size={20} class="text-red-400" />
                    </div>
                {/if}
                <h2 class="text-base font-semibold text-textcolor">
                    {#if isUpdating}
                        {progress?.step === 'done' ? language.selfUpdateDone
                            : progress?.step === 'error' ? language.selfUpdateFailed
                            : language.selfUpdateInProgress}
                    {:else}
                        {getTitle(info.severity)}
                    {/if}
                </h2>
            </div>
            {#if !isUpdating || progress?.step === 'done' || progress?.step === 'error'}
                <button class="text-textcolor2 hover:text-textcolor p-1 -mr-1 -mt-1"
                    onclick={isUpdating ? handleDone : dismissUpdatePopup}>
                    <X size={18} />
                </button>
            {/if}
        </div>

        <!-- Body -->
        <div class="px-5 pb-4">
            {#if isUpdating}
                <!-- Progress display -->
                <p class="text-sm text-textcolor2 leading-relaxed">{progress?.message}</p>
                {#if progress?.step === 'done'}
                    <p class="mt-2 text-sm text-textcolor2">{language.selfUpdateReloadHint}</p>
                {/if}
                {#if progress?.step === 'downloading' && progress.progress != null}
                    <div class="mt-3 w-full bg-selected rounded-full h-2 overflow-hidden">
                        <div class="h-full bg-blue-500 rounded-full transition-all duration-300"
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
                    <div class="mt-3 text-sm text-textcolor2 leading-relaxed whitespace-pre-line border-t border-selected pt-3">
                        {info.popupMessage}
                    </div>
                {/if}
            {/if}
        </div>

        <!-- Footer -->
        <div class="px-5 pb-5 flex gap-2 justify-end">
            {#if isUpdating}
                {#if progress?.step === 'done'}
                    <button
                        class="px-4 py-2 text-sm rounded-lg bg-green-600 hover:bg-green-500 text-white font-medium transition-colors"
                        onclick={handleDone}
                    >
                        {language.selfUpdateReload}
                    </button>
                {:else if progress?.step === 'error'}
                    <button
                        class="px-4 py-2 text-sm rounded-lg bg-selected text-textcolor hover:bg-borderc transition-colors"
                        onclick={handleDone}
                    >
                        {language.close}
                    </button>
                {/if}
            {:else}
                <button
                    class="px-4 py-2 text-sm rounded-lg bg-selected text-textcolor hover:bg-borderc transition-colors"
                    onclick={dismissUpdatePopup}
                >
                    {language.updatePopupLater}
                </button>

                {#if info.canSelfUpdate}
                    <button
                        class="px-4 py-2 text-sm rounded-lg transition-colors font-medium
                            {info.severity === 'optional'
                                ? 'bg-green-600 hover:bg-green-500 text-white'
                                : 'bg-red-600 hover:bg-red-500 text-white'}
                            inline-flex items-center gap-1.5"
                        onclick={handleSelfUpdate}
                    >
                        <Download size={14} />
                        {language.selfUpdateNow}
                    </button>
                {:else}
                    <button
                        class="px-4 py-2 text-sm rounded-lg transition-colors font-medium
                            {info.severity === 'optional'
                                ? 'bg-green-600 hover:bg-green-500 text-white'
                                : 'bg-red-600 hover:bg-red-500 text-white'}"
                        onclick={() => { openURL(info.releaseUrl); dismissUpdatePopup(); }}
                    >
                        {language.updatePopupViewRelease}
                    </button>
                {/if}
            {/if}
        </div>
    </div>
</div>
{/if}
