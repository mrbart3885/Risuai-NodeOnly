<script lang="ts">
    import type { SettingItem, SettingContext } from 'src/ts/setting/types';
    import { getLabel, getSettingValue } from 'src/ts/setting/utils';
    import Button from 'src/lib/UI/GUI/Button.svelte';
    import Help from 'src/lib/Others/Help.svelte';

    interface Props {
        item: SettingItem;
        ctx: SettingContext;
    }

    let { item, ctx }: Props = $props();

    // When `getValue` is provided, render a label section above the button and
    // use the resolved value as the button text — this lets a button reflect
    // the current selection (e.g. active theme preset name) while still showing
    // a stable section label and Help icon. Without `getValue`, the legacy
    // single-button layout is used (label rendered as button text).
    let withSectionLabel = $derived(item.getValue !== undefined);
    let buttonText = $derived(
        withSectionLabel
            ? String(getSettingValue(item, ctx) ?? '')
            : getLabel(item),
    );
</script>

{#if withSectionLabel}
    <span class="text-textcolor {item.classes ?? 'mt-4'}">
        {getLabel(item)}
        {#if item.helpKey}<Help key={item.helpKey as any}/>{/if}
    </span>
    <Button className="mt-2" onclick={item.options?.onClick}>
        {buttonText}
    </Button>
{:else}
    <Button
        className={item.classes ?? 'mt-4'}
        onclick={item.options?.onClick}
    >
        {buttonText}
    </Button>
{/if}
