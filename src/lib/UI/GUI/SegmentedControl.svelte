<script lang="ts">
    import { tick } from 'svelte';
    interface SegmentOption {
        value: string | number;
        label: string;
    }

    interface Props {
        value: string | number;
        options: readonly SegmentOption[];
        size?: 'sm' | 'md' | 'lg';
        className?: string;
        wrap?: boolean;
        fullWidth?: boolean;
    }

    let {
        value = $bindable(),
        options = [],
        size = 'md',
        className = '',
        wrap = false,
        fullWidth = false,
    }: Props = $props();

    let containerRef: HTMLDivElement | undefined = $state();
    let indicatorStyle = $state('');
    let mounted = $state(false);

    // Compute the active index from the current value
    let activeIndex = $derived(options.findIndex(opt => opt.value === value));

    function updateIndicator() {
        if (wrap || !containerRef || activeIndex < 0) {
            indicatorStyle = '';
            return;
        }
        const buttons = containerRef.querySelectorAll<HTMLButtonElement>('[data-segment-btn]');
        const activeBtn = buttons[activeIndex];
        if (!activeBtn) {
            indicatorStyle = '';
            return;
        }
        const containerRect = containerRef.getBoundingClientRect();
        const btnRect = activeBtn.getBoundingClientRect();
        const x = btnRect.left - containerRect.left;
        const width = btnRect.width;
        indicatorStyle = `transform: translateX(${x}px); width: ${width}px;`;
    }

    // Re-calculate indicator when activeIndex changes or on mount
    $effect(() => {
        void activeIndex;
        tick().then(() => {
            updateIndicator();
            if (!mounted) {
                requestAnimationFrame(() => {
                    mounted = true;
                });
            }
        });
    });

    function handleSelect(opt: SegmentOption) {
        value = opt.value;
    }
</script>

    <div
        class="segmented-control-container {className}"
        class:segmented-control-wrap={wrap}
        class:segmented-control-full-width={fullWidth}
        bind:this={containerRef}
    >
    {#if !wrap}
        <div
            class="segmented-indicator"
            class:no-transition={!mounted}
            style={indicatorStyle}
        ></div>
    {/if}

    {#each options as opt (opt.value)}
        <button
            data-segment-btn
            type="button"
            class="segmented-btn"
            class:segmented-btn-active={opt.value === value}
            class:segmented-btn-wrap={wrap}
            class:text-xs={size === 'sm'}
            class:text-sm={size === 'md'}
            class:text-base={size === 'lg'}
            class:px-2={size === 'sm'}
            class:py-1={size === 'sm'}
            class:px-4={size === 'md'}
            class:py-2={size === 'md'}
            class:px-6={size === 'lg'}
            class:py-3={size === 'lg'}
            onclick={() => handleSelect(opt)}
        >
            {opt.label}
        </button>
    {/each}
</div>

<style>
    .segmented-control-container {
        position: relative;
        display: inline-flex;
        width: fit-content;
        align-items: center;
        border-radius: 0.5rem;
        background-color: var(--risu-theme-darkbg);
        border: 1px solid var(--risu-theme-darkborderc);
        padding: 4px;
        gap: 2px;
        user-select: none;
        margin-bottom: 1rem;
    }

    .segmented-control-full-width {
        display: flex;
        width: 100%;
    }

    .segmented-control-wrap {
        flex-wrap: wrap;
        align-items: stretch;
    }

    .segmented-indicator.no-transition {
        transition: none !important;
    }

    .segmented-indicator {
        position: absolute;
        left: 0;
        top: 4px;
        bottom: 4px;
        border-radius: 0.375rem;
        background-color: var(--risu-theme-borderc);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                    width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        will-change: transform, width;
        pointer-events: none;
        z-index: 0;
    }

    .segmented-btn {
        position: relative;
        z-index: 1;
        border: none;
        background: transparent;
        color: var(--risu-theme-textcolor2);
        font-weight: 500;
        border-radius: 0.375rem;
        cursor: pointer;
        white-space: nowrap;
        transition: color 0.2s ease;
        line-height: 1.4;
    }

    .segmented-control-full-width .segmented-btn {
        flex: 1 1 0;
        justify-content: center;
    }

    .segmented-btn-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
        flex: 1 1 5.75rem;
        min-width: min(100%, 5.75rem);
    }

    .segmented-btn:hover:not(.segmented-btn-active) {
        color: var(--risu-theme-textcolor);
    }

    .segmented-btn-active {
        color: #fff;
    }

    .segmented-btn-wrap.segmented-btn-active {
        background-color: var(--risu-theme-borderc);
    }

    .segmented-btn:focus-visible {
        outline: 2px solid var(--risu-theme-borderc);
        outline-offset: -2px;
    }
</style>
