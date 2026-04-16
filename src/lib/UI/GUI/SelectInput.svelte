<script lang="ts">
    import { ChevronDownIcon, CheckIcon } from "@lucide/svelte";
    import { isTouchDevice } from "src/ts/stores.svelte";

    interface Props {
        value: string | number;
        className?: string;
        size?: 'sm'|'md'|'lg'|'xl';
        children?: import('svelte').Snippet;
        onchange?: (event: Event & {
            currentTarget: EventTarget & HTMLSelectElement;
        }) => any;
    }

    let {
        value = $bindable(),
        className = "",
        size = 'md',
        children,
        onchange
    }: Props = $props();

    let selectEl: HTMLSelectElement | undefined = $state();
    let open = $state(false);
    let extractedOptions: { value: string; label: string }[] = $state([]);
    let highlightedIndex = $state(-1);
    let triggerEl: HTMLDivElement | undefined = $state();
    let dropdownEl: HTMLDivElement | undefined = $state();

    function extractOptions() {
        if (!selectEl) return;
        extractedOptions = Array.from(selectEl.options).map(o => ({
            value: o.value,
            label: o.textContent?.trim() ?? o.value,
        }));
    }

    function openDropdown() {
        extractOptions();
        const currentIdx = extractedOptions.findIndex(o => o.value === String(value));
        highlightedIndex = currentIdx >= 0 ? currentIdx : 0;
        open = true;
        requestAnimationFrame(positionDropdown);
    }

    function closeDropdown() {
        open = false;
        highlightedIndex = -1;
    }

    function selectOption(optValue: string) {
        if (!selectEl) return;
        selectEl.value = optValue;
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        value = optValue;
        closeDropdown();
    }

    // Position dropdown below trigger
    let dropdownStyle = $state('');

    function positionDropdown() {
        if (!triggerEl || !dropdownEl) return;
        const rect = triggerEl.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const dropHeight = dropdownEl.scrollHeight;

        if (spaceBelow >= dropHeight || spaceBelow >= spaceAbove) {
            dropdownStyle = `top: ${rect.bottom + 4}px; left: ${rect.left}px; width: ${rect.width}px;`;
        } else {
            dropdownStyle = `bottom: ${window.innerHeight - rect.top + 4}px; left: ${rect.left}px; width: ${rect.width}px;`;
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (!open) {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                e.preventDefault();
                openDropdown();
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                highlightedIndex = Math.min(highlightedIndex + 1, extractedOptions.length - 1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                highlightedIndex = Math.max(highlightedIndex - 1, 0);
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                if (highlightedIndex >= 0 && extractedOptions[highlightedIndex]) {
                    selectOption(extractedOptions[highlightedIndex].value);
                }
                break;
            case 'Escape':
                e.preventDefault();
                closeDropdown();
                break;
        }
    }

    function handleClickOutside(e: MouseEvent) {
        if (open && triggerEl && dropdownEl
            && !triggerEl.contains(e.target as Node)
            && !dropdownEl.contains(e.target as Node)) {
            closeDropdown();
        }
    }

    $effect(() => {
        if (open) {
            document.addEventListener('click', handleClickOutside, true);
            return () => document.removeEventListener('click', handleClickOutside, true);
        }
    });

    let selectedLabel = $derived(
        extractedOptions.find(o => o.value === String(value))?.label ?? ''
    );

    // Keep selectedLabel up-to-date even when dropdown is closed
    $effect(() => {
        // Re-extract when value changes (to update label)
        void value;
        if (selectEl) {
            extractOptions();
        }
    });

    const sizeClasses = {
        sm: 'text-sm px-2',
        md: 'text-md px-4',
        lg: 'text-lg px-6',
        xl: 'text-xl px-6',
    };

    const heightClasses = {
        sm: 'h-8',
        md: 'h-10',
        lg: 'h-12',
        xl: 'h-12',
    };

    const itemSizeClasses = {
        sm: 'text-sm px-2 py-1 pr-7',
        md: 'text-md px-4 py-2 pr-8',
        lg: 'text-lg px-6 py-2 pr-9',
        xl: 'text-xl px-6 py-2 pr-9',
    };
</script>

<!-- Native select: always rendered for OptionInput children -->
<!-- Touch: visible via transparent overlay / Mouse: screen-reader only -->
{#if $isTouchDevice}
    <div class="relative {className}">
        <div class="flex {heightClasses[size]} items-center justify-between gap-2 rounded-md border border-darkborderc
                    bg-transparent {sizeClasses[size]} text-textcolor select-none pointer-events-none">
            <span class="flex flex-1 text-left truncate">{selectedLabel || '\u00A0'}</span>
            <ChevronDownIcon class="size-4 shrink-0 text-textcolor2" />
        </div>
        <select
            bind:this={selectEl}
            bind:value
            {onchange}
            class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        >
            {@render children?.()}
        </select>
    </div>
{:else}
    <select bind:this={selectEl} bind:value {onchange} class="sr-only" tabindex={-1}>
        {@render children?.()}
    </select>

    <!-- Desktop: custom trigger + dropdown -->
    <!-- svelte-ignore a11y_interactive_supports_focus -->
    <div
        bind:this={triggerEl}
        role="combobox"
        aria-expanded={open}
        class="flex {heightClasses[size]} items-center justify-between gap-2 rounded-md border border-darkborderc
               bg-transparent {sizeClasses[size]} text-textcolor select-none
               transition-colors cursor-pointer
               hover:bg-selected/30
               focus-visible:border-borderc focus-visible:ring-3 focus-visible:ring-borderc/50
               {className}"
        tabindex={0}
        onclick={() => open ? closeDropdown() : openDropdown()}
        onkeydown={handleKeydown}
    >
        <span class="flex flex-1 text-left truncate">{selectedLabel || '\u00A0'}</span>
        <ChevronDownIcon class="size-4 shrink-0 text-textcolor2" />
    </div>

    {#if open}
        <div
            bind:this={dropdownEl}
            class="fixed z-50 max-h-64 overflow-y-auto rounded-md bg-darkbg shadow-md
                   ring-1 ring-textcolor/10 p-1"
            style={dropdownStyle}
        >
            {#each extractedOptions as opt, i}
                <button
                    class="relative flex w-full items-center gap-2 rounded-md {itemSizeClasses[size]}
                           text-textcolor cursor-pointer select-none text-left
                           {i === highlightedIndex ? 'bg-selected' : 'hover:bg-selected/50'}"
                    onmouseenter={() => highlightedIndex = i}
                    onclick={() => selectOption(opt.value)}
                >
                    {opt.label}
                    {#if opt.value === String(value)}
                        <span class="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
                            <CheckIcon class="size-4 text-borderc" />
                        </span>
                    {/if}
                </button>
            {/each}
        </div>
    {/if}
{/if}
