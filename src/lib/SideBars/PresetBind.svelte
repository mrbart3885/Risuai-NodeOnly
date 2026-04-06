<script lang="ts">
    import { DBState } from "src/ts/stores.svelte";
    import { language } from "src/lang";
    import { openPresetList } from "src/ts/stores.svelte";
    import { SlidersHorizontalIcon } from "@lucide/svelte";

    let currentPreset = $derived(DBState.db.botPresets[DBState.db.botPresetsId])
</script>

<div class="text-[11px] text-textcolor2 mt-4 px-1">{language.presets}</div>
<div class="flex gap-1 mt-1 items-stretch">
    <button class="flex-1 min-w-0 flex items-center gap-1.5 py-2 px-4 rounded-md border border-selected bg-darkbutton hover:bg-selected text-textcolor text-md cursor-pointer transition-colors shadow-xs"
        onclick={() => openPresetList.set(true)}>
        <SlidersHorizontalIcon size={16} class="shrink-0" />
        <span class="truncate">{currentPreset?.name ?? language.none}</span>
    </button>
</div>
