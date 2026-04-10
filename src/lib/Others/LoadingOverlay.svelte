<script lang="ts">
    import { loadingOverlayStore } from "src/ts/stores.svelte";
    import { language } from "src/lang";
</script>

{#if $loadingOverlayStore.active}
    <div class="fixed inset-0 z-[60] bg-black/50 flex justify-center items-center">
        <div class="flex flex-col items-center gap-3">
            <svg class="animate-spin h-8 w-8 text-white" style="will-change: transform;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            <span class="text-sm text-white">{$loadingOverlayStore.text || 'Loading...'}</span>
            {#if $loadingOverlayStore.onCancel}
                <button class="mt-1 px-4 py-1.5 text-sm text-white/80 hover:text-white border border-white/30 hover:border-white/60 rounded-md transition-colors cursor-pointer" onclick={() => {
                    $loadingOverlayStore.onCancel?.()
                }}>{language.cancel}</button>
            {/if}
        </div>
    </div>
{/if}
