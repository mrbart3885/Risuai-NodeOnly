<script lang="ts">
    import { DBState } from 'src/ts/stores.svelte';
    import Hub from "./Realm/RealmMain.svelte";
    import { OpenRealmStore, RealmInitialOpenChar } from "src/ts/stores.svelte";
    import { ArrowLeft } from "@lucide/svelte";
    import { getVersionString, openURL } from "src/ts/globalApi.svelte";
    import { language } from "src/lang";
    import { getRisuHub, hubAdditionalHTML } from "src/ts/characterCards";
    import RisuHubIcon from "./Realm/RealmHubIcon.svelte";
    import Title from "./Title.svelte";
    import { updateInfoStore } from "src/ts/update";

    const deploymentMarker = 'SHINYACAL-FORK';
</script>
<div class="h-full w-full flex flex-col overflow-y-auto items-center">
    {#if !$OpenRealmStore}
      <Title />
      <h3 class="text-textcolor2 mt-1">📦 NodeOnly v{getVersionString()}</h3>
      <div class="mt-2 inline-flex items-center rounded-full border border-selected bg-darkbg px-3 py-1 text-xs font-semibold tracking-[0.2em] text-textcolor">
        Deploy Marker {deploymentMarker}
      </div>
      {#if $updateInfoStore?.hasUpdate}
        <button
          class="mt-1.5 px-3 py-1 rounded-full text-sm font-medium transition-colors
            {$updateInfoStore.severity === 'optional'
              ? 'bg-green-900/30 text-green-400 border border-green-800/50 hover:bg-green-900/50'
              : 'bg-red-900/30 text-red-400 border border-red-800/50 hover:bg-red-900/50'}"
          onclick={() => openURL($updateInfoStore.releaseUrl)}
        >
          {#if $updateInfoStore.severity === 'outdated'}
            ⚠ {language.updateOutdated.replace('{{version}}', $updateInfoStore.latestVersion)}
          {:else if $updateInfoStore.severity === 'required'}
            ⚠ {language.updateRequired.replace('{{version}}', $updateInfoStore.latestVersion)}
          {:else}
            {language.updateAvailable.replace('{{version}}', $updateInfoStore.latestVersion)}
          {/if}
        </button>
      {/if}
    {/if}
    <div class="w-full flex p-4 flex-col text-textcolor max-w-4xl">
      {#if !$OpenRealmStore}
      <div class="mt-4 mb-4 w-full border-t border-t-selected"></div>
      <h1 class="text-2xl font-bold">Recently Uploaded<button class="text-base font-medium float-right p-1 bg-darkbg rounded-md hover:ring-3" onclick={() => {
        $OpenRealmStore = true
      }}>Get More</button></h1>
          {#if !DBState.db.hideRealm}
            {#await getRisuHub({
                  search: '',
                  page: 0,
                  nsfw: false,
                  sort: 'recommended'
              }) then charas}
            {#if charas.length > 0}
              {@html hubAdditionalHTML}
              <div class="w-full flex gap-4 p-2 flex-wrap justify-center">
                  {#each charas as chara}
                      <RisuHubIcon onClick={() => {
                        $OpenRealmStore = true
                        if(DBState.db.realmDirectOpen){
                            $RealmInitialOpenChar = chara
                        }
                      }} chara={chara} />
                  {/each}
              </div>
            {:else}
              <div class="text-textcolor2">Failed to load {language.hub}...</div>
            {/if}
          {/await}
        {:else}
          <div class="text-textcolor2">{language.hideRealm}</div>
        {/if}
      <div class="mt-4 mb-4 w-full border-t border-t-selected"></div>
      <h1 class="text-2xl font-bold mb-4">
        Related Links
      </h1>
        <div class="w-full flex gap-4 p-2 flex-wrap justify-center">
        <button class="bg-darkbg rounded-lg p-4 flex flex-col hover:bg-selected transition-colors relative lg:w-96 w-full items-start text-start" onclick={() => {
          openURL("https://discord.gg/Exy3NrqkGm")
        }}>
          <h2 class="text-xl">Discord</h2>
          <span class="text-textcolor2">
            Join our Discord server to chat with other users and the developer.
          </span>
        </button>
        <button class="bg-darkbg rounded-lg p-4 flex flex-col hover:bg-selected transition-colors relative lg:w-96 w-full items-start text-start" onclick={() => {
          openURL("https://risuai.net")
        }}>
          <h2 class="text-xl">
            Website
          </h2>
          <span class="text-textcolor2">
            See the official website for the project.
          </span>
        </button>
        <button class="bg-darkbg rounded-lg p-4 flex flex-col hover:bg-selected transition-colors relative lg:w-96 w-full items-start text-start" onclick={() => {
          openURL("https://github.com/kwaroran/RisuAI")
        }}>
          <h2 class="text-xl">Github</h2>
          <span class="text-textcolor2">
            View the source code and contribute to the project.
          </span>
        </button>
        <button class="bg-darkbg rounded-lg p-4 flex flex-col hover:bg-selected transition-colors relative lg:w-96 w-full items-start text-start" onclick={() => {
          openURL("mailto:support@risuai.net")
        }}>
          <h2 class="text-xl">Email</h2>
          <span class="text-textcolor2">
            Contact the developer directly.
          </span>
        </button>
      </div>

      {:else}
        <div class="flex items-center mt-4">
          <button class="mr-2 text-textcolor2 hover:text-green-500" onclick={() => ($OpenRealmStore = false)}>
            <ArrowLeft/>
          </button>
        </div>
        <Hub />
      {/if}
  </div>
</div>
