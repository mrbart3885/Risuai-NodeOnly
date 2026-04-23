<script lang="ts">
    // shadcn-svelte Input — ported to RisuAI theme tokens.
    // See _reference/shadcn-components/input/input.svelte for source.
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

    const base =
        'flex h-8 w-full min-w-0 rounded-md border border-darkborderc bg-transparent px-3 py-1 text-sm ' +
        'text-textcolor placeholder:text-textcolor2 ' +
        'transition-colors outline-none ' +
        'focus-visible:border-borderc focus-visible:ring-2 focus-visible:ring-borderc/50 ' +
        'disabled:opacity-50 disabled:cursor-not-allowed ' +
        'file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium';
</script>

<input
    {type}
    bind:value
    class={cn(base, className)}
    data-slot="input"
    {...rest}
/>
