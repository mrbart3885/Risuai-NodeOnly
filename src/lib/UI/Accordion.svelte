<script lang="ts">
    import type { language } from "src/lang";
    import Help from "../Others/Help.svelte";
    import ShAccordion from "./GUI/ShAccordion.svelte";

    interface Props {
        name?: string;
        styled?: boolean;
        help?: (keyof (typeof language.help))|'';
        disabled?: boolean;
        children?: import('svelte').Snippet;
        className?: string;
    }

    let {
        name = "",
        styled = false,
        help = '',
        disabled = false,
        children,
        className = ""
    }: Props = $props();

    // Legacy wrapper renders every call site as the card variant — this is
    // the chosen default for the codebase's bordered "Settings section" feel.
    // Direct ShAccordion callers (e.g. Toggles.svelte) pick their own variant
    // when card is too heavy for narrow contexts.
    const variant = 'card';
</script>

{#snippet helpExtras()}
    <Help key={help as keyof (typeof language.help)} />
{/snippet}

{#if disabled}
    {@render children?.()}
{:else}
    <!-- mt-2 is a legacy quirk of the original <Accordion styled> wrapper: -->
    <!-- it baked the inter-section gap into the component itself. Kept here -->
    <!-- so call sites stay untouched. Drop when call sites migrate to -->
    <!-- ShAccordion direct + parent-controlled gap. -->
    <div class="mt-2">
        <ShAccordion
            {name}
            {variant}
            bodyClass={className}
            extras={help ? helpExtras : undefined}
        >
            {@render children?.()}
        </ShAccordion>
    </div>
{/if}
