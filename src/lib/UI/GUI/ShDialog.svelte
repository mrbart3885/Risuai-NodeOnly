<script lang="ts" module>
    // shadcn-svelte Dialog — ported to RisuAI theme tokens.
    // See _reference/shadcn-components/dialog/* for source patterns.
    export type ShDialogSize = 'sm' | 'default' | 'lg' | 'xl';
</script>

<script lang="ts">
    import type { Snippet } from 'svelte';
    import { Dialog } from 'bits-ui';
    import { XIcon } from '@lucide/svelte';
    import { cn } from 'src/lib/utils';

    interface Props {
        open?: boolean;
        onOpenChange?: (open: boolean) => void;
        size?: ShDialogSize;
        closable?: boolean;
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
        closable = true,
        closeOnEscape = false,
        closeOnOutsideClick = true,
        contentClass = '',
        title,
        description,
        footer,
        children,
    }: Props = $props();

    const sizeClasses: Record<ShDialogSize, string> = {
        sm: 'max-w-sm',
        default: 'max-w-md',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
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

<Dialog.Root bind:open {onOpenChange}>
    <Dialog.Portal>
        <Dialog.Overlay
            class="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <Dialog.Content
            class={cn(contentBase, sizeClasses[size], contentClass)}
            escapeKeydownBehavior={closeOnEscape ? 'close' : 'ignore'}
            interactOutsideBehavior={closeOnOutsideClick ? 'close' : 'ignore'}
        >
            {#if title || description || closable}
                <div class="flex flex-col gap-1 pr-8 relative">
                    {#if title}
                        <Dialog.Title class="text-lg font-semibold text-textcolor leading-tight">
                            {@render title()}
                        </Dialog.Title>
                    {/if}
                    {#if description}
                        <Dialog.Description class="text-sm text-textcolor2">
                            {@render description()}
                        </Dialog.Description>
                    {/if}
                    {#if closable}
                        <Dialog.Close
                            class="absolute right-0 top-0 text-textcolor2 hover:text-textcolor transition-colors rounded-sm focus-visible:ring-2 focus-visible:ring-borderc/50 outline-none cursor-pointer"
                            aria-label="Close"
                        >
                            <XIcon size={18} />
                        </Dialog.Close>
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
        </Dialog.Content>
    </Dialog.Portal>
</Dialog.Root>
