<script lang="ts">
    import { DBState, selectedCharID } from "src/ts/stores.svelte";
    import { language } from "src/lang";
    import { getCurrentChat } from "src/ts/storage/database.svelte";
    import { alertSelect, notifySuccess } from "src/ts/alert";
    import { PinIcon, PinOffIcon } from "@lucide/svelte";
    import { openPersonaList, personaSelectCallback } from "src/ts/stores.svelte";
    import { v4 } from "uuid";

    let currentChat = $derived(DBState.db.characters[$selectedCharID]?.chats?.[DBState.db.characters[$selectedCharID]?.chatPage])

    let boundPersona = $derived.by(() => {
        const id = currentChat?.bindedPersona
        if (!id) return null
        return DBState.db.personas.find(p => p.id === id) ?? null
    })
    let displayPersona = $derived(boundPersona ?? DBState.db.personas[DBState.db.selectedPersona])
    let isPersonaBound = $derived(!!boundPersona)

    function bindPersona(personaIndex: number) {
        const chat = getCurrentChat()
        if (!chat) return
        const persona = DBState.db.personas[personaIndex]
        if (!persona.id) persona.id = v4()
        chat.bindedPersona = persona.id
        notifySuccess(language.personaBindedSuccess)
    }

    function unbindPersona() {
        const chat = getCurrentChat()
        if (!chat) return
        chat.bindedPersona = ''
        notifySuccess(language.personaUnbindedSuccess)
    }

    async function handlePersonaBindClick() {
        if (isPersonaBound) {
            const sel = parseInt(await alertSelect([
                language.personaBindChange,
                language.personaBindUnbind,
                language.cancel
            ]))
            if (sel === 0) {
                personaSelectCallback.set(bindPersona)
                openPersonaList.set(true)
            } else if (sel === 1) {
                unbindPersona()
            }
        } else {
            const sel = parseInt(await alertSelect([
                language.personaBindCurrent,
                language.personaSelectOther,
                language.cancel
            ]))
            if (sel === 0) {
                bindPersona(DBState.db.selectedPersona)
            } else if (sel === 1) {
                personaSelectCallback.set(bindPersona)
                openPersonaList.set(true)
            }
        }
    }
</script>

<div class="text-[11px] text-textcolor2 mt-4 px-1">{language.personaBindingLabel}</div>
<div class="flex gap-1 mt-1 items-stretch">
    <button class="flex-1 min-w-0 flex items-center gap-1.5 py-2 px-4 rounded-md border bg-darkbutton hover:bg-selected text-md cursor-pointer transition-colors shadow-xs"
        class:border-darkborderc={!isPersonaBound}
        class:text-textcolor2={!isPersonaBound}
        class:opacity-50={!isPersonaBound}
        class:hover:opacity-100={!isPersonaBound}
        class:border-selected={isPersonaBound}
        class:text-textcolor={isPersonaBound}
        onclick={handlePersonaBindClick}>
        {#if isPersonaBound}
            <PinIcon size={16} class="shrink-0" />
        {:else}
            <PinOffIcon size={16} class="shrink-0" />
        {/if}
        <span class="truncate">{displayPersona?.name ?? 'User'}</span>
        {#if displayPersona?.note}
            <span class="truncate text-xs opacity-60">({displayPersona.note})</span>
        {/if}
    </button>
</div>
