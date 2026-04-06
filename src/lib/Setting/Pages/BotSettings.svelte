<script lang="ts">

    import Check from "src/lib/UI/GUI/CheckInput.svelte";
    import { language } from "src/lang";
    import Help from "src/lib/Others/Help.svelte";
    
    import { DBState } from 'src/ts/stores.svelte';
    import { customProviderStore } from "src/ts/plugins/plugins.svelte";
    import { downloadFile } from "src/ts/globalApi.svelte";
    import { tokenizeAccurate, tokenizerList } from "src/ts/tokenizer";
    import ModelList from "src/lib/UI/ModelList.svelte";
    import DropList from "src/lib/SideBars/DropList.svelte";
    import { PlusIcon, TrashIcon, HardDriveUploadIcon, DownloadIcon, UploadIcon, CheckCircleIcon, XCircleIcon, LoaderIcon } from "@lucide/svelte";
    import { validateCopilotToken, fetchCopilotUsage, type CopilotUsageInfo } from "src/ts/process/request/copilot";
    import { validateNanoGPTKey, fetchNanoGPTBalance, fetchNanoGPTUsage, type NanoGPTBalance, type NanoGPTUsageInfo, type NanoGPTUsageMetric } from "src/ts/process/request/nanogpt";
    import TextInput from "src/lib/UI/GUI/TextInput.svelte";
    import NumberInput from "src/lib/UI/GUI/NumberInput.svelte";
    import SliderInput from "src/lib/UI/GUI/SliderInput.svelte";
    import TextAreaInput from "src/lib/UI/GUI/TextAreaInput.svelte";
    import Button from "src/lib/UI/GUI/Button.svelte";
    import SelectInput from "src/lib/UI/GUI/SelectInput.svelte";
    import OptionInput from "src/lib/UI/GUI/OptionInput.svelte";
    import { getOpenRouterModels } from "src/ts/model/openrouter";
    import OpenrouterModelGrid from "src/lib/UI/OpenrouterModelGrid.svelte";
    import OobaSettings from "./OobaSettings.svelte";
    import Accordion from "src/lib/UI/Accordion.svelte";
    import OpenrouterSettings from "./OpenrouterSettings.svelte";
    import ChatFormatSettings from "./ChatFormatSettings.svelte";
    import PromptSettings from "./PromptSettings.svelte";
    import { openPresetList } from "src/ts/stores.svelte";
    import { selectSingleFile } from "src/ts/util";
    import { getModelInfo, LLMFlags, LLMFormat, LLMProvider, LLMModels, registerCopilotModelsDynamic, registerNanoGPTModelsDynamic } from "src/ts/model/modellist";
    import RegexList from "src/lib/SideBars/Scripts/RegexList.svelte";
    import SettingRenderer from "../SettingRenderer.svelte";
    import { allBasicParameterItems } from "src/ts/setting/botSettingsParamsData";
    import SeparateParametersSection from "./SeparateParametersSection.svelte";
    import AuxModelSelectors from './Model/AuxModelSelectors.svelte'
    import { SUBMODEL_PARAMETER_LOCATION_HINT } from "src/ts/setting/auxModelCopy";
    
    let tokens = $state({
        mainPrompt: 0,
        jailbreak: 0,
        globalNote: 0,
    })

    interface Props {
        goPromptTemplate?: any;
    }

    let { goPromptTemplate = () => {} }: Props = $props();

    async function loadTokenize(){
        tokens.mainPrompt = await tokenizeAccurate(DBState.db.mainPrompt, true)
        tokens.jailbreak = await tokenizeAccurate(DBState.db.jailbreak, true)
        tokens.globalNote = await tokenizeAccurate(DBState.db.globalNote, true)
    }

    $effect.pre(() => {
        if(DBState.db.aiModel === 'textgen_webui' || DBState.db.subModel === 'mancer'){
            DBState.db.useStreaming = DBState.db.textgenWebUIStreamURL.startsWith("wss://")
        }
    });

    function clearVertexToken() {
        DBState.db.vertexAccessToken = '';
        DBState.db.vertexAccessTokenExpires = 0;
        console.log('Vertex AI token cleared');
    }

    let submenu = $state(DBState.db.useLegacyGUI ? -1 : 0)
    let modelInfo = $derived(getModelInfo(DBState.db.aiModel))
    let subModelInfo = $derived(getModelInfo(DBState.db.subModel))
    const dbAny = DBState.db as any

    let copilotModelSyncInFlight = false
    let nanogptModelSyncInFlight = false

    function ensureCopilotConfig() {
        if (!DBState.db.copilot) {
            DBState.db.copilot = {
                githubTokens: [],
                keyRotate: 'sequential',
                machineId: '',
                vsCodeVersion: '',
                chatVersion: ''
            }
        }
        DBState.db.copilot.githubTokens ??= []
        DBState.db.copilot.keyRotate ??= 'sequential'
        DBState.db.copilot.machineId ??= ''
        DBState.db.copilot.vsCodeVersion ??= ''
        DBState.db.copilot.chatVersion ??= ''
        return DBState.db.copilot
    }

    function ensureNanoGPTConfig() {
        if (!DBState.db.nanogpt) {
            DBState.db.nanogpt = { apiKeys: [], keyRotate: 'sequential' }
        }
        DBState.db.nanogpt.apiKeys ??= []
        DBState.db.nanogpt.keyRotate ??= 'sequential'
        return DBState.db.nanogpt
    }

    let copilotTokenStatus: Map<number, 'idle'|'loading'|'valid'|'invalid'> = $state(new Map())
    let copilotTokenErrors: Map<number, string> = $state(new Map())
    let copilotUsage: CopilotUsageInfo | null = $state(null)
    let copilotUsageLoading = $state(false)
    let copilotUsageError = $state('')
    let copilotModelSyncStatus: 'idle'|'loading'|'done'|'error' = $state('idle')
    let copilotModelSyncCount = $state(0)

    async function verifyCopilotToken(index: number) {
        const token = ensureCopilotConfig().githubTokens[index]
        if (!token) return
        copilotTokenStatus = new Map(copilotTokenStatus.set(index, 'loading'))
        const result = await validateCopilotToken(token)
        copilotTokenStatus = new Map(copilotTokenStatus.set(index, result.valid ? 'valid' : 'invalid'))
        if (!result.valid) {
            copilotTokenErrors = new Map(copilotTokenErrors.set(index, result.error ?? 'Unknown error'))
        }
    }

    async function loadCopilotUsage() {
        if (copilotUsageLoading) return
        const token = ensureCopilotConfig().githubTokens[0]
        if (!token) return
        copilotUsageLoading = true
        copilotUsageError = ''
        const result = await fetchCopilotUsage(token)
        copilotUsage = result.usage
        copilotUsageError = result.error ?? ''
        copilotUsageLoading = false
    }

    async function syncCopilotModels() {
        if (copilotModelSyncStatus === 'loading' || copilotModelSyncInFlight) return
        copilotModelSyncStatus = 'loading'
        copilotModelSyncInFlight = true
        try {
            await registerCopilotModelsDynamic()
            copilotModelSyncCount = LLMModels.filter((model) => model.provider === LLMProvider.Copilot).length
            copilotModelSyncStatus = 'done'
        }
        catch {
            copilotModelSyncStatus = 'error'
        }
        finally {
            copilotModelSyncInFlight = false
        }
    }

    let nanogptKeyStatus: Map<number, 'idle'|'loading'|'valid'|'invalid'> = $state(new Map())
    let nanogptKeyErrors: Map<number, string> = $state(new Map())
    let nanogptBalance: NanoGPTBalance | null = $state(null)
    let nanogptUsage: NanoGPTUsageInfo | null = $state(null)
    let nanogptInfoLoading = $state(false)
    let nanogptInfoError = $state('')
    let nanogptModelSyncStatus: 'idle'|'loading'|'done'|'error' = $state('idle')
    let nanogptModelSyncCount = $state(0)

    async function verifyNanoGPTKey(index: number) {
        const key = ensureNanoGPTConfig().apiKeys[index]
        if (!key) return
        nanogptKeyStatus = new Map(nanogptKeyStatus.set(index, 'loading'))
        const result = await validateNanoGPTKey(key)
        nanogptKeyStatus = new Map(nanogptKeyStatus.set(index, result.valid ? 'valid' : 'invalid'))
        if (!result.valid) {
            nanogptKeyErrors = new Map(nanogptKeyErrors.set(index, result.error ?? 'Unknown error'))
        }
    }

    async function loadNanoGPTInfo() {
        if (nanogptInfoLoading) return
        const key = ensureNanoGPTConfig().apiKeys[0]
        if (!key) return
        nanogptInfoLoading = true
        nanogptInfoError = ''
        const [balanceResult, usageResult] = await Promise.all([
            fetchNanoGPTBalance(key),
            fetchNanoGPTUsage(key),
        ])
        nanogptBalance = balanceResult.balance
        nanogptUsage = usageResult.usage
        nanogptInfoError = balanceResult.error || usageResult.error || ''
        nanogptInfoLoading = false
    }

    async function syncNanoGPTModels() {
        if (nanogptModelSyncStatus === 'loading' || nanogptModelSyncInFlight) return
        nanogptModelSyncStatus = 'loading'
        nanogptModelSyncInFlight = true
        try {
            await registerNanoGPTModelsDynamic()
            nanogptModelSyncCount = LLMModels.filter((model) => model.provider === LLMProvider.NanoGPT).length
            nanogptModelSyncStatus = 'done'
        }
        catch {
            nanogptModelSyncStatus = 'error'
        }
        finally {
            nanogptModelSyncInFlight = false
        }
    }

    function formatUsageCount(value: number | null) {
        if (value === null) return 'No limit'
        return new Intl.NumberFormat().format(value)
    }

    function formatUsagePercent(value: number) {
        return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}%`
    }

    function formatUsageReset(value: number | null) {
        if (value === null) return ''
        return new Date(value).toLocaleDateString()
    }

    function usageBarColor(metric: NanoGPTUsageMetric) {
        if (metric.progress >= 0.9) return 'bg-draculared'
        if (metric.progress >= 0.7) return 'bg-yellow-500'
        return 'bg-green-500'
    }
</script>
<h2 class="mb-2 text-2xl font-bold mt-2">{language.chatBot}</h2>

{#if submenu !== -1}
    <div class="flex w-full rounded-md border border-darkborderc mb-4">
        <button onclick={() => {
            submenu = 0
        }} class="p-2 flex-1 border-r border-darkborderc" class:bg-darkbutton={submenu === 0}>
            <span>{language.model}</span>
        </button>
        <button onclick={() => {
            submenu = 1
        }} class="p2 flex-1 border-r border-darkborderc" class:bg-darkbutton={submenu === 1}>
            <span>{language.parameters}</span>
        </button>
        <button onclick={() => {
            submenu = 2
        }} class="p-2 flex-1 border-r border-darkborderc" class:bg-darkbutton={submenu === 2}>
            <span>{language.prompt}</span>
        </button>
        <button onclick={() => {
            submenu = 3
        }} class="p-2 flex-1" class:bg-darkbutton={submenu === 3}>
            <span>{language.others}</span>
        </button>
    </div>
{/if}

{#if submenu === 0 || submenu === -1}
    <span class="text-textcolor mt-4">{language.model} <Help key="model"/></span>
    <ModelList bind:value={DBState.db.aiModel}/>

    <span class="text-textcolor mt-2">{language.submodel} <Help key="submodel"/></span>
    <ModelList bind:value={DBState.db.subModel}/>
    <p class="text-xs text-textcolor2 mt-1 mb-2">{SUBMODEL_PARAMETER_LOCATION_HINT}</p>

    {#if modelInfo.provider === LLMProvider.GoogleCloud || subModelInfo.provider === LLMProvider.GoogleCloud}
        <span class="text-textcolor">GoogleAI API Key</span>
        <TextInput marginBottom={true} size={"sm"} placeholder="..." hideText={DBState.db.hideApiKey} bind:value={DBState.db.google.accessToken}/>
    {/if}
    {#if modelInfo.provider === LLMProvider.VertexAI || subModelInfo.provider === LLMProvider.VertexAI}
        <span class="text-textcolor">Project ID</span>
        <TextInput marginBottom={true} size={"sm"} placeholder="..." bind:value={DBState.db.google.projectId} oninput={clearVertexToken}/>
        <span class="text-textcolor">Vertex Client Email</span>
        <TextInput marginBottom={true} size={"sm"} placeholder="..." bind:value={DBState.db.vertexClientEmail} oninput={clearVertexToken}/>
        <span class="text-textcolor">Vertex Private Key</span>
        <TextInput marginBottom={true} size={"sm"} placeholder="..." hideText={DBState.db.hideApiKey} bind:value={DBState.db.vertexPrivateKey} oninput={clearVertexToken}/>
        <span class="text-textcolor">Region</span>
        <SelectInput value={DBState.db.vertexRegion} onchange={(e) => {
            DBState.db.vertexRegion = e.currentTarget.value
            clearVertexToken()
        }}>
            <OptionInput value={'global'}>
                global
            </OptionInput>
            <OptionInput value={'us-central1'}>
                us-central1
            </OptionInput>
            <OptionInput value={'us-west1'}>
                us-west1
            </OptionInput>
        </SelectInput>    
    {/if}
    {#if modelInfo.provider === LLMProvider.NovelList || subModelInfo.provider === LLMProvider.NovelList}
        <span class="text-textcolor">NovelList {language.apiKey}</span>
        <TextInput hideText={DBState.db.hideApiKey} marginBottom={true} size={"sm"} placeholder="..." bind:value={DBState.db.novellistAPI}/>
    {/if}
    {#if DBState.db.aiModel.startsWith('mancer') || DBState.db.subModel.startsWith('mancer')}
        <span class="text-textcolor">Mancer {language.apiKey}</span>
        <TextInput hideText={DBState.db.hideApiKey} marginBottom={true} size={"sm"} placeholder="..." bind:value={DBState.db.mancerHeader}/>
    {/if}
    {#if modelInfo.provider === LLMProvider.Anthropic || subModelInfo.provider === LLMProvider.Anthropic
            || modelInfo.provider === LLMProvider.AWS || subModelInfo.provider === LLMProvider.AWS }
        <span class="text-textcolor">Claude {language.apiKey}</span>
        <TextInput hideText={DBState.db.hideApiKey} marginBottom={true} size={"sm"} placeholder="..." bind:value={DBState.db.claudeAPIKey}/>
    {/if}
    {#if modelInfo.provider === LLMProvider.Copilot || subModelInfo.provider === LLMProvider.Copilot}
        <Accordion name="GitHub Copilot" styled>
            <span class="text-textcolor2 text-xs mb-2 block">GitHub Personal Access Token (copilot scope required)</span>
            {#each dbAny.copilot?.githubTokens ?? [] as token, i}
                <div class="flex items-center gap-2 mb-1">
                    <div class="flex-1">
                        <TextInput hideText={DBState.db.hideApiKey} size={"sm"} placeholder="ghp_xxxxxxxxxxxx" bind:value={dbAny.copilot.githubTokens[i]}/>
                    </div>
                    <button class="text-textcolor2 hover:text-green-500 cursor-pointer" title="Verify token" onclick={() => verifyCopilotToken(i)}>
                        {#if copilotTokenStatus.get(i) === 'loading'}
                            <LoaderIcon size={16} class="animate-spin"/>
                        {:else if copilotTokenStatus.get(i) === 'valid'}
                            <CheckCircleIcon size={16} class="text-green-500"/>
                        {:else if copilotTokenStatus.get(i) === 'invalid'}
                            <XCircleIcon size={16} class="text-draculared"/>
                        {:else}
                            <CheckCircleIcon size={16}/>
                        {/if}
                    </button>
                    <button class="text-textcolor2 hover:text-draculared cursor-pointer" onclick={() => {
                        dbAny.copilot.githubTokens = dbAny.copilot.githubTokens.filter((_, idx) => idx !== i)
                        copilotTokenStatus = new Map([...copilotTokenStatus].filter(([key]) => key !== i))
                    }}>
                        <TrashIcon size={16}/>
                    </button>
                </div>
                {#if copilotTokenStatus.get(i) === 'invalid'}
                    <span class="text-draculared text-xs mb-2 block">{copilotTokenErrors.get(i) ?? 'Invalid token'}</span>
                {:else if copilotTokenStatus.get(i) === 'valid'}
                    <span class="text-green-500 text-xs mb-2 block">Token verified</span>
                {/if}
            {/each}
            <button class="flex items-center gap-1 text-textcolor2 hover:text-green-500 cursor-pointer mb-3" onclick={() => {
                ensureCopilotConfig()
                dbAny.copilot.githubTokens = [...dbAny.copilot.githubTokens, '']
            }}>
                <PlusIcon size={16}/> <span class="text-sm">Add Token</span>
            </button>
            {#if (dbAny.copilot?.githubTokens?.length ?? 0) > 1}
                <span class="text-textcolor text-sm">Key Rotation</span>
                <SelectInput bind:value={dbAny.copilot.keyRotate}>
                    <OptionInput value="sequential">Sequential</OptionInput>
                    <OptionInput value="on-error">On Error</OptionInput>
                </SelectInput>
            {/if}

            <Accordion name="Version Override" styled>
                <span class="text-textcolor2 text-xs mb-2 block">Leave empty for defaults. Check latest versions:</span>
                <div class="flex gap-2 mb-2 text-xs">
                    <a href="https://code.visualstudio.com/updates/" target="_blank" rel="noopener" class="text-blue-400 hover:text-blue-300 underline">VS Code Releases</a>
                    <a href="https://github.com/microsoft/vscode-copilot-chat/releases/latest" target="_blank" rel="noopener" class="text-blue-400 hover:text-blue-300 underline">Copilot Chat Releases</a>
                </div>
                <span class="text-textcolor text-sm">VS Code Version</span>
                <TextInput size={"sm"} placeholder="1.111.0" bind:value={dbAny.copilot.vsCodeVersion}/>
                <span class="text-textcolor text-sm mt-2">Copilot Chat Version</span>
                <TextInput size={"sm"} placeholder="0.39.2" bind:value={dbAny.copilot.chatVersion}/>
            </Accordion>

            {#if (dbAny.copilot?.githubTokens?.length ?? 0) > 0}
                <div class="border-t border-darkborderc mt-3 pt-3">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-textcolor text-sm font-semibold">Usage / Quota</span>
                        <button class="text-xs text-textcolor2 hover:text-green-500 cursor-pointer" onclick={loadCopilotUsage}>
                            {copilotUsageLoading ? 'Loading...' : 'Refresh'}
                        </button>
                    </div>
                    {#if copilotUsageError}
                        <span class="text-draculared text-xs block">{copilotUsageError}</span>
                    {/if}
                    {#if copilotUsage}
                        <div class="text-xs text-textcolor2 space-y-2">
                            <div class="flex gap-3">
                                <span>Plan: <span class="text-textcolor font-medium">{copilotUsage.planType}</span></span>
                                <span>Account: <span class="text-textcolor font-medium">{copilotUsage.login}</span></span>
                            </div>
                            {#each copilotUsage.quotas as quota}
                                <div class="border border-darkborderc rounded p-2">
                                    <div class="flex justify-between mb-1">
                                        <span class="text-textcolor capitalize">{quota.quotaId.replace(/_/g, ' ')}</span>
                                        {#if quota.unlimited}
                                            <span class="text-green-500">Unlimited</span>
                                        {:else}
                                            <span class="text-textcolor">{quota.remaining} / {quota.entitlement}</span>
                                        {/if}
                                    </div>
                                    {#if !quota.unlimited}
                                        <div class="w-full bg-darkborderc rounded-full h-1.5">
                                            <div
                                                class="h-1.5 rounded-full transition-all"
                                                class:bg-green-500={quota.percentRemaining > 30}
                                                class:bg-yellow-500={quota.percentRemaining <= 30 && quota.percentRemaining > 10}
                                                class:bg-draculared={quota.percentRemaining <= 10}
                                                style="width: {100 - quota.percentRemaining}%"
                                            ></div>
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                            {#if copilotUsage.quotaResetDate}
                                <div>Resets: <span class="text-textcolor">{copilotUsage.quotaResetDate}</span></div>
                            {/if}
                        </div>
                    {:else if !copilotUsageLoading}
                        <span class="text-textcolor2 text-xs">Click Refresh to load usage info</span>
                    {/if}
                </div>

                <div class="border-t border-darkborderc mt-3 pt-3">
                    <div class="flex items-center justify-between">
                        <span class="text-textcolor text-sm font-semibold">Models</span>
                        <button class="text-xs text-textcolor2 hover:text-green-500 cursor-pointer" onclick={syncCopilotModels}>
                            {copilotModelSyncStatus === 'loading' ? 'Syncing...' : 'Sync Models'}
                        </button>
                    </div>
                    {#if copilotModelSyncStatus === 'done'}
                        <span class="text-green-500 text-xs mt-1 block">{copilotModelSyncCount} models available. Reload model list to see new models.</span>
                    {:else if copilotModelSyncStatus === 'error'}
                        <span class="text-draculared text-xs mt-1 block">Failed to sync models</span>
                    {:else}
                        <span class="text-textcolor2 text-xs mt-1 block">Fetch available models from Copilot API</span>
                    {/if}
                </div>
            {/if}
        </Accordion>
    {/if}
    {#if modelInfo.provider === LLMProvider.NanoGPT || subModelInfo.provider === LLMProvider.NanoGPT}
        <Accordion name="NanoGPT" styled>
            <span class="text-textcolor2 text-xs mb-2 block">NanoGPT API Key</span>
            {#each dbAny.nanogpt?.apiKeys ?? [] as key, i}
                <div class="flex items-center gap-2 mb-1">
                    <div class="flex-1">
                        <TextInput hideText={DBState.db.hideApiKey} size={"sm"} placeholder="nano-xxxxxxxxxxxxxxxx" bind:value={dbAny.nanogpt.apiKeys[i]}/>
                    </div>
                    <button class="text-textcolor2 hover:text-green-500 cursor-pointer" title="Verify key" onclick={() => verifyNanoGPTKey(i)}>
                        {#if nanogptKeyStatus.get(i) === 'loading'}
                            <LoaderIcon size={16} class="animate-spin"/>
                        {:else if nanogptKeyStatus.get(i) === 'valid'}
                            <CheckCircleIcon size={16} class="text-green-500"/>
                        {:else if nanogptKeyStatus.get(i) === 'invalid'}
                            <XCircleIcon size={16} class="text-draculared"/>
                        {:else}
                            <CheckCircleIcon size={16}/>
                        {/if}
                    </button>
                    <button class="text-textcolor2 hover:text-draculared cursor-pointer" onclick={() => {
                        dbAny.nanogpt.apiKeys = dbAny.nanogpt.apiKeys.filter((_, idx) => idx !== i)
                        nanogptKeyStatus = new Map([...nanogptKeyStatus].filter(([keyIndex]) => keyIndex !== i))
                    }}>
                        <TrashIcon size={16}/>
                    </button>
                </div>
                {#if nanogptKeyStatus.get(i) === 'invalid'}
                    <span class="text-draculared text-xs mb-2 block">{nanogptKeyErrors.get(i) ?? 'Invalid key'}</span>
                {:else if nanogptKeyStatus.get(i) === 'valid'}
                    <span class="text-green-500 text-xs mb-2 block">Key verified</span>
                {/if}
            {/each}
            <button class="flex items-center gap-1 text-textcolor2 hover:text-green-500 cursor-pointer mb-3" onclick={() => {
                ensureNanoGPTConfig()
                dbAny.nanogpt.apiKeys = [...dbAny.nanogpt.apiKeys, '']
            }}>
                <PlusIcon size={16}/> <span class="text-sm">Add Key</span>
            </button>
            {#if (dbAny.nanogpt?.apiKeys?.length ?? 0) > 1}
                <span class="text-textcolor text-sm">Key Rotation</span>
                <SelectInput bind:value={dbAny.nanogpt.keyRotate}>
                    <OptionInput value="sequential">Sequential</OptionInput>
                    <OptionInput value="on-error">On Error</OptionInput>
                </SelectInput>
            {/if}

            {#if (dbAny.nanogpt?.apiKeys?.length ?? 0) > 0}
                <div class="border-t border-darkborderc mt-3 pt-3">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-textcolor text-sm font-semibold">Balance / Usage</span>
                        <button class="text-xs text-textcolor2 hover:text-green-500 cursor-pointer" onclick={loadNanoGPTInfo}>
                            {nanogptInfoLoading ? 'Loading...' : 'Refresh'}
                        </button>
                    </div>
                    {#if nanogptInfoError}
                        <span class="text-draculared text-xs block">{nanogptInfoError}</span>
                    {/if}
                    {#if nanogptBalance}
                        <div class="text-xs text-textcolor2 space-y-2 mb-2">
                            <div class="flex gap-3">
                                <span>USD: <span class="text-textcolor font-medium">${parseFloat(nanogptBalance.usdBalance).toFixed(2)}</span></span>
                                <span>NANO: <span class="text-textcolor font-medium">{parseFloat(nanogptBalance.nanoBalance).toFixed(4)}</span></span>
                            </div>
                        </div>
                    {/if}
                    {#if nanogptUsage}
                        <div class="text-xs text-textcolor2 space-y-2">
                            <div class="flex gap-3 flex-wrap">
                                <span>Status: <span class="text-textcolor font-medium capitalize">{nanogptUsage.state}</span></span>
                                <span>Provider: <span class="text-textcolor font-medium capitalize">{nanogptUsage.provider}</span></span>
                                {#if nanogptUsage.periodEnd}
                                    <span>Period ends: <span class="text-textcolor">{new Date(nanogptUsage.periodEnd).toLocaleDateString()}</span></span>
                                {/if}
                                {#if nanogptUsage.cancelAt}
                                    <span>Cancel at: <span class="text-textcolor">{new Date(nanogptUsage.cancelAt).toLocaleDateString()}</span></span>
                                {/if}
                            </div>
                            {#if nanogptUsage.weeklyInputTokens}
                                <div>
                                    <div class="flex justify-between mb-1 gap-3">
                                        <span>Weekly Input Tokens</span>
                                        <span>{formatUsageCount(nanogptUsage.weeklyInputTokens.used)} / {formatUsageCount(nanogptUsage.weeklyInputTokens.limit)}</span>
                                    </div>
                                    <div class="w-full bg-darkborderc rounded-full h-1.5">
                                        <div
                                            class={`h-1.5 rounded-full transition-all ${usageBarColor(nanogptUsage.weeklyInputTokens)}`}
                                            style="width: {Math.min(nanogptUsage.weeklyInputTokens.progress * 100, 100)}%"
                                        ></div>
                                    </div>
                                    <div class="flex justify-between mt-1">
                                        <span>{formatUsagePercent(nanogptUsage.weeklyInputTokens.percentUsed)} used</span>
                                        {#if nanogptUsage.weeklyInputTokens.resetAt}
                                            <span>Resets: {formatUsageReset(nanogptUsage.weeklyInputTokens.resetAt)}</span>
                                        {/if}
                                    </div>
                                </div>
                            {/if}
                            {#if nanogptUsage.dailyImages}
                                <div>
                                    <div class="flex justify-between mb-1 gap-3">
                                        <span>Daily Images</span>
                                        <span>{formatUsageCount(nanogptUsage.dailyImages.used)} / {formatUsageCount(nanogptUsage.dailyImages.limit)}</span>
                                    </div>
                                    <div class="w-full bg-darkborderc rounded-full h-1.5">
                                        <div
                                            class={`h-1.5 rounded-full transition-all ${usageBarColor(nanogptUsage.dailyImages)}`}
                                            style="width: {Math.min(nanogptUsage.dailyImages.progress * 100, 100)}%"
                                        ></div>
                                    </div>
                                    <div class="flex justify-between mt-1">
                                        <span>{formatUsagePercent(nanogptUsage.dailyImages.percentUsed)} used</span>
                                        {#if nanogptUsage.dailyImages.resetAt}
                                            <span>Resets: {formatUsageReset(nanogptUsage.dailyImages.resetAt)}</span>
                                        {/if}
                                    </div>
                                </div>
                            {/if}
                            {#if nanogptUsage.dailyInputTokens}
                                <div>
                                    <div class="flex justify-between mb-1 gap-3">
                                        <span>Daily Input Tokens</span>
                                        <span>{formatUsageCount(nanogptUsage.dailyInputTokens.used)} / {formatUsageCount(nanogptUsage.dailyInputTokens.limit)}</span>
                                    </div>
                                    <div class="w-full bg-darkborderc rounded-full h-1.5">
                                        <div
                                            class={`h-1.5 rounded-full transition-all ${usageBarColor(nanogptUsage.dailyInputTokens)}`}
                                            style="width: {Math.min(nanogptUsage.dailyInputTokens.progress * 100, 100)}%"
                                        ></div>
                                    </div>
                                    <div class="flex justify-between mt-1">
                                        <span>{formatUsagePercent(nanogptUsage.dailyInputTokens.percentUsed)} used</span>
                                        {#if nanogptUsage.dailyInputTokens.resetAt}
                                            <span>Resets: {formatUsageReset(nanogptUsage.dailyInputTokens.resetAt)}</span>
                                        {/if}
                                    </div>
                                </div>
                            {/if}
                        </div>
                    {:else if !nanogptInfoLoading && !nanogptBalance}
                        <span class="text-textcolor2 text-xs">Click Refresh to load balance and usage info</span>
                    {/if}
                </div>

                <div class="border-t border-darkborderc mt-3 pt-3">
                    <div class="flex items-center justify-between">
                        <span class="text-textcolor text-sm font-semibold">Models</span>
                        <button class="text-xs text-textcolor2 hover:text-green-500 cursor-pointer" onclick={syncNanoGPTModels}>
                            {nanogptModelSyncStatus === 'loading' ? 'Syncing...' : 'Sync Models'}
                        </button>
                    </div>
                    {#if nanogptModelSyncStatus === 'done'}
                        <span class="text-green-500 text-xs mt-1 block">{nanogptModelSyncCount} models available. Reload model list to see new models.</span>
                    {:else if nanogptModelSyncStatus === 'error'}
                        <span class="text-draculared text-xs mt-1 block">Failed to sync models</span>
                    {:else}
                        <span class="text-textcolor2 text-xs mt-1 block">Fetch available models from NanoGPT API</span>
                    {/if}
                </div>
            {/if}
        </Accordion>
    {/if}
    {#if modelInfo.provider === LLMProvider.Mistral || subModelInfo.provider === LLMProvider.Mistral}
        <span class="text-textcolor">Mistral {language.apiKey}</span>
        <TextInput hideText={DBState.db.hideApiKey} marginBottom={true} size={"sm"} placeholder="..." bind:value={DBState.db.mistralKey}/>
    {/if}
    {#if modelInfo.provider === LLMProvider.NovelAI || subModelInfo.provider === LLMProvider.NovelAI}
        <span class="text-textcolor">NovelAI Bearer Token</span>
        <TextInput bind:value={DBState.db.novelai.token}/>
    {/if}
    {#if DBState.db.aiModel === 'reverse_proxy' || DBState.db.subModel === 'reverse_proxy'}
        <span class="text-textcolor mt-2">URL <Help key="forceUrl"/></span>
        <TextInput marginBottom={false} size={"sm"} bind:value={DBState.db.forceReplaceUrl} placeholder="https//..." />
        <span class="text-textcolor mt-4"> {language.proxyAPIKey}</span>
        <TextInput hideText={DBState.db.hideApiKey} marginBottom={false} size={"sm"} placeholder="leave it blank if it hasn't password" bind:value={DBState.db.proxyKey} />
        <span class="text-textcolor mt-4"> {language.proxyRequestModel}</span>
        <TextInput marginBottom={false} size={"sm"} bind:value={DBState.db.customProxyRequestModel} placeholder="Name" />
        <span class="text-textcolor mt-4"> {language.format}</span>
        <SelectInput value={DBState.db.customAPIFormat.toString()} onchange={(e) => {
            DBState.db.customAPIFormat = parseInt(e.currentTarget.value) as LLMFormat
        }}>
            <OptionInput value={LLMFormat.OpenAICompatible.toString()}>
                OpenAI Compatible
            </OptionInput>
            <OptionInput value={LLMFormat.OpenAIResponseAPI.toString()}>
                OpenAI Response API
            </OptionInput>
            <OptionInput value={LLMFormat.Anthropic.toString()}>
                Anthropic Claude
            </OptionInput>
            <OptionInput value={LLMFormat.Mistral.toString()}>
                Mistral
            </OptionInput>
            <OptionInput value={LLMFormat.GoogleCloud.toString()}>
                Google Cloud
            </OptionInput>
            <OptionInput value={LLMFormat.Cohere.toString()}>
                Cohere
            </OptionInput>
        </SelectInput>
    {/if}
    {#if modelInfo.provider === LLMProvider.Cohere || subModelInfo.provider === LLMProvider.Cohere}
        <span class="text-textcolor mt-4">Cohere {language.apiKey}</span>
        <TextInput hideText={DBState.db.hideApiKey} marginBottom={false} size={"sm"} bind:value={DBState.db.cohereAPIKey} />
    {/if}
    {#if DBState.db.aiModel === 'ollama-hosted'}
        <span class="text-textcolor mt-4">Ollama URL</span>
        <TextInput marginBottom={false} size={"sm"} bind:value={DBState.db.ollamaURL} />

        <span class="text-textcolor mt-4">Ollama Model</span>
        <TextInput marginBottom={false} size={"sm"} bind:value={DBState.db.ollamaModel} />
    {/if}
    {#if DBState.db.aiModel === 'openrouter' || DBState.db.subModel === 'openrouter'}
        <span class="text-textcolor mt-4">OpenRouter {language.apiKey}</span>
        <TextInput hideText={DBState.db.hideApiKey} marginBottom={false} size={"sm"} bind:value={DBState.db.openrouterKey} />

        <span class="text-textcolor mt-4">OpenRouter {language.model}</span>
        {#await getOpenRouterModels()}
            <OpenrouterModelGrid bind:value={DBState.db.openrouterRequestModel} loading={true} />
        {:then m}
            <OpenrouterModelGrid bind:value={DBState.db.openrouterRequestModel} models={m ?? []} />
        {/await}
    {/if}
    {#if DBState.db.aiModel === 'openrouter' || DBState.db.aiModel === 'reverse_proxy'}
        <span class="text-textcolor">{language.tokenizer}</span>
        <SelectInput bind:value={DBState.db.customTokenizer}>
            {#each tokenizerList as entry}
                <OptionInput value={entry[0]}>{entry[1]}</OptionInput>
            {/each}
        </SelectInput>
    {/if}
    {#if modelInfo.provider === LLMProvider.OpenAI || subModelInfo.provider === LLMProvider.OpenAI}
        <span class="text-textcolor">OpenAI {language.apiKey} <Help key="oaiapikey"/></span>
        <TextInput hideText={DBState.db.hideApiKey} marginBottom={false} size={"sm"} bind:value={DBState.db.openAIKey} placeholder="sk-XXXXXXXXXXXXXXXXXXXX"/>
    {/if}

    {#if modelInfo.keyIdentifier}
        <span class="text-textcolor">{modelInfo.name} {language.apiKey}</span>
        <TextInput hideText={DBState.db.hideApiKey} marginBottom={false} size={"sm"} bind:value={DBState.db.OaiCompAPIKeys[modelInfo.keyIdentifier]} placeholder="..."/>
    {/if}

    {#if subModelInfo.keyIdentifier && subModelInfo.keyIdentifier !== modelInfo.keyIdentifier}
        <span class="text-textcolor">{subModelInfo.name} {language.apiKey}</span>
        <TextInput hideText={DBState.db.hideApiKey} marginBottom={false} size={"sm"} bind:value={DBState.db.OaiCompAPIKeys[subModelInfo.keyIdentifier]} placeholder="..."/>
    {/if}

    <div class="py-2 flex flex-col gap-2 mb-4">
        {#if modelInfo.flags.includes(LLMFlags.hasStreaming) || subModelInfo.flags.includes(LLMFlags.hasStreaming)}
            <Check bind:check={DBState.db.useStreaming} name={`Response ${language.streaming}`}/>
            
            {#if DBState.db.useStreaming && (modelInfo.flags.includes(LLMFlags.geminiThinking) || subModelInfo.flags.includes(LLMFlags.geminiThinking))}
                <Check bind:check={DBState.db.streamGeminiThoughts} name={`Stream Gemini Thoughts`}/>
            {/if}
        {/if}

        {#if DBState.db.aiModel === 'reverse_proxy' || DBState.db.subModel === 'reverse_proxy'}
            <Check bind:check={DBState.db.reverseProxyOobaMode} name={`${language.reverseProxyOobaMode}`}/>
        {/if}
        {#if modelInfo.provider === LLMProvider.NovelAI || subModelInfo.provider === LLMProvider.NovelAI}
            <Check bind:check={DBState.db.NAIadventure} name={language.textAdventureNAI}/>

            <Check bind:check={DBState.db.NAIappendName} name={language.appendNameNAI}/>
        {/if}
    </div>

    {#if DBState.db.aiModel === 'custom' || DBState.db.subModel === 'custom'}
        <span class="text-textcolor mt-2">{language.plugin}</span>
        <SelectInput className="mt-2 mb-4" bind:value={DBState.db.currentPluginProvider}>
            <OptionInput value="">None</OptionInput>
            {#each $customProviderStore as plugin}
                <OptionInput value={plugin}>{plugin}</OptionInput>
            {/each}
        </SelectInput>
    {/if}

    {#if DBState.db.aiModel === "kobold" || DBState.db.subModel === "kobold"}
        <span class="text-textcolor">Kobold URL</span>
        <TextInput marginBottom={true} bind:value={DBState.db.koboldURL} />
    {/if}

    {#if DBState.db.aiModel === 'echo_model' || DBState.db.subModel === 'echo_model'}
        <span class="text-textcolor mt-2">Echo Message</span>
        <TextAreaInput margin="bottom" bind:value={DBState.db.echoMessage} placeholder={"The message you want to receive as the bot's response\n(e.g., Lumi tilts her head, her white hair sliding down as her pretty green and aqua eyes sparkle…)"}/>
        <span class="text-textcolor mt-2">Echo Delay (Seconds)</span>
        <NumberInput marginBottom={true} bind:value={DBState.db.echoDelay} min={0}/>
    {/if}

    {#if DBState.db.aiModel.startsWith("horde") || DBState.db.subModel.startsWith("horde") }
        <span class="text-textcolor">Horde {language.apiKey}</span>
        <TextInput hideText={DBState.db.hideApiKey} marginBottom={true} bind:value={DBState.db.hordeConfig.apiKey} />
    {/if}
    {#if DBState.db.aiModel === 'textgen_webui' || DBState.db.subModel === 'textgen_webui'
        || DBState.db.aiModel === 'mancer' || DBState.db.subModel === 'mancer'}
        <span class="text-textcolor mt-2">Blocking {language.providerURL}</span>
        <TextInput marginBottom={true} bind:value={DBState.db.textgenWebUIBlockingURL} placeholder="https://..."/>
        <span class="text-draculared text-xs mb-2">You must use textgen webui with --public-api</span>
        <span class="text-textcolor mt-2">Stream {language.providerURL}</span>
        <TextInput marginBottom={true} bind:value={DBState.db.textgenWebUIStreamURL} placeholder="wss://..."/>
        <span class="text-draculared text-xs mb-2">Warning: For Ooba version over 1.7, use "Ooba" as model, and use url like http://127.0.0.1:5000/v1/chat/completions</span>
    {/if}
    {#if DBState.db.aiModel === 'ooba' || DBState.db.subModel === 'ooba'}
        <span class="text-textcolor mt-2">Ooba {language.providerURL}</span>
        <TextInput marginBottom={true} bind:value={DBState.db.textgenWebUIBlockingURL} placeholder="https://..."/>
    {/if}
    {#if DBState.db.aiModel.startsWith("horde") || DBState.db.aiModel === 'kobold' }
        <ChatFormatSettings />
    {/if}

    {#if DBState.db.auxModelUnderModelSettings}
        <AuxModelSelectors />
    {/if}
{/if}

{#if submenu === 1 || submenu === -1}
    <!-- Data-driven basic parameters -->
    <SettingRenderer items={allBasicParameterItems} {modelInfo} {subModelInfo} />
    {#if DBState.db.aiModel === 'textgen_webui' || DBState.db.aiModel === 'mancer' || DBState.db.aiModel.startsWith('local_') || DBState.db.aiModel.startsWith('hf:::')}
        <span class="text-textcolor">Repetition Penalty</span>
        <SliderInput min={1} max={1.5} step={0.01} fixed={2} marginBottom bind:value={DBState.db.ooba.repetition_penalty}/>
        <span class="text-textcolor">Length Penalty</span>
        <SliderInput min={-5} max={5} step={0.05} marginBottom fixed={2} bind:value={DBState.db.ooba.length_penalty}/>
        <span class="text-textcolor">Top K</span>
        <SliderInput min={0} max={100} step={1} marginBottom bind:value={DBState.db.ooba.top_k} />
        <span class="text-textcolor">Top P</span>
        <SliderInput min={0} max={1} step={0.01} marginBottom fixed={2} bind:value={DBState.db.ooba.top_p}/>
        <span class="text-textcolor">Typical P</span>
        <SliderInput min={0} max={1} step={0.01} marginBottom fixed={2} bind:value={DBState.db.ooba.typical_p}/>
        <span class="text-textcolor">Top A</span>
        <SliderInput min={0} max={1} step={0.01} marginBottom fixed={2} bind:value={DBState.db.ooba.top_a}/>
        <span class="text-textcolor">No Repeat n-gram Size</span>
        <SliderInput min={0} max={20} step={1} marginBottom bind:value={DBState.db.ooba.no_repeat_ngram_size}/>
        <div class="flex items-center mt-4">
            <Check bind:check={DBState.db.ooba.do_sample} name={'Do Sample'}/>
        </div>
        <div class="flex items-center mt-4">
            <Check bind:check={DBState.db.ooba.add_bos_token} name={'Add BOS Token'}/>
        </div>
        <div class="flex items-center mt-4">
            <Check bind:check={DBState.db.ooba.ban_eos_token} name={'Ban EOS Token'}/>
        </div>
        <div class="flex items-center mt-4">
            <Check bind:check={DBState.db.ooba.skip_special_tokens} name={'Skip Special Tokens'}/>
        </div>
        <div class="flex items-center mt-4">
            <Check check={!!DBState.db.localStopStrings} name={language.customStopWords} onChange={() => {
                if(!DBState.db.localStopStrings){
                    DBState.db.localStopStrings = []
                }
                else{
                    DBState.db.localStopStrings = null
                }
            }} />
        </div>
        {#if DBState.db.localStopStrings}
            <div class="flex flex-col p-2 rounded-sm border border-selected mt-2 gap-1">
                <div class="p-2">
                    <button class="font-medium flex justify-center items-center h-full cursor-pointer hover:text-green-500 w-full" onclick={() => {
                        let localStopStrings = DBState.db.localStopStrings
                        localStopStrings.push('')
                        DBState.db.localStopStrings = localStopStrings
                    }}><PlusIcon /></button>
                </div>
                {#each DBState.db.localStopStrings as stopString, i}
                    <div class="flex w-full">
                        <div class="grow">
                            <TextInput marginBottom bind:value={DBState.db.localStopStrings[i]} fullwidth fullh/>
                        </div>
                        <div>
                            <button class="font-medium flex justify-center items-center h-full cursor-pointer hover:text-green-500 w-full" onclick={() => {
                                let localStopStrings = DBState.db.localStopStrings
                                localStopStrings.splice(i, 1)
                                DBState.db.localStopStrings = localStopStrings
                            }}><TrashIcon /></button>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
        <div class="flex flex-col p-3 rounded-md border-selected border mt-4">
            <ChatFormatSettings />
        </div>
        <Check bind:check={DBState.db.ooba.formating.useName} name={language.useNamePrefix}/>
    
    {:else if modelInfo.format === LLMFormat.NovelAI}
        <div class="flex flex-col p-3 bg-darkbg mt-4">
            <span class="text-textcolor">Starter</span>
            <TextInput bind:value={DBState.db.NAIsettings.starter} placeholder={'⁂'} />
            <span class="text-textcolor">Seperator</span>
            <TextInput bind:value={DBState.db.NAIsettings.seperator} placeholder={"\\n"}/>
        </div>
        <span class="text-textcolor">Top P</span>
        <SliderInput min={0} max={1} step={0.01} marginBottom fixed={2} bind:value={DBState.db.NAIsettings.topP}/>
        <span class="text-textcolor">Top K</span>
        <SliderInput min={0} max={100} step={1} marginBottom bind:value={DBState.db.NAIsettings.topK}/>
        <span class="text-textcolor">Top A</span>
        <SliderInput min={0} max={1} step={0.01} marginBottom fixed={2} bind:value={DBState.db.NAIsettings.topA}/>
        <span class="text-textcolor">Tailfree Sampling</span>
        <SliderInput min={0} max={1} step={0.001} marginBottom fixed={3} bind:value={DBState.db.NAIsettings.tailFreeSampling}/>
        <span class="text-textcolor">Typical P</span>
        <SliderInput min={0} max={1} step={0.01} marginBottom fixed={2} bind:value={DBState.db.NAIsettings.typicalp}/>
        <span class="text-textcolor">Repetition Penalty</span>
        <SliderInput min={0} max={3} step={0.01} marginBottom fixed={2} bind:value={DBState.db.NAIsettings.repetitionPenalty}/>
        <span class="text-textcolor">Repetition Penalty Range</span>
        <SliderInput min={0} max={8192} step={1} marginBottom fixed={0} bind:value={DBState.db.NAIsettings.repetitionPenaltyRange}/>
        <span class="text-textcolor">Repetition Penalty Slope</span>
        <SliderInput min={0} max={10} step={0.01} marginBottom fixed={2} bind:value={DBState.db.NAIsettings.repetitionPenaltySlope}/>
        <span class="text-textcolor">Frequency Penalty</span>
        <SliderInput min={-2} max={2} step={0.01} marginBottom fixed={2} bind:value={DBState.db.NAIsettings.frequencyPenalty}/>
        <span class="text-textcolor">Presence Penalty</span>
        <SliderInput min={-2} max={2} step={0.01} marginBottom fixed={2} bind:value={DBState.db.NAIsettings.presencePenalty}/>
        <span class="text-textcolor">Mirostat LR</span>
        <SliderInput min={0} max={1} step={0.01} marginBottom fixed={2} bind:value={DBState.db.NAIsettings.mirostat_lr}/>
        <span class="text-textcolor">Mirostat Tau</span>
        <SliderInput min={0} max={6} step={0.01} marginBottom fixed={2} bind:value={DBState.db.NAIsettings.mirostat_tau}/>
        <span class="text-textcolor">Cfg Scale</span>
        <SliderInput min={1} max={3} step={0.01} marginBottom fixed={2} bind:value={DBState.db.NAIsettings.cfg_scale}/>

    {:else if modelInfo.format === LLMFormat.NovelList}
        <span class="text-textcolor">Top P</span>
        <SliderInput min={0} max={2} step={0.01} marginBottom fixed={2} bind:value={DBState.db.ainconfig.top_p}/>
        <span class="text-textcolor">Reputation Penalty</span>
        <SliderInput min={0} max={2} step={0.01} marginBottom fixed={2} bind:value={DBState.db.ainconfig.rep_pen}/>
        <span class="text-textcolor">Reputation Penalty Range</span>
        <SliderInput min={0} max={2048} step={1} marginBottom fixed={2} bind:value={DBState.db.ainconfig.rep_pen_range}/>
        <span class="text-textcolor">Reputation Penalty Slope</span>
        <SliderInput min={0} max={10} step={0.1} marginBottom fixed={2} bind:value={DBState.db.ainconfig.rep_pen_slope}/>
        <span class="text-textcolor">Top K</span>
        <SliderInput min={1} max={500} step={1} marginBottom fixed={2} bind:value={DBState.db.ainconfig.top_k}/>
        <span class="text-textcolor">Top A</span>
        <SliderInput min={0} max={1} step={0.01} marginBottom fixed={2} bind:value={DBState.db.ainconfig.top_a}/>
        <span class="text-textcolor">Typical P</span>
        <SliderInput min={0} max={1} step={0.01} marginBottom fixed={2} bind:value={DBState.db.ainconfig.typical_p}/>
    {:else}
        <!-- Standard parameters now handled by SettingRenderer above -->
    {/if}

    {#if (DBState.db.reverseProxyOobaMode && DBState.db.aiModel === 'reverse_proxy') || (DBState.db.aiModel === 'ooba')}
        <OobaSettings instructionMode={DBState.db.aiModel === 'ooba'} />
    {/if}

    {#if DBState.db.aiModel.startsWith('openrouter')}
        <OpenrouterSettings />
    {/if}

    <!-- Separate Parameters - handled by custom component -->
    <SeparateParametersSection />
{/if}

{#if submenu === 3 || submenu === -1}
    <Accordion styled name="Bias " help="bias">
        <table class="contain w-full max-w-full tabler">
            <tbody>
            <tr>
                <th class="font-medium">Bias</th>
                <th class="font-medium">{language.value}</th>
                <th>
                    <button class="font-medium cursor-pointer hover:text-green-500 w-full flex justify-center items-center" onclick={() => {
                        let bia = DBState.db.bias
                        bia.push(['', 0])
                        DBState.db.bias = bia
                    }}><PlusIcon /></button>
                </th>
            </tr>
            {#if DBState.db.bias.length === 0}
                <tr>
                    <td colspan="3" class="text-textcolor2">{language.noBias}</td>
                </tr>
            {/if}
            {#each DBState.db.bias as bias, i}
                <tr>
                    <td class="font-medium truncate">
                        <TextInput bind:value={DBState.db.bias[i][0]} size="lg" fullwidth/>
                    </td>
                    <td class="font-medium truncate">
                        <NumberInput bind:value={DBState.db.bias[i][1]} max={100} min={-101} size="lg" fullwidth/>
                    </td>
                    <td>
                        <button class="font-medium flex justify-center items-center h-full cursor-pointer hover:text-green-500 w-full" onclick={() => {
                            let bia = DBState.db.bias
                            bia.splice(i, 1)
                            DBState.db.bias = bia
                        }}><TrashIcon /></button>
                    </td>
                </tr>
            {/each}
            </tbody>
        </table>
        <div class="text-textcolor2 mt-2 flex items-center gap-2">
            <button class="font-medium cursor-pointer hover:text-textcolor gap-2" onclick={() => {
                const data = JSON.stringify(DBState.db.bias, null, 2)
                downloadFile('bias.json', data)
            }}><DownloadIcon /></button>
            <button class="font-medium cursor-pointer hover:text-textcolor" onclick={async () => {
                const sel = await selectSingleFile(['json'])
                const utf8 = new TextDecoder().decode(sel.data)
                if(Array.isArray(JSON.parse(utf8))){
                    DBState.db.bias = JSON.parse(utf8)
                }
            }}><HardDriveUploadIcon /></button>
        </div>
    </Accordion>

    {#if DBState.db.aiModel === 'reverse_proxy'}
    <Accordion styled name="{language.additionalParams} " help="additionalParams">
        <table class="contain w-full max-w-full tabler">
            <tbody>
            <tr>
                <th class="font-medium">{language.key}</th>
                <th class="font-medium">{language.value}</th>
                <th>
                    <button class="font-medium cursor-pointer hover:text-green-500 w-full flex justify-center items-center" onclick={() => {
                        let additionalParams = DBState.db.additionalParams
                        additionalParams.push(['', ''])
                        DBState.db.additionalParams = additionalParams
                    }}><PlusIcon /></button>
                </th>
            </tr>
            {#if DBState.db.bias.length === 0}
                <tr class="text-textcolor2">
                    <td colspan="3">{language.noData}</td>
                </tr>
            {/if}
            {#each DBState.db.additionalParams as additionalParams, i}
                <tr>
                    <td class="font-medium truncate">
                        <TextInput bind:value={DBState.db.additionalParams[i][0]} size="lg" fullwidth/>
                    </td>
                    <td class="font-medium truncate">
                        <TextInput bind:value={DBState.db.additionalParams[i][1]} size="lg" fullwidth/>
                    </td>
                    <td>
                        <button class="font-medium flex justify-center items-center h-full cursor-pointer hover:text-green-500 w-full" onclick={() => {
                            let additionalParams = DBState.db.additionalParams
                            additionalParams.splice(i, 1)
                            DBState.db.additionalParams = additionalParams
                        }}><TrashIcon /></button>
                    </td>
                </tr>
            {/each}
            </tbody>
        </table>
    </Accordion>
    {/if}


    <Accordion styled name={language.promptTemplate}>
        {#if DBState.db.promptTemplate}
            {#if submenu !== -1}
                <PromptSettings mode='inline' subMenu={1} />
            {/if}
        {:else}
            <Check check={false} name={language.usePromptTemplate} onChange={() => {
                DBState.db.promptTemplate = []
            }}/>
        {/if}
    </Accordion>

    {#snippet CustomFlagButton(name:string,flag:LLMFlags)}
        <Button className="mt-2" onclick={(e) => {
            if(DBState.db.customFlags.includes(flag)){
                DBState.db.customFlags = DBState.db.customFlags.filter((f) => f !== flag)
            }
            else{
                DBState.db.customFlags.push(flag)
            }
        }} styled={DBState.db.customFlags.includes(flag) ? 'primary' : 'outlined'}>
            {name}
        </Button>
    {/snippet}

    <Accordion styled name={language.customFlags}>
        <Check bind:check={DBState.db.enableCustomFlags} name={language.enableCustomFlags}/>


        {#if DBState.db.enableCustomFlags}
            {@render CustomFlagButton('hasImageInput', 0)}
            {@render CustomFlagButton('hasImageOutput', 1)}
            {@render CustomFlagButton('hasAudioInput', 2)}
            {@render CustomFlagButton('hasAudioOutput', 3)}
            {@render CustomFlagButton('hasPrefill', 4)}
            {@render CustomFlagButton('hasCache', 5)}
            {@render CustomFlagButton('hasFullSystemPrompt', 6)}
            {@render CustomFlagButton('hasFirstSystemPrompt', 7)}
            {@render CustomFlagButton('hasStreaming', 8)}
            {@render CustomFlagButton('requiresAlternateRole', 9)}
            {@render CustomFlagButton('mustStartWithUserInput', 10)}
            {@render CustomFlagButton('hasVideoInput', 12)}
            {@render CustomFlagButton('OAICompletionTokens', 13)}
            {@render CustomFlagButton('DeveloperRole', 14)}
            {@render CustomFlagButton('geminiThinking', 15)}
            {@render CustomFlagButton('geminiBlockOff', 16)}
            {@render CustomFlagButton('deepSeekPrefix', 17)}
            {@render CustomFlagButton('deepSeekThinkingInput', 18)}
            {@render CustomFlagButton('deepSeekThinkingOutput', 19)}

        {/if}
    </Accordion>

    <Accordion styled name={language.moduleIntergration} help="moduleIntergration">
        <TextAreaInput bind:value={DBState.db.moduleIntergration} fullwidth height={"32"} autocomplete="off"/>
    </Accordion>

    <Accordion styled name={language.tools}>
        <Check name={language.search} check={DBState.db.modelTools.includes('search')} onChange={() => {
            if(DBState.db.modelTools.includes('search')){
                DBState.db.modelTools = DBState.db.modelTools.filter((tool) => tool !== 'search')
            }
            else{
                DBState.db.modelTools.push('search')
            }
        }} />
    </Accordion>
    
    <Accordion styled name={language.regexScript}>
        <RegexList bind:value={DBState.db.presetRegex} buttons />
    </Accordion>

    <Accordion styled name={language.icon}>
        <div class="p-2 rounded-md border border-darkborderc flex flex-col items-center gap-2">
            <span>
                {language.preview}
            </span>
            <div class="flex items-center justify-center gap-2">
                {#if DBState.db.botPresets[DBState.db.botPresetsId]?.image}
                    <img src={DBState.db.botPresets[DBState.db.botPresetsId]?.image} alt="icon" class="w-6 h-6 rounded-md" decoding="async"/>
                    <span class="text-textcolor2">{DBState.db.botPresets[DBState.db.botPresetsId]?.name}</span>
                {:else}
                    <span class="text-textcolor2">{language.noImages}</span>
                {/if}
            </div>
        </div>
        <button class="mt-2 text-textcolor2 hover:text-textcolor focus-within:text-textcolor" onclick={async () => {
            const sel = await selectSingleFile(['png', 'jpg', 'jpeg', 'webp'])
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            const img = new Image()
            //@ts-expect-error Uint8Array buffer type (ArrayBufferLike) is incompatible with BlobPart's ArrayBuffer
            const blob = new Blob([sel.data], {type: "image/png"})
            img.src = URL.createObjectURL(blob)
            await img.decode()
            canvas.width = 48
            canvas.height = 48
            ctx.drawImage(img, 0, 0, 48, 48)
            const data = canvas.toDataURL('image/jpeg', 0.7)
            DBState.db.botPresets[DBState.db.botPresetsId].image = data //Since its small (max 2304 pixels), its okay to store it directly
        }}>
            <UploadIcon />
        </button>
    </Accordion>
    {#if submenu !== -1}
        <Button onclick={() => {$openPresetList = true}} className="mt-4">{language.presets}</Button>
    {/if}
{/if}

{#if submenu === 2 || submenu === -1}
    {#if !DBState.db.promptTemplate}
        <span class="text-textcolor">{language.mainPrompt} <Help key="mainprompt"/></span>
        <TextAreaInput fullwidth autocomplete="off" height={"32"} bind:value={DBState.db.mainPrompt}></TextAreaInput>
        <span class="text-textcolor2 mb-6 text-sm mt-2">{tokens.mainPrompt} {language.tokens}</span>
        <span class="text-textcolor">{language.jailbreakPrompt} <Help key="jailbreak"/></span>
        <TextAreaInput fullwidth autocomplete="off" height={"32"} bind:value={DBState.db.jailbreak}></TextAreaInput>
        <span class="text-textcolor2 mb-6 text-sm mt-2">{tokens.jailbreak} {language.tokens}</span>
        <span class="text-textcolor">{language.globalNote} <Help key="globalNote"/></span>
        <TextAreaInput fullwidth autocomplete="off" height={"32"} bind:value={DBState.db.globalNote}></TextAreaInput>
        <span class="text-textcolor2 mb-6 text-sm mt-2">{tokens.globalNote} {language.tokens}</span>  
        <span class="text-textcolor mb-2 mt-4">{language.formatingOrder} <Help key="formatOrder"/></span>
        <DropList bind:list={DBState.db.formatingOrder} />
        <div class="flex items-center mt-4">
            <Check bind:check={DBState.db.promptPreprocess} name={language.promptPreprocess}/>
        </div>
    {:else if submenu === 2}
        <PromptSettings mode='inline' />
    {/if}
{/if}


{#if DBState.db.promptTemplate && submenu === -1}
    <div class="mt-2">
        <Button onclick={goPromptTemplate} size="sm">{language.promptTemplate}</Button>
    </div>
{/if}
{#if submenu === -1}
    <Button onclick={() => {$openPresetList = true}} className="mt-4">{language.presets}</Button>
{/if}
