<script lang="ts">
    import { language } from "src/lang";
    import SettingPage from "src/lib/UI/GUI/SettingPage.svelte";
    import SettingTabs from "src/lib/UI/GUI/SettingTabs.svelte";
    import SettingRenderer from "../SettingRenderer.svelte";
    import {
        displayOtherSettingsItems,
        displaySizeSettingsItems,
        displayThemeSettingsItems,
    } from "src/ts/setting/displaySettingsData.svelte";

    let submenu = $state(0);
</script>

<SettingPage title={language.display}>
<SettingTabs
    tabs={[
        { label: language.theme, value: 0 },
        { label: language.sizeAndSpeed, value: 1 },
        { label: language.others, value: 2 },
    ]}
    bind:selected={submenu}
/>

{#if submenu === 0}
    <SettingRenderer items={displayThemeSettingsItems} />
{:else if submenu === 1}
    <SettingRenderer items={displaySizeSettingsItems} />
{:else if submenu === 2}
    <SettingRenderer items={displayOtherSettingsItems} />
{/if}
</SettingPage>
