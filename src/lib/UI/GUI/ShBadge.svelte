<script lang="ts" module>
    // shadcn Badge variants — core set from shadcn-svelte (default/secondary/destructive/outline/ghost/link)
    // plus semantic additions (warning/info/success) for status/log UI.
    export type ShBadgeVariant =
        | 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link'
        | 'warning' | 'info' | 'success';
</script>

<script lang="ts">
    import type { Snippet } from 'svelte';
    import type { HTMLAttributes } from 'svelte/elements';
    import { cn } from 'src/lib/utils';

    interface Props extends HTMLAttributes<HTMLSpanElement> {
        variant?: ShBadgeVariant;
        className?: string;
        children?: Snippet;
    }

    let {
        variant = 'default',
        className = '',
        children,
        ...rest
    }: Props = $props();

    const base = 'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors';

    const variantClasses: Record<ShBadgeVariant, string> = {
        default: 'bg-selected/60 text-textcolor border-darkborderc',
        secondary: 'bg-darkbg text-textcolor2 border-darkborderc',
        destructive: 'bg-draculared/20 text-red-400 border-draculared/40',
        outline: 'bg-transparent text-textcolor2 border-darkborderc',
        ghost: 'bg-transparent text-textcolor2 border-transparent hover:bg-selected/30',
        link: 'bg-transparent text-borderc border-transparent underline-offset-4 hover:underline',
        warning: 'bg-yellow-900/30 text-yellow-400 border-yellow-700/40',
        info: 'bg-blue-900/30 text-blue-400 border-blue-700/40',
        success: 'bg-green-900/30 text-green-400 border-green-700/40',
    };
</script>

<span class={cn(base, variantClasses[variant], className)} {...rest}>
    {@render children?.()}
</span>
