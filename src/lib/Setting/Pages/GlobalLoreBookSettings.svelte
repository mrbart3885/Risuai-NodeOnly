<script lang="ts">
    import { language } from "src/lang";
    import Help from "src/lib/Others/Help.svelte";
    import SettingPage from "src/lib/UI/GUI/SettingPage.svelte";
    import LoreBookSetting from "src/lib/SideBars/LoreBook/LoreBookSetting.svelte";
    
    import { DBState } from 'src/ts/stores.svelte';
    interface Props {
      openLoreList?: boolean;
    }

  let { openLoreList = $bindable(false) }: Props = $props();
</script>
<SettingPage title={language.globalLoreBook}>
<button onclick={() => {openLoreList = true}} class="mt-4 drop-shadow-lg p-3 flex justify-center items-center ml-2 mr-2 rounded-lg bg-selected mb-4">{DBState.db.loreBook[DBState.db.loreBookPage].name}</button>

<LoreBookSetting globalMode />
</SettingPage>