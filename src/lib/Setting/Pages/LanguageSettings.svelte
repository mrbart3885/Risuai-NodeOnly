<script lang="ts">
    import { languageSettingsItems, langState } from "src/ts/setting/languageSettingsData.svelte";
    import SettingRenderer from "../SettingRenderer.svelte";
    import { onMount } from "svelte";

    onMount(() => {
        langState.changed = false;
    });
</script>

<SettingRenderer items={languageSettingsItems} />
