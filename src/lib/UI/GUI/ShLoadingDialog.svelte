<script lang="ts">
    // Blocking loading modal — shadcn-pattern dialog for long-running operations
    // that must prevent user interaction (backup/restore, import, translation,
    // screenshot, etc.). Non-closable by design: no X button, ESC blocked,
    // outside click blocked. Shows a spinner + message, and an optional
    // progress bar when a percentage is provided.
    import type { Snippet } from 'svelte';
    import { Dialog } from 'bits-ui';
    import { LoaderCircleIcon } from '@lucide/svelte';
    import { cn } from 'src/lib/utils';
    import type { ShDialogTier } from './ShDialog.svelte';

    interface Props {
        open?: boolean;
        message?: string;
        submessage?: string;
        progress?: number | null;
        tier?: ShDialogTier;
        contentClass?: string;
        extra?: Snippet;
    }

    let {
        open = $bindable(false),
        message = '',
        submessage = '',
        progress = null,
        tier = 'alert',
        contentClass = '',
        extra,
    }: Props = $props();

    const clampedProgress = $derived(
        progress == null ? null : Math.max(0, Math.min(100, progress))
    );

    const tierClasses: Record<ShDialogTier, string> = {
        base: 'z-40',
        alert: 'z-50',
        top: 'z-[60]',
    };

    // w-[calc(100vw-2rem)] guarantees a 1rem gutter on each side at any
    // viewport (max-w-md caps the upper bound on desktop).
    const contentBase =
        'fixed left-1/2 top-1/2 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 ' +
        'bg-darkbg border border-darkborderc rounded-md shadow-lg ' +
        'p-6 flex flex-col gap-4 items-center outline-none ' +
        'data-[state=open]:animate-in data-[state=closed]:animate-out ' +
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 ' +
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95';
</script>

<Dialog.Root bind:open>
    <Dialog.Portal>
        <Dialog.Overlay
            class={cn('fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0', tierClasses[tier])}
        />
        <Dialog.Content
            class={cn(contentBase, tierClasses[tier], contentClass)}
            escapeKeydownBehavior="ignore"
            interactOutsideBehavior="ignore"
        >
            <Dialog.Title class="sr-only">Loading</Dialog.Title>
            <Dialog.Description class="sr-only">
                {message || 'Loading in progress. Please wait.'}
            </Dialog.Description>

            <LoaderCircleIcon class="size-8 text-borderc animate-spin shrink-0" />

            {#if message}
                <div class="text-textcolor text-center whitespace-pre-wrap break-words">
                    {message}
                </div>
            {/if}

            {#if submessage}
                <div class="text-textcolor2 text-sm text-center whitespace-pre-wrap break-words">
                    {submessage}
                </div>
            {/if}

            {#if clampedProgress != null}
                <div class="w-full flex flex-col gap-2 mt-2">
                    <div class="w-full h-2 bg-bgcolor border border-darkborderc rounded-md overflow-hidden">
                        <div
                            class="h-full bg-linear-to-r from-blue-500 to-purple-800 saving-animation transition-[width]"
                            style:width={clampedProgress + '%'}
                        ></div>
                    </div>
                    <div class="text-textcolor2 text-sm text-center">
                        {clampedProgress.toFixed(0)}%
                    </div>
                </div>
            {/if}

            {#if extra}
                {@render extra()}
            {/if}
        </Dialog.Content>
    </Dialog.Portal>
</Dialog.Root>
