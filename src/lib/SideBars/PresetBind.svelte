<script lang="ts">
    import { DBState } from "src/ts/stores.svelte";
    import { language } from "src/lang";
    import { openPresetList } from "src/ts/stores.svelte";
    import { SlidersHorizontalIcon } from "@lucide/svelte";
    import ShButton from "../UI/GUI/ShButton.svelte";

    let currentPreset = $derived(DBState.db.botPresets[DBState.db.botPresetsId])
</script>

<div class="text-[11px] text-textcolor2 mt-4 px-1">{language.presets}</div>
<div class="flex gap-1 mt-1 items-stretch">
    <ShButton
        className="flex-1 min-w-0 justify-start border-selected"
        onclick={() => openPresetList.set(true)}
    >
        <SlidersHorizontalIcon size={16} class="shrink-0" />
        <span class="truncate">{currentPreset?.name ?? language.none}</span>
    </ShButton>
</div>
