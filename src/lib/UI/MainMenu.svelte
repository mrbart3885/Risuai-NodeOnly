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
    import { updateInfoStore, updatePopupStore } from "src/ts/update";
    import { publicStatsStore } from "src/ts/publicStats";
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
          onclick={() => updatePopupStore.set($updateInfoStore)}
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
      {#if $publicStatsStore}
      <div class="mt-3 flex gap-2 flex-wrap justify-center">
        <span class="px-3 py-1 rounded-full text-xs bg-darkbg border border-selected text-textcolor2">
          👥 {language.statsUsersToday.replace('{{count}}', $publicStatsStore.dau.toLocaleString())}
          <span class="text-textcolor2/60">({language.statsYesterday.replace('{{count}}', $publicStatsStore.yesterdayDau.toLocaleString())})</span>
        </span>
        <span class="px-3 py-1 rounded-full text-xs bg-darkbg border border-selected text-textcolor2">
          📊 {language.statsVisitsToday.replace('{{count}}', $publicStatsStore.visits.toLocaleString())}
        </span>
      </div>
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
          openURL("https://github.com/mrbart3885/Risuai-NodeOnly")
        }}>
          <h2 class="text-xl">Github</h2>
          <span class="text-textcolor2">
            View the source code and contribute to the project.
          </span>
        </button>
        <div class="bg-darkbg rounded-lg p-4 flex flex-col relative lg:w-96 w-full items-start text-start border border-yellow-600">
          <span class="text-textcolor2">
            RisuAI NodeOnly는 공식 버전이 아닌 커뮤니티 버전입니다.
            이슈 제보는 <button class="text-yellow-500 underline hover:text-yellow-400" onclick={() => openURL("https://arca.live/b/characterai")}>아카라이브 AI 채팅 채널</button> 또는 <button class="text-yellow-500 underline hover:text-yellow-400" onclick={() => openURL("https://github.com/mrbart3885/Risuai-NodeOnly/issues")}>Github Issues</button>에 부탁드립니다.
          </span>
        </div>
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
