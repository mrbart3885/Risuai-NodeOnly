<script lang="ts">
    import { languageSettingsItems, langState } from "src/ts/setting/languageSettingsData.svelte";
    import SettingRenderer from "../SettingRenderer.svelte";
    import SettingPage from "src/lib/UI/GUI/SettingPage.svelte";
    import { language } from "src/lang";
    import { onMount } from "svelte";

    onMount(() => {
        langState.changed = false;
    });
</script>

<SettingPage title={language.language}>
<SettingRenderer items={languageSettingsItems} />
</SettingPage>
