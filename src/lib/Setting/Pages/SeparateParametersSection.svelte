<script lang="ts">
    import { language } from 'src/lang';
    import { DBState } from 'src/ts/stores.svelte';
    import Accordion from 'src/lib/UI/Accordion.svelte';
    import CheckInput from 'src/lib/UI/GUI/CheckInput.svelte';
    import AllSeperateParameters from 'src/lib/Others/AllSeperateParameters.svelte';
    import {
        AUX_PARAMETER_HINT,
        getSeparateParameterSectionTitle,
    } from 'src/ts/setting/auxModelCopy';
</script>

<Accordion name={language.seperateParameters} styled>
    <CheckInput bind:check={DBState.db.seperateParametersEnabled} name={language.seperateParametersEnabled} />
    {#if DBState.db.seperateParametersEnabled}
        {#each Object.keys(DBState.db.seperateParameters) as param}
            <Accordion name={getSeparateParameterSectionTitle(param, language)} styled>
                {#if param === 'otherAx'}
                    <p class="text-xs text-textcolor2 mb-3">{AUX_PARAMETER_HINT}</p>
                {/if}
                <AllSeperateParameters bind:value={DBState.db.seperateParameters[param]} />
            </Accordion>
        {/each}
    {/if}
</Accordion>
