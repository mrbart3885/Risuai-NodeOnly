<script lang="ts">
    import { language } from "src/lang";
    import { openURL } from "src/ts/globalApi.svelte";
    import SettingPage from "src/lib/UI/GUI/SettingPage.svelte";
</script>

<SettingPage title={language.community}>
<button
    onclick={async () => {openURL("https://github.com/kwaroran/RisuAI")}}
    class="drop-shadow-lg p-3 border-darkbutton border-solid mt-2 flex justify-center items-center ml-2 mr-2 border-1 hover:bg-selected text-sm">
    Github
</button>
<button
    onclick={async () => {openURL("https://discord.gg/JzP8tB9ZK8")}}
    class="drop-shadow-lg p-3 border-darkbutton border-solid mt-2 flex justify-center items-center ml-2 mr-2 border-1 hover:bg-selected text-sm">
    Discord
</button>
<button
    onclick={async () => {openURL("https://www.patreon.com/RisuAI")}}
    class="drop-shadow-lg p-3 border-darkbutton border-solid mt-2 flex justify-center items-center ml-2 mr-2 border-1 hover:bg-selected text-sm">
    Support Project
</button>
</SettingPage>