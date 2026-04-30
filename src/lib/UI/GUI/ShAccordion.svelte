<script lang="ts" module>
    // Sh accordion — single-section collapsible. The codebase has no real
    // multi-item accordion grouping, so this is a Disclosure / Collapsible
    // pattern wearing the Accordion name (kept for continuity with the legacy
    // <Accordion> wrapper). See .agent/guide/ui.md for the variant rationale.
    export type ShAccordionVariant = 'card' | 'plain' | 'indent';

    let _shAccordionId = 0;
</script>

<script lang="ts">
    import { ChevronDown } from '@lucide/svelte';
    import { cn } from 'src/lib/utils';
    import type { Snippet } from 'svelte';

    interface Props {
        name?: string;
        variant?: ShAccordionVariant;
        open?: boolean;
        disabled?: boolean;
        trigger?: Snippet;
        extras?: Snippet;
        children?: Snippet;
        class?: string;
        bodyClass?: string;
    }

    let {
        name = '',
        variant = 'card',
        open = $bindable(false),
        disabled = false,
        trigger,
        extras,
        children,
        class: className = '',
        bodyClass = '',
    }: Props = $props();

    const uid = ++_shAccordionId;
    const triggerId = `sh-acc-trigger-${uid}`;
    const contentId = `sh-acc-content-${uid}`;

    const wrapperClass = $derived(
        variant === 'card'
            ? 'border border-darkborderc rounded-md overflow-hidden'
            : 'flex flex-col'
    );

    const bodyInnerClass = $derived(
        variant === 'card'
            ? 'border-t border-darkborderc p-2'
            : variant === 'indent'
                ? 'ml-3 pl-3 border-l border-darkborderc py-1'
                : ''
    );

    const triggerBase =
        'h-10 px-3 inline-flex items-center justify-between gap-2 text-base font-medium text-left transition-colors outline-none ' +
        'focus-visible:ring-2 focus-visible:ring-borderc/50 ' +
        'disabled:opacity-50 disabled:pointer-events-none ' +
        'hover:bg-selected/30';
</script>

<div class={cn(wrapperClass, className)}>
    <div class="flex items-stretch">
        <button
            id={triggerId}
            type="button"
            {disabled}
            aria-expanded={open}
            aria-controls={contentId}
            class={cn(triggerBase, 'flex-1 min-w-0')}
            onclick={() => (open = !open)}
        >
            <span class="flex-1 inline-flex items-center gap-2 min-w-0">
                {#if trigger}
                    {@render trigger()}
                {:else}
                    <span class="truncate">{name}</span>
                {/if}
            </span>
            <ChevronDown
                size={16}
                class={cn(
                    'shrink-0 transition-transform duration-150',
                    open && 'rotate-180'
                )}
            />
        </button>
        {#if extras}
            <div class="px-2 flex items-center shrink-0">
                {@render extras()}
            </div>
        {/if}
    </div>
    <div
        id={contentId}
        role="region"
        aria-labelledby={triggerId}
        aria-hidden={!open}
        inert={!open}
        class="grid transition-[grid-template-rows] duration-150"
        style:grid-template-rows={open ? '1fr' : '0fr'}
    >
        <div class="overflow-hidden">
            <div class={cn(bodyInnerClass, bodyClass)}>
                {@render children?.()}
            </div>
        </div>
    </div>
</div>
