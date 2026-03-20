<script lang="ts">
    import { updatePopupStore, dismissUpdatePopup, type UpdateInfo } from "src/ts/update";
    import { openURL } from "src/ts/globalApi.svelte";
    import { language } from "src/lang";
    import { X, ArrowUpCircle, AlertTriangle } from "@lucide/svelte";

    const info: UpdateInfo | null = $derived($updatePopupStore);

    function getTitle(severity: string): string {
        if (severity === 'required') return language.updatePopupTitleRequired
        if (severity === 'outdated') return language.updatePopupTitleOutdated
        return language.updatePopupTitle
    }
</script>

{#if info}
<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
    <div class="bg-darkbg border border-selected rounded-xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden">
        <!-- Header -->
        <div class="px-5 pt-5 pb-3 flex items-start justify-between">
            <div class="flex items-center gap-2.5">
                {#if info.severity === 'optional'}
                    <div class="p-2 rounded-full bg-green-900/30">
                        <ArrowUpCircle size={20} class="text-green-400" />
                    </div>
                {:else}
                    <div class="p-2 rounded-full bg-red-900/30">
                        <AlertTriangle size={20} class="text-red-400" />
                    </div>
                {/if}
                <h2 class="text-base font-semibold text-textcolor">
                    {getTitle(info.severity)}
                </h2>
            </div>
            <button class="text-textcolor2 hover:text-textcolor p-1 -mr-1 -mt-1" onclick={dismissUpdatePopup}>
                <X size={18} />
            </button>
        </div>

        <!-- Body -->
        <div class="px-5 pb-4">
            <p class="text-sm text-textcolor2 leading-relaxed">
                {@html language.updatePopupDesc
                    .replace('{{latest}}', info.latestVersion)
                    .replace('{{current}}', info.currentVersion)}
            </p>

            {#if info.releaseName}
                <p class="mt-2 text-sm text-textcolor">{info.releaseName}</p>
            {/if}
        </div>

        <!-- Footer -->
        <div class="px-5 pb-5 flex gap-2 justify-end">
            <button
                class="px-4 py-2 text-sm rounded-lg bg-selected text-textcolor hover:bg-borderc transition-colors"
                onclick={dismissUpdatePopup}
            >
                {language.updatePopupLater}
            </button>
            <button
                class="px-4 py-2 text-sm rounded-lg transition-colors font-medium
                    {info.severity === 'optional'
                        ? 'bg-green-600 hover:bg-green-500 text-white'
                        : 'bg-red-600 hover:bg-red-500 text-white'}"
                onclick={() => { openURL(info.releaseUrl); dismissUpdatePopup(); }}
            >
                {language.updatePopupViewRelease}
            </button>
        </div>
    </div>
</div>
{/if}
