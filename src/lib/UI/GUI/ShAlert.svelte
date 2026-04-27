<script lang="ts" module>
    // Sh alert — vega-derived spec for inline informational/warning blocks.
    // See _reference/shadcn-components/alert/alert.svelte for source.
    //
    // Variants:
    //  - default: 중성 정보 박스
    //  - destructive: 위험/보안 경고 (draculared 톤)
    //  - warning: 주의 환기 (노랑)
    //  - info: 정보 안내 (파랑)
    //  - success: 성공/완료 (초록)
    //
    // Layout follows vega: 2-column grid when an icon snippet is provided,
    // single-column otherwise. Title/description rows align next to the
    // icon automatically. See .agent/guide/ui.md.
    export type ShAlertVariant = 'default' | 'destructive' | 'warning' | 'info' | 'success';
</script>

<script lang="ts">
    import type { Snippet } from 'svelte';
    import { cn } from 'src/lib/utils';

    interface Props {
        variant?: ShAlertVariant;
        className?: string;
        icon?: Snippet;
        title?: Snippet;
        children?: Snippet;
    }

    let {
        variant = 'default',
        className = '',
        icon,
        title,
        children,
    }: Props = $props();

    const base =
        'grid gap-0.5 rounded-md border px-4 py-3 text-base md:text-sm text-left';

    const variantClasses: Record<ShAlertVariant, string> = {
        default:     'bg-darkbg text-textcolor border-darkborderc',
        destructive: 'bg-draculared/20 text-red-300 border-draculared/40 [&_[data-slot=alert-icon]_svg]:text-red-400',
        warning:     'bg-yellow-900/30 text-yellow-300 border-yellow-700/40 [&_[data-slot=alert-icon]_svg]:text-yellow-400',
        info:        'bg-blue-900/30 text-blue-300 border-blue-700/40 [&_[data-slot=alert-icon]_svg]:text-blue-400',
        success:     'bg-green-900/30 text-green-300 border-green-700/40 [&_[data-slot=alert-icon]_svg]:text-green-400',
    };

    const layoutClasses = $derived(icon ? 'grid-cols-[auto_1fr] gap-x-2.5' : '');
</script>

<div role="alert" class={cn(base, variantClasses[variant], layoutClasses, className)}>
    {#if icon}
        <div
            data-slot="alert-icon"
            class="row-span-2 self-start translate-y-0.5 [&_svg]:size-4 [&_svg]:shrink-0"
        >
            {@render icon()}
        </div>
    {/if}
    {#if title}
        <div class="font-medium leading-snug">
            {@render title()}
        </div>
    {/if}
    {#if children}
        <div class="leading-relaxed opacity-90">
            {@render children()}
        </div>
    {/if}
</div>
