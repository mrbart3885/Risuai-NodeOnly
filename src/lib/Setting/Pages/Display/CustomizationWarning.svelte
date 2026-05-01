<script lang="ts">
    import { language } from 'src/lang';
    import ShAlert from 'src/lib/UI/GUI/ShAlert.svelte';
    import { TriangleAlertIcon } from '@lucide/svelte';

    interface Props {
        messageKey: string;
    }

    let { messageKey }: Props = $props();
    let message = $derived((language as any)[messageKey] ?? '');
</script>

<ShAlert variant="warning" className="mt-2 mb-4">
    {#snippet icon()}<TriangleAlertIcon />{/snippet}
    {message}
</ShAlert>
