<script lang="ts">
    import { language } from 'src/lang';
    import { DBState } from 'src/ts/stores.svelte';
    import { changeColorScheme, colorSchemeList } from 'src/ts/gui/colorscheme';
    import SelectInput from 'src/lib/UI/GUI/SelectInput.svelte';
    import OptionInput from 'src/lib/UI/GUI/OptionInput.svelte';
    import Help from 'src/lib/Others/Help.svelte';

    const onSchemeInputChange = (e: Event) => {
        changeColorScheme((e.target as HTMLInputElement).value);
    };
</script>

<span class="text-textcolor mt-4">{language.colorScheme} <Help key="colorScheme" /></span>
<SelectInput className="mt-2 mb-4" value={DBState.db.colorSchemeName} onchange={onSchemeInputChange}>
    {#each colorSchemeList as scheme}
        <OptionInput value={scheme}>{scheme}</OptionInput>
    {/each}
    <OptionInput value="custom">Custom</OptionInput>
</SelectInput>
