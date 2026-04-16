<script lang="ts">
    interface Tab {
        label: string;
        value: number;
    }

    let {
        tabs,
        selected = $bindable(0),
    }: {
        tabs: Tab[];
        selected?: number;
    } = $props();
</script>

<div class="setting-tabs flex w-full border-b border-darkborderc mb-4 overflow-x-auto" role="tablist">
    {#each tabs as tab}
        <button
            role="tab"
            aria-selected={selected === tab.value}
            class="relative px-4 py-2 text-sm whitespace-nowrap shrink-0 transition-colors
                {selected === tab.value
                    ? 'text-textcolor'
                    : 'text-textcolor2 hover:text-textcolor'}"
            onclick={() => selected = tab.value}
        >
            {tab.label}
            {#if selected === tab.value}
                <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-borderc"></span>
            {/if}
        </button>
    {/each}
</div>

<style>
    .setting-tabs {
        scrollbar-width: none;
        -ms-overflow-style: none;
    }
    .setting-tabs::-webkit-scrollbar {
        display: none;
    }
</style>
