<script lang="ts">
    import { XIcon } from "@lucide/svelte";
    import { language } from "../../lang";
    import { DBState } from 'src/ts/stores.svelte';

    interface Props {
        close?: () => void;
    }

    let { close = () => {} }: Props = $props();
</script>

<div class="absolute w-full h-full z-40 bg-black/50 flex justify-center items-center">
    <div class="bg-darkbg p-4 break-any rounded-md flex flex-col max-w-3xl w-96 max-h-full overflow-y-auto">
        <div class="flex items-center text-textcolor mb-4">
            <h2 class="mt-0 mb-0 font-bold">{language.longTermMemory} {language.presets}</h2>
            <div class="grow flex justify-end">
                <button class="text-textcolor2 hover:text-primary mr-2 cursor-pointer items-center" onclick={close}>
                    <XIcon size={24}/>
                </button>
            </div>
        </div>
        {#each DBState.db.hypaV3Presets as preset, i}
            <button onclick={() => {
                DBState.db.hypaV3PresetId = i
                close()
            }} class="flex items-center text-textcolor border-t-1 border-solid border-0 border-darkborderc p-2 cursor-pointer" class:bg-selected={i === DBState.db.hypaV3PresetId}>
                <span class="overflow-x-auto whitespace-nowrap w-full text-left">
                    <span class="font-medium">{preset.name}</span>
                </span>
            </button>
        {/each}
    </div>
</div>

<style>
    .break-any{
        word-break: normal;
        overflow-wrap: anywhere;
    }
</style>
