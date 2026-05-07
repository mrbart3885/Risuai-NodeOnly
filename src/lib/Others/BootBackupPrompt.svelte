<script lang="ts">
    // Boot-time backup reminder prompt.
    //
    // Mounted globally in App.svelte. Driven by `bootBackupPromptStore`:
    // bootstrap.ts sets the store and awaits the user's decision (proceed /
    // skip), then continues the boot sequence. The prompt disables the
    // proceed button when the estimated backup size exceeds disk free, so
    // the user can't kick off a save that the server would refuse anyway.
    import { bootBackupPromptStore } from "src/ts/stores.svelte";
    import { language } from "src/lang";
    import ShDialog from "src/lib/UI/GUI/ShDialog.svelte";
    import ShButton from "src/lib/UI/GUI/ShButton.svelte";
    import { TriangleAlertIcon } from "@lucide/svelte";

    const data = $derived($bootBackupPromptStore);

    // 90-94% → yellow warn, 95%+ → red crit. insufficient takes priority.
    const diskUsedPct = $derived(
        data && data.free != null && data.total != null && data.total > 0
            ? ((data.total - data.free) / data.total) * 100
            : null
    );
    const diskUsageLevel = $derived<'none' | 'warn' | 'crit'>(
        diskUsedPct == null ? 'none'
            : diskUsedPct >= 95 ? 'crit'
            : diskUsedPct >= 90 ? 'warn'
            : 'none'
    );

    function decide(proceed: boolean) {
        const d = $bootBackupPromptStore;
        if (!d) return;
        bootBackupPromptStore.set(null);
        d.resolve(proceed);
    }
</script>

{#if data}
    <ShDialog
        open={true}
        onOpenChange={(v) => { if (!v) decide(false); }}
        closeOnEscape={false}
        closeOnOutsideClick={false}
        tier="alert"
        size="default"
        footer={footerActions}
    >
        {#snippet title()}{language.backupBootPromptTitle}{/snippet}

        <div class="flex flex-col gap-2 text-textcolor2 text-sm leading-relaxed">
            {#if data.estimate != null}
                <div class="tabular-nums">{language.backupBootPromptEstimate(data.estimate)}</div>
            {/if}
            {#if data.free != null && data.total != null}
                <div class="tabular-nums">{language.backupBootPromptDisk(data.free, data.total)}</div>
            {/if}
        </div>

        {#if data.insufficient}
            <div class="bg-draculared/20 border border-draculared/40 rounded-md px-4 py-3 mt-3 flex items-center gap-2.5 text-red-300">
                <TriangleAlertIcon class="size-4 shrink-0 text-red-400" />
                <span class="leading-relaxed text-sm">{language.backupServerInsufficient}</span>
            </div>
        {:else if diskUsageLevel === 'crit' && diskUsedPct != null}
            <div class="bg-draculared/20 border border-draculared/40 rounded-md px-4 py-3 mt-3 flex items-center gap-2.5 text-red-300">
                <TriangleAlertIcon class="size-4 shrink-0 text-red-400" />
                <span class="leading-relaxed text-sm">{language.storageDiskUsageHighWarning(diskUsedPct)}</span>
            </div>
        {:else if diskUsageLevel === 'warn' && diskUsedPct != null}
            <div class="bg-yellow-900/30 border border-yellow-700/40 rounded-md px-4 py-3 mt-3 flex items-center gap-2.5 text-yellow-300">
                <TriangleAlertIcon class="size-4 shrink-0 text-yellow-400" />
                <span class="leading-relaxed text-sm">{language.storageDiskUsageHighWarning(diskUsedPct)}</span>
            </div>
        {/if}
    </ShDialog>
{/if}

{#snippet footerActions()}
    <div class="flex justify-end gap-2">
        <ShButton variant="outline" onclick={() => decide(false)}>
            {language.backupBootPromptSkip}
        </ShButton>
        <ShButton variant="primary" disabled={data?.insufficient} onclick={() => decide(true)}>
            {language.backupBootPromptProceed}
        </ShButton>
    </div>
{/snippet}
