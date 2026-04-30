<script lang="ts">
    // Sh input — vega-derived spec, height matches ShButton/ShToggle/SelectInput
    // default (h-10) so form rows align without per-control overrides.
    // See .agent/guide/ui.md.
    import type { HTMLInputAttributes } from 'svelte/elements';
    import { cn } from 'src/lib/utils';

    interface Props extends Omit<HTMLInputAttributes, 'class' | 'value'> {
        value?: string;
        className?: string;
    }

    let {
        value = $bindable(''),
        className = '',
        type = 'text',
        ...rest
    }: Props = $props();

    // text-base: 16px constant. Prevents iOS Safari's auto-zoom on focus
    // (which triggers when font-size < 16px) without the 768px jump.
    // min-h-10 paired with h-10: replaced elements like <input> sometimes
    // collapse to intrinsic height under flex, so the explicit min-height
    // pins the spec'd 40px. Same h-N + min-h-N pattern as the sidebar
    // buttons elsewhere in the codebase.
    const base =
        'flex h-10 min-h-10 w-full min-w-0 rounded-md border border-darkborderc bg-transparent px-2.5 py-1 text-base ' +
        'text-textcolor placeholder:text-textcolor2 ' +
        'transition-colors outline-none ' +
        'focus-visible:border-borderc focus-visible:ring-2 focus-visible:ring-borderc/50 ' +
        'disabled:opacity-50 disabled:cursor-not-allowed ' +
        'file:inline-flex file:h-8 file:border-0 file:bg-transparent file:text-sm file:font-medium';
</script>

<input
    {type}
    bind:value
    class={cn(base, className)}
    data-slot="input"
    {...rest}
/>
