<script lang="ts">
    import { getModuleToggles } from "src/ts/process/modules";
    import { DBState, MobileGUI, selectedCharID } from "src/ts/stores.svelte";
    import { parseToggleSyntax, type sidebarToggle, type sidebarToggleGroup } from "src/ts/util";
    import { language } from "src/lang";
    import type { PromptItem } from "src/ts/process/prompt";
    import type { character, groupChat } from "src/ts/storage/database.svelte";
    import { getCurrentChat, snapshotToggleValues, applyToggleValues, saveTogglesToChat, type TogglePreset } from "src/ts/storage/database.svelte";
    import { alertInput, alertConfirm, alertNormal, alertTogglePresets } from "src/ts/alert";
    import { tooltip } from "src/ts/gui/tooltip";
    import { PinIcon, SaveIcon, BookmarkIcon, FolderOpenIcon } from "@lucide/svelte";
    import Accordion from '../UI/Accordion.svelte'
    import CheckInput from "../UI/GUI/CheckInput.svelte";
    import SelectInput from "../UI/GUI/SelectInput.svelte";
    import OptionInput from "../UI/GUI/OptionInput.svelte";
    import TextAreaInput from '../UI/GUI/TextAreaInput.svelte'
    import TextInput from "../UI/GUI/TextInput.svelte";

    interface Props {
        chara?: character|groupChat
        noContainer?: boolean
    }

    let { chara = $bindable(), noContainer }: Props = $props();

    let currentChat = $derived(DBState.db.characters[$selectedCharID]?.chats?.[DBState.db.characters[$selectedCharID]?.chatPage])
    let isPinned = $derived(!!currentChat?.savedToggleValues)
    let isDirty = $derived.by(() => {
        const saved = currentChat?.savedToggleValues
        if (!saved) return false
        const current = snapshotToggleValues()
        return JSON.stringify(saved) !== JSON.stringify(current)
    })

    async function pinToChat() {
        const chat = getCurrentChat()
        if (!chat) return
        if (chat.savedToggleValues) {
            const confirmed = await alertConfirm(language.togglePinRemove)
            if (confirmed) {
                chat.savedToggleValues = undefined
            }
        } else {
            saveTogglesToChat()
            alertNormal(language.togglePinSaved)
        }
    }

    function updatePin() {
        saveTogglesToChat()
        alertNormal(language.togglePinSaved)
    }

    async function saveAsPreset() {
        const name = await alertInput(language.togglePresetNamePrompt)
        if (!name) return
        DBState.db.togglePresets ??= []
        DBState.db.togglePresets.push({
            name,
            values: snapshotToggleValues()
        })
    }

    async function loadPreset() {
        await alertTogglePresets()
    }

    const jailbreakToggleToken = '{{jbtoggled}}'
    const usesJailbreakToggle = (value?: string) =>
        typeof value === 'string' && value.includes(jailbreakToggleToken)
    const templateUsesJailbreakToggle = (template: PromptItem[]) =>
        template.some(item => {
            if (item.type === 'jailbreak') {
                return true
            }
            if ('text' in item && usesJailbreakToggle(item.text)) {
                // plain, jailbreak, cot
                return true
            }
            if ('innerFormat' in item && usesJailbreakToggle(item.innerFormat)) {
                // persona, description, lorebook, postEverything, memory
                return true
            }
            if ('defaultText' in item && usesJailbreakToggle(item.defaultText)) {
                // author note
                return true
            }
            return false
        })

    let hasJailbreakPrompt = $derived.by(() => {
        const template = DBState.db.promptTemplate
        if (!template) {
            return (DBState.db.jailbreak ?? '').trim().length > 0
        }
        return templateUsesJailbreakToggle(template)
    })

    let groupedToggles = $derived.by(() => {
        const ungrouped = parseToggleSyntax(DBState.db.customPromptTemplateToggle + getModuleToggles())

        let groupOpen = false
        // group toggles together between group ... groupEnd
        return ungrouped.reduce<sidebarToggle[]>((acc, toggle) => {
            if (toggle.type === 'group') {
                groupOpen = true
                acc.push(toggle)
            } else if (toggle.type === 'groupEnd') {
                groupOpen = false
            } else if (groupOpen) {
                (acc.at(-1) as sidebarToggleGroup).children.push(toggle)
            } else {
                acc.push(toggle)
            }
            return acc
        }, [])
    })

</script>

{#snippet toggles(items: sidebarToggle[], reverse: boolean = false)}
    {#each items as toggle, index}
        {#if toggle.type === 'group' && toggle.children.length > 0}
            <div class="w-full">
                <Accordion styled name={toggle.value}>
                    {@render toggles((toggle as sidebarToggleGroup).children, reverse)}
                </Accordion>
            </div>
        {:else if toggle.type === 'select'}
            <div class="w-full flex gap-2 mt-2 items-center" class:justify-end={$MobileGUI} >
                <span>{toggle.value}</span>
                <SelectInput className="w-32" bind:value={DBState.db.globalChatVariables[`toggle_${toggle.key}`]}>
                    {#each toggle.options as option, i}
                        <OptionInput value={i.toString()}>{option}</OptionInput>
                    {/each}
                </SelectInput>
            </div>
        {:else if toggle.type === 'text'}
            <div class="w-full flex gap-2 mt-2 items-center" class:justify-end={$MobileGUI}>
                <span>{toggle.value}</span>
                <TextInput className="w-32" bind:value={DBState.db.globalChatVariables[`toggle_${toggle.key}`]} />
            </div>
        {:else if toggle.type === 'textarea'}
            <div class="w-full flex gap-2 mt-2 items-start" class:justify-end={$MobileGUI}>
                <span class="mt-1.5">{toggle.value}</span>
                <TextAreaInput className="w-32" height='20' bind:value={DBState.db.globalChatVariables[`toggle_${toggle.key}`]} />
            </div>
        {:else if toggle.type === 'caption'}
            <div class="w-full mt-1 text-xs text-textcolor2">
                {toggle.value}
            </div>
        {:else if toggle.type === 'divider'}
            <!-- Prevent multiple dividers appearing in a row -->
            {#if index === 0 || items[index - 1]?.type !== 'divider' || items[index - 1]?.value !== toggle.value}
                <div class="w-full min-h-5 flex gap-2 mt-2 items-center" class:justify-end={!reverse}>
                    {#if toggle.value}
                        <span class="shrink-0">{toggle.value}</span>
                    {/if}
                    <hr class="border-t border-darkborderc m-0 grow" />
                </div>
            {/if}
        {:else}
            <div class="w-full flex mt-2 items-center" class:justify-end={$MobileGUI}>
                <CheckInput check={DBState.db.globalChatVariables[`toggle_${toggle.key}`] === '1'} reverse={reverse} name={toggle.value} onChange={() => {
                    DBState.db.globalChatVariables[`toggle_${toggle.key}`] = DBState.db.globalChatVariables[`toggle_${toggle.key}`] === '1' ? '0' : '1'
                }} />
            </div>
        {/if}
    {/each}
{/snippet}

<div class="flex gap-1 mt-3 items-stretch">
    {#if isPinned}
        <button class="flex items-center justify-center px-3 rounded-md border border-green-600 bg-green-700 text-white hover:bg-green-600 cursor-pointer transition-colors shadow-xs"
            use:tooltip={language.togglePinRemove}
            onclick={pinToChat}>
            <PinIcon size={16} />
        </button>
        <button class="flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2 px-4 rounded-md border text-md transition-colors shadow-xs"
            class:bg-green-700={isDirty}
            class:border-green-600={isDirty}
            class:text-white={isDirty}
            class:hover:bg-green-600={isDirty}
            class:cursor-pointer={isDirty}
            class:bg-darkbutton={!isDirty}
            class:border-darkborderc={!isDirty}
            class:text-textcolor2={!isDirty}
            class:opacity-50={!isDirty}
            class:cursor-default={!isDirty}
            use:tooltip={language.togglePinUpdate}
            onclick={isDirty ? updatePin : undefined}>
            <SaveIcon size={16} class="shrink-0" />
            <span class="truncate">{language.togglePinUpdateLabel}</span>
        </button>
    {:else}
        <button class="flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2 px-4 rounded-md border border-darkborderc bg-darkbutton hover:bg-selected text-textcolor2 text-md cursor-pointer transition-colors shadow-xs"
            use:tooltip={language.togglePinToChat}
            onclick={pinToChat}>
            <PinIcon size={16} class="shrink-0" />
            <span class="truncate">{language.togglePinLabel}</span>
        </button>
    {/if}
    <button class="flex items-center justify-center px-3 rounded-md border border-darkborderc bg-darkbutton hover:bg-selected text-textcolor2 cursor-pointer transition-colors shadow-xs"
        use:tooltip={language.toggleSaveAsPreset}
        onclick={saveAsPreset}>
        <BookmarkIcon size={16} />
    </button>
    <button class="flex items-center justify-center px-3 rounded-md border border-darkborderc bg-darkbutton hover:bg-selected text-textcolor2 cursor-pointer transition-colors shadow-xs"
        use:tooltip={language.toggleLoadPreset}
        onclick={loadPreset}>
        <FolderOpenIcon size={16} />
    </button>
</div>

{#if !noContainer && groupedToggles.length > 4}
    <div class="h-48 border-darkborderc p-2 border rounded-sm flex flex-col items-start mt-2 overflow-y-auto">
        {#if hasJailbreakPrompt}
            <div class="flex mt-2 items-center w-full" class:justify-end={$MobileGUI}>
                <CheckInput bind:check={DBState.db.jailbreakToggle} name={language.jailbreakToggle} reverse />
            </div>
        {/if}
        {@render toggles(groupedToggles, true)}
        {#if DBState.db.supaModelType !== 'none' || DBState.db.hanuraiEnable || DBState.db.hypaV3}
            <div class="flex mt-2 items-center w-full" class:justify-end={$MobileGUI}>
                <CheckInput
                    check={DBState.db.characters[$selectedCharID]?.chats?.[DBState.db.characters[$selectedCharID]?.chatPage]?.supaMemory ?? chara.supaMemory ?? false}
                    onChange={() => {
                        const char = DBState.db.characters[$selectedCharID]
                        const chat = char?.chats?.[char.chatPage]
                        if (!chat) return
                        chat.supaMemory = !(chat.supaMemory ?? char.supaMemory ?? false)
                    }}
                    reverse name={DBState.db.hypaV3 ? language.ToggleHypaMemory : DBState.db.hanuraiEnable ? language.hanuraiMemory : DBState.db.hypaMemory ? language.ToggleHypaMemory : language.ToggleSuperMemory}/>
            </div>
        {/if}
    </div>
{:else}
    {#if hasJailbreakPrompt}
        <div class="flex mt-2 items-center">
            <CheckInput bind:check={DBState.db.jailbreakToggle} name={language.jailbreakToggle}/>
        </div>
    {/if}
    {@render toggles(groupedToggles)}
    {#if DBState.db.supaModelType !== 'none' || DBState.db.hanuraiEnable || DBState.db.hypaV3}
        <div class="flex mt-2 items-center">
            <CheckInput
                check={DBState.db.characters[$selectedCharID]?.chats?.[DBState.db.characters[$selectedCharID]?.chatPage]?.supaMemory ?? chara.supaMemory ?? false}
                onChange={() => {
                    const char = DBState.db.characters[$selectedCharID]
                    const chat = char?.chats?.[char.chatPage]
                    if (!chat) return
                    chat.supaMemory = !(chat.supaMemory ?? char.supaMemory ?? false)
                }}
                name={DBState.db.hypaV3 ? language.ToggleHypaMemory : DBState.db.hanuraiEnable ? language.hanuraiMemory : DBState.db.hypaMemory ? language.ToggleHypaMemory : language.ToggleSuperMemory}/>
        </div>
    {/if}
{/if}
