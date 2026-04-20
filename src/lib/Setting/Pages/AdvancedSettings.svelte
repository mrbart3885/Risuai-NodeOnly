<script lang="ts">
    import { advancedSettingsItems } from "src/ts/setting/advancedSettingsData";
    import SettingRenderer from "../SettingRenderer.svelte";
    import SettingPage from "src/lib/UI/GUI/SettingPage.svelte";
    import { language } from "src/lang";
</script>

<SettingPage title={language.advancedSettings}>
<SettingRenderer items={advancedSettingsItems} />
</SettingPage>
