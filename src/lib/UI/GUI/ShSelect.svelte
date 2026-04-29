<script lang="ts" module>
    let selectIdCounter = 0;
</script>

<script lang="ts">
    // Sh select — vega-derived spec, h-10 default. Canonical select widget;
    // SelectInput.svelte is a thin alias kept for the existing 22+ call sites.
    // See .agent/guide/ui.md "Select 컴포넌트 사용" for usage convention.
    //
    // Children pattern with <OptionInput> matches SelectInput exactly so the
    // alias can forward without translation.
    //
    // - Touch (isTouchDevice): visible trigger + transparent native <select>
    //   overlay so the OS picker fires natively.
    // - Mouse: custom dropdown with keyboard nav, click-outside, automatic
    //   above/below positioning.
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
    const selectId = `sh-select-${++selectIdCounter}`;
    const listboxId = `${selectId}-listbox`;
    const getOptionId = (index: number) => `${selectId}-option-${index}`;
    const activeDescendant = $derived(
        open && highlightedIndex >= 0 ? getOptionId(highlightedIndex) : undefined
    );

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
        requestAnimationFrame(() => {
            positionDropdown();
            ensureHighlightedVisible();
        });
    }

    function closeDropdown() {
        open = false;
        highlightedIndex = -1;
    }

    function ensureHighlightedVisible() {
        if (!dropdownEl || highlightedIndex < 0) return;
        dropdownEl
            .querySelector<HTMLElement>(`#${getOptionId(highlightedIndex)}`)
            ?.scrollIntoView({ block: 'nearest' });
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
        // Grow with content but never shrink below the trigger; clamp so we
        // don't run past the viewport edge when an option is wider than space.
        const maxWidth = Math.max(rect.width, window.innerWidth - rect.left - 16);

        if (spaceBelow >= dropHeight || spaceBelow >= spaceAbove) {
            dropdownStyle = `top: ${rect.bottom + 4}px; left: ${rect.left}px; min-width: ${rect.width}px; max-width: ${maxWidth}px;`;
        } else {
            dropdownStyle = `bottom: ${window.innerHeight - rect.top + 4}px; left: ${rect.left}px; min-width: ${rect.width}px; max-width: ${maxWidth}px;`;
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
                requestAnimationFrame(ensureHighlightedVisible);
                break;
            case 'ArrowUp':
                e.preventDefault();
                highlightedIndex = Math.max(highlightedIndex - 1, 0);
                requestAnimationFrame(ensureHighlightedVisible);
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

    // Sizes follow the Sh* spec (h-10 default, 16px constant text). md/lg
    // both use text-base so the overlay select stays iOS-zoom safe and
    // avoids the 768px font-size jump.
    const sizeClasses = {
        sm: 'text-sm px-2.5 gap-1',
        md: 'text-base px-2.5 gap-1.5',
        lg: 'text-base px-3 gap-1.5',
        xl: 'text-lg px-3 gap-1.5',
    };

    const heightClasses = {
        sm: 'h-8',
        md: 'h-10',
        lg: 'h-11',
        xl: 'h-12',
    };

    const itemSizeClasses = {
        sm: 'text-sm px-2 py-1 pr-7',
        md: 'text-base pl-2 pr-8 py-1.5',
        lg: 'text-base px-3 py-2 pr-9',
        xl: 'text-lg px-3 py-2 pr-9',
    };
</script>

<!-- Native select: always rendered for OptionInput children -->
<!-- Touch: visible via transparent overlay / Mouse: screen-reader only -->
{#if $isTouchDevice}
    <div class="relative {className}">
        <div class="flex {heightClasses[size]} items-center justify-between gap-2 rounded-md border border-darkborderc
                    bg-transparent {sizeClasses[size]} text-textcolor select-none pointer-events-none">
            <span class="flex flex-1 text-left truncate">{selectedLabel || ' '}</span>
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
        aria-controls={listboxId}
        aria-expanded={open ? 'true' : 'false'}
        aria-haspopup="listbox"
        aria-activedescendant={activeDescendant}
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
        <span class="flex flex-1 text-left truncate">{selectedLabel || ' '}</span>
        <ChevronDownIcon class="size-4 shrink-0 text-textcolor2" />
    </div>

    {#if open}
        <div
            id={listboxId}
            bind:this={dropdownEl}
            role="listbox"
            class="fixed z-50 max-h-64 overflow-y-auto rounded-md bg-darkbg shadow-md
                   ring-1 ring-textcolor/10 p-1"
            style={dropdownStyle}
        >
            {#each extractedOptions as opt, i}
                <button
                    id={getOptionId(i)}
                    role="option"
                    aria-selected={opt.value === String(value)}
                    class="relative flex w-full items-center gap-2 rounded-md {itemSizeClasses[size]}
                           text-textcolor cursor-pointer select-none text-left whitespace-nowrap
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
