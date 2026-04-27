<script lang="ts" module>
    // shadcn-svelte AlertDialog — ported to RisuAI theme tokens.
    // For confirm-style blocking modals (no X button, requires explicit action/cancel).
    // See _reference/shadcn-components/alert-dialog/* for source patterns.
    export type ShAlertDialogSize = 'sm' | 'default' | 'lg';
</script>

<script lang="ts">
    import type { Snippet } from 'svelte';
    import { AlertDialog } from 'bits-ui';
    import { cn } from 'src/lib/utils';

    interface Props {
        open?: boolean;
        onOpenChange?: (open: boolean) => void;
        size?: ShAlertDialogSize;
        closeOnEscape?: boolean;
        closeOnOutsideClick?: boolean;
        contentClass?: string;
        title?: Snippet;
        description?: Snippet;
        footer?: Snippet;
        children?: Snippet;
    }

    let {
        open = $bindable(false),
        onOpenChange,
        size = 'default',
        closeOnEscape = false,
        closeOnOutsideClick = false,
        contentClass = '',
        title,
        description,
        footer,
        children,
    }: Props = $props();

    const sizeClasses: Record<ShAlertDialogSize, string> = {
        sm: 'max-w-sm',
        default: 'max-w-md',
        lg: 'max-w-2xl',
    };

    // w-[calc(100vw-2rem)] guarantees a 1rem gutter on each side at any
    // viewport (size class supplies max-width upper bound on desktop).
    const contentBase =
        'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 ' +
        'bg-darkbg border border-darkborderc rounded-md shadow-lg ' +
        'p-4 flex flex-col gap-4 max-h-[90vh] overflow-y-auto outline-none ' +
        'data-[state=open]:animate-in data-[state=closed]:animate-out ' +
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 ' +
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95';
</script>

<AlertDialog.Root bind:open {onOpenChange}>
    <AlertDialog.Portal>
        <AlertDialog.Overlay
            class="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <AlertDialog.Content
            class={cn(contentBase, sizeClasses[size], contentClass)}
            escapeKeydownBehavior={closeOnEscape ? 'close' : 'ignore'}
            interactOutsideBehavior={closeOnOutsideClick ? 'close' : 'ignore'}
        >
            {#if title || description}
                <div class="flex flex-col gap-1">
                    {#if title}
                        <AlertDialog.Title class="text-lg font-semibold text-textcolor leading-tight">
                            {@render title()}
                        </AlertDialog.Title>
                    {/if}
                    {#if description}
                        <AlertDialog.Description class="text-sm text-textcolor2">
                            {@render description()}
                        </AlertDialog.Description>
                    {/if}
                </div>
            {/if}

            {#if children}
                <div class="text-textcolor wrap-break-word">
                    {@render children()}
                </div>
            {/if}

            {#if footer}
                <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    {@render footer()}
                </div>
            {/if}
        </AlertDialog.Content>
    </AlertDialog.Portal>
</AlertDialog.Root>
