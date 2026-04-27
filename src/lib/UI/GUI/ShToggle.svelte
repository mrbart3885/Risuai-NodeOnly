<script lang="ts" module>
    // Sh toggle — vega-derived spec, sizes match ShButton (+1 step from
    // upstream vega for mobile/touch). See .agent/guide/ui.md.
    export type ShToggleVariant = 'default' | 'outline';
    export type ShToggleSize = 'default' | 'sm' | 'lg' | 'xs';
</script>

<script lang="ts">
    import type { Snippet } from 'svelte';
    import { Toggle } from 'bits-ui';
    import { cn } from 'src/lib/utils';

    interface Props {
        pressed?: boolean;
        onPressedChange?: (pressed: boolean) => void;
        variant?: ShToggleVariant;
        size?: ShToggleSize;
        disabled?: boolean;
        className?: string;
        children?: Snippet;
    }

    let {
        pressed = $bindable(false),
        onPressedChange,
        variant = 'outline',
        size = 'default',
        disabled = false,
        className = '',
        children,
    }: Props = $props();

    // text-base: 16px constant, mirroring ShButton. xs/sm sizes override below.
    const base =
        'inline-flex items-center justify-center gap-1.5 rounded-md text-base font-medium shrink-0 ' +
        'whitespace-nowrap transition-colors cursor-pointer outline-none select-none ' +
        'focus-visible:ring-2 focus-visible:ring-borderc/50 focus-visible:border-borderc ' +
        'disabled:opacity-50 disabled:pointer-events-none ' +
        '[&_svg]:pointer-events-none [&_svg]:shrink-0';

    const variantClasses: Record<ShToggleVariant, string> = {
        default:
            'bg-darkbg text-textcolor2 hover:bg-selected/30 hover:text-textcolor ' +
            'data-[state=on]:bg-selected data-[state=on]:text-textcolor',
        outline:
            'border border-darkborderc bg-transparent text-textcolor2 ' +
            'hover:bg-selected/30 hover:text-textcolor ' +
            'data-[state=on]:bg-selected data-[state=on]:text-textcolor data-[state=on]:border-borderc',
    };

    const sizeClasses: Record<ShToggleSize, string> = {
        default: 'h-10 min-w-10 px-2.5',
        sm: 'h-8 min-w-8 px-2.5 text-sm',
        xs: 'h-7 min-w-7 px-2 text-xs [&_svg]:size-3',
        lg: 'h-11 min-w-11 px-2.5',
    };

    const classes = $derived(cn(base, variantClasses[variant], sizeClasses[size], className));
</script>

<Toggle.Root bind:pressed {onPressedChange} {disabled} class={classes}>
    {@render children?.()}
</Toggle.Root>
