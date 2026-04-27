<script lang="ts" module>
    // Sh button — vega-derived spec, sizes shifted +1 step for mixed
    // desktop/mobile use (NodeOnly is also accessed via Tailscale on phones).
    // See .agent/guide/ui.md "Sh* sizing scale" for the rationale and the
    // coordination with ShInput / ShToggle / SelectInput.
    export type ShButtonVariant = 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
    export type ShButtonSize = 'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg';
</script>

<script lang="ts">
    import type { Snippet } from 'svelte';
    import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
    import { cn } from 'src/lib/utils';

    type Props = (HTMLButtonAttributes & HTMLAnchorAttributes) & {
        variant?: ShButtonVariant;
        size?: ShButtonSize;
        href?: string;
        className?: string;
        children?: Snippet;
    };

    let {
        variant = 'default',
        size = 'default',
        href,
        className = '',
        disabled,
        type = 'button',
        children,
        ...rest
    }: Props = $props();

    // Layout + interaction base (identical for every variant/size).
    // text-base md:text-sm: derived spec for h-10 default — 16px on mobile
    // matches input/select for form alignment + iOS-zoom safety, 14px on
    // desktop keeps vega's compact tone. xs/sm sizes override below.
    const base =
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-base md:text-sm font-medium shrink-0 " +
        "transition-colors select-none outline-none " +
        "focus-visible:ring-2 focus-visible:ring-borderc/50 focus-visible:border-borderc " +
        "disabled:opacity-50 disabled:pointer-events-none " +
        "[&_svg]:shrink-0 [&_svg]:pointer-events-none";

    const variantClasses: Record<ShButtonVariant, string> = {
        default:     'bg-darkbutton text-textcolor border border-darkborderc hover:bg-selected',
        outline:     'bg-transparent text-textcolor border border-darkborderc hover:bg-selected/30',
        secondary:   'bg-darkbg text-textcolor border border-darkborderc hover:bg-selected',
        ghost:       'bg-transparent text-textcolor border border-transparent hover:bg-selected/30',
        destructive: 'bg-draculared/20 text-red-400 border border-draculared/40 hover:bg-draculared/30',
        link:        'bg-transparent text-borderc border-none underline-offset-4 hover:underline',
    };

    const sizeClasses: Record<ShButtonSize, string> = {
        default:   'h-10 px-2.5',
        xs:        'h-7 px-2 text-xs gap-1 [&_svg]:size-3',
        sm:        'h-8 px-2.5 text-sm gap-1',
        lg:        'h-11 px-2.5',
        icon:      'size-10 p-0',
        'icon-xs': 'size-7 p-0 [&_svg]:size-3',
        'icon-sm': 'size-8 p-0',
        'icon-lg': 'size-11 p-0',
    };

    const classes = $derived(cn(base, variantClasses[variant], sizeClasses[size], className));
</script>

{#if href}
    <a
        href={disabled ? undefined : href}
        aria-disabled={disabled}
        tabindex={disabled ? -1 : undefined}
        class={classes}
        data-slot="button"
        {...rest}
    >
        {@render children?.()}
    </a>
{:else}
    <button
        {type}
        {disabled}
        class={classes}
        data-slot="button"
        {...rest}
    >
        {@render children?.()}
    </button>
{/if}
