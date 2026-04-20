<script lang="ts">
    import SettingRenderer from "../SettingRenderer.svelte";
    import { accessibilitySettingsItems } from "src/ts/setting/accessibilitySettingsData";
    import SettingPage from "src/lib/UI/GUI/SettingPage.svelte";
    import { language } from "src/lang";
</script>

<SettingPage title={language.accessibility}>
<SettingRenderer items={accessibilitySettingsItems} />
</SettingPage>
