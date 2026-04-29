/**
 * Risuai NodeOnly — English help texts (`language.help`).
 *
 * Extracted from `src/lang/en.ts` for maintainability. See
 * `.agent/notes/help-audit/` (workspace) for the audit, structure rationale,
 * and the `scripts/check-help-keys.mjs` validator.
 *
 * Convention: keep this object as the canonical source of help-text keys.
 * Other locales (e.g. `help.ko.ts`) override entries by key; the merge happens
 * via `lodash/merge` in `src/lang/index.ts`.
 */

export const helpEn = {
        model: "Model option is a main model used in chat.",
        submodel: "Auxiliary Model is a model that used in analyzing emotion images and auto suggestions and etc. gpt3.5 is recommended.",
        oaiapikey: "API key for OpenAI. you can get it in https://platform.openai.com/account/api-keys",
        mainprompt: "The main prompt option sets the default model behavior.",
        jailbreak: "The jailbreak prompt option activates when jailbreak toggle is on in character.",
        globalNote: "A note that strongly affects model behavior, also known as UJB. Works in all characters.",
        autoSuggest: "Prompts used to generate options when automatically suggesting user responses.",
        formatOrder: "formating order of prompt. lower blocks does more effect to the model.",
        forceUrl: "if it is not blank, the request will go to the url that you had inputed.",
        tempature:
            "lower values make character follow prompts closely, but it will more likely to response like a machine.\nHigher values will result in creative behavior, but the character's response can break down more easily.",
        frequencyPenalty: "Higher values prevent the use of duplicate words in response, but character's response can break down more easily.",
        presensePenalty: "Higher values prevent the use of duplicate words in all context, but character's response can break down more easily.",
        sdProvider: "provider for image generation.",
        msgSound: "Plays *ding* sound when character responses",
        charDesc: "Brief description of the character. This affects characters response.",
        charFirstMessage: "First message of the character. This highly affects characters response.",
        charNote: "A note that strongly affects model behavior. Embbedded to current character, also known as UJB.",
        toggleNsfw: "toggles jailbreak prompt on and off.",
        lorebook: "Lorebook is a user-made dictionary for AI. AI only sees it when where is an activation keys in the context.",
        loreName: "Name of the lore. It doesn't affect the Ai.",
        loreActivationKey: "If one of the activation key exists in context, the lore will be activated and prompt will go in. seperated by commas.",
        loreorder: "If insert Order is higher, it will effect the model more, and it will more lessly cuted when activated lore are many.",
        bias: "bias is a key-value data which modifies the likelihood of string appearing.\nit can be -100 to 100, higher values will be more likely to appear, and lower values will be more unlikely to appear. \nAdditionaly, if its set to -101, it would work as 'strong ban word' for some models. \nWarning: if the tokenizer is wrong, it not work properly.",
        emotion:
            "Emotion Images option shows image depending at character's emotion which is analized by character's response. you must input emotion name as words *(like joy, happy, fear and etc.)* .emotion named **neutral** will be default emotion if it exists. must be more then 3 images to work properly.",
        imggen: "After analyzing the chat, apply the prompt to {{slot}}.",
        regexScript:
            "Regex Script is a custom regex that replaces string that matches IN to OUT.\n\nThere four type options." +
            "\n\n- **Modify Input** modifies user's input" +
            "\n\n- **Modify Output** modifies character's output" +
            "\n\n- **Modify Request Data** modifies current chat data when sent." +
            "\n\n- **Modify Display** just modifies the text when shown without modifying chat data." +
            "\n\nIN must be a regex without flags and without slashes in start and end.\n\nOUT is a string which can include replacement patterns. these are the patterns:" +
            "\n\n- $$\n\n    - inserts $" +
            "\n\n- $&\n\n    - inserts the matched substring." +
            "\n\n- $`\n\n    - inserts the portion of the string that precedes the matched substring." +
            "\n\n- $1\n\n    - inserts the first matching group. works with other number like 2, 3..." +
            "\n\n- $(name)\n\n    - inserts the named group" +
            "\n\nFor flags, you can not only use native supported flags, but also use these flags, which are designed for advanced users:" +
            "\n\n- `<inject>` - injects the result to the current string." +
            "\n- `<move_top>` - moves the result to the top of the string." +
            "\n- `<move_bottom>` - moves the result to the bottom of the string." +
            "\n- `<repeat_back>` - if the match is not found, it carries the result from the previous match." +
            "\n- `<order n>` - sets the order of the result. higher order will be shown first. `n` is a number. (like `<order 1>`) if this flag is not set, it will be set to 0." +
            "\n- `<cbs>` - parses curly braced synatxes in IN." +
            "\n\nTo use with native flags, you can use like `gi<cbs><move_top>`.",
        experimental: "This is a experimental feature. it might be unstable.",
        oogaboogaURL:
            "If your WebUI supports older version of api, your url should look *like https:.../run/textgen*\n\n" +
            "If your WebUI supports newVersion of api, your url should look like *https://.../api/v1/generate* and use the api server as host, and add --api to arguments.",
        exampleMessage:
            "Example conversations that affects output of the character. It doesn't uses tokens permanently." +
            "\n\nExample format of conversations:" +
            "\n\n```\n<START>\n{{user}}: hi\n{{char}}: hello\n<START>\n{{user}}: hi\nHaruhi: hello\n```" +
            "\n\n```<START>``` Marks the beginning of a new conversation.",
        creatorQuotes: "Note that appearances on top of first message. Used to inform users about this character. It doesn't go into prompt.",
        systemPrompt: "A prompt that replaces main prompt in settings if its not blank.",
        chatNote: "A note that strongly affects model behavior. Embbedded to current chat, also known as memory or UJB.",
        personality: "A brief description about character's personality. \n\n**It is not recommended to use this option. Describe it in character description instead.**",
        scenario: "A brief description about character's scenario. \n\n**It is not recommended to use this option. Describe it in character description instead.**",
        utilityBot: "When activated, it ignores main prompt, jailbreak and other prompts. used for bot made for utility, not for roleplay.",
        loreSelective: "If Selective mode is toggled, both Activation Key and Secondary key should have a match to activate the lore.",
        loreRandomActivation:
            "If Use Probability Condition is abled, if the lore's other conditions are all met, the lore will be activated with a set probability which is set by 'Probability' each time a chat is sent.",
        additionalAssets:
            "Additional assets to display in your chat. \n\n - use `{{raw::<asset name>}}` to use as path.\n - use `{{image::<asset name>}}` to use as image\n - use `{{video::<asset name>}}` to use as video\n - use `{{audio::<asset name>}}` to use as audio\n    - recommended to put in Background HTML",
        replaceGlobalNote: "If its not blank, it replaces current global note to this.",
        backgroundHTML:
            "A Markdown/HTML Data that would be injected to the background of chat screen.\n\n you can also use additional assets. for example, you can use `{{audio::<asset name}}` for background music." +
            "\n\n Additionaly, you can use these with additional assets:" +
            "\n - `{{bg::<asset name>}}`: inject the background as asset",
        additionalText: "The text that would be added to Character Description only when ai thinks its needed, so you can put long texts here. seperate with double newlines.",
        charjs: "A javascript code that would run with character. for example, you can check `https://github.com/kwaroran/Risuai/blob/main/src/etc/example-char.js` CURRENTLY NOT RECOMMENDED TO USE DUDE TO SECURITY REASONS. EXPORTING WOULD NOT INCLUDE THIS.",
        romanizer:
            "Romanizer is a plugin that converts non-roman characters to roman characters to reduce tokens when using non-roman characters while requesting data. this can result diffrent output from the original model. it is not recommended to use this plugin when using roman characters on chat.",
        inlayImages: "If enabled, images could be inlayed to the chat and AIs can see it if they support it.",
        metrica:
            "Metric Systemizer is a plugin that converts metrics to imperial units when request, and vice versa on output to show user metric system while using imperial for performace. it is not recommended to use this plugin when using imperial units on chat.",
        topP: "Top P is a probability threshold for nucleus sampling. model considers the results of the tokens with top_p probability mass.",
        openAIFixer: "OpenAI Fixer is a plugin that fixes some of the problems of OpenAI.",
        sayNothing: "If enabled, it will input 'say nothing' when no string inputed.",
        showUnrecommended: "If enabled, it will show unrecommended, deprecated settings. it is NOT RECOMMENDED to use these settings.",
        allowV2Plugin: "Warning: This enables deprecated V2.0 plugin execution. V2.0 plugins bypass the V2.1 safety check and may be unsafe. Leave this disabled unless you explicitly trust the plugin and cannot migrate it to V3 yet.",
        imageCompression: "If enabled, it will compress images when exporting character. if animated images doesn't works, try disabling this option.",
        inlayImageLossless: "If enabled, inlay images will be saved as lossless PNG instead of compressed WebP. This preserves original quality but uses significantly more storage.",
        inlayImagePriority: "If enabled, inlays render as images first for faster loading. Video/audio inlays auto-switch after image load fails. Disable if you use many video/audio inlays.",
        showModelInSidebar: "Show the current AI model name in the sidebar for quick reference.",
        showPresetInSidebar: "Show the active prompt preset name in the sidebar for quick reference.",
        showPersonaInSidebar: "Show the active persona name in the sidebar for quick reference.",
        disableMobileDragDrop: "Disable drag-and-drop for chat reordering on mobile devices. Enable this if you experience accidental drags while scrolling.",
        disableToggleBinding: "Disable the toggle binding feature that pins toggle values to individual chats. When disabled, the bind/save/preset buttons are hidden and previously bound values are not restored on chat switch.",
        hideLoadout: "Hide the loadout feature. Loadouts let you save and restore preset/module/persona combinations. When hidden, the loadout hotkey (Ctrl+O) and quick menu entry are also disabled.",
        hideEasyPanel: "Hide the Easy Panel menu entry. The Easy Panel itself is part of Pro Tools, but this option hides its button from the chat menu and settings sidebar independently.",
        useExperimental: "If enabled, it will show some experimental features.",
        forceProxyAsOpenAI: "If enabled, it will force to use OpenAI format when using reverse proxy.",
        forcePlainFetch: "If enabled, it will use the browser Fetch API instead of the native HTTP request. This can cause CORS errors.",
        autoFillRequestURL: "If enabled, it will automatically fill the request URL to match the current model.",
        localNetworkModeDesc: "Routes private/LAN model URLs through the local server instead of browser direct fetch.\n\n**Purpose**\n- Avoid browser private-network/CORS restrictions\n- Mitigate timeout risk for slow first-token local inference\n\n**How it works**\n- Streaming uses experimental Job+WebSocket relay first (fallback to /proxy2)\n- Non-streaming uses /proxy2 relay\n\n**Constraints**\n- Scope is OpenAI-compatible request paths only",
        chainOfThought: "If enabled, it will add chain of thought prompt to the prompt.",
        gptVisionQuality: "This option is used to set the quality of the image detection model. the higher the quality, the more accurate the detection, but more tokens are used.",
        genTimes:
            "This option is used to set the number of responses to generate on support models. other then first response will be act as cached reroll. this can reduce the cost of the model, but it can also increase the cost if you use it without reroll.",
        requestretrys: "This option is used to set the number of request retrys when request fails.",
        emotionPrompt: "This option is used to set the prompt that is used to detect emotion. if it is blank, it will use the default prompt.",
        additionalParams:
            'Additional parameters that would be added to the request body. if you want to exclude some parameters, you can put `{{none}}` to the value. if you want to add a header instead of body, you can put `header::` in front of the key like `header::Authorization`. if you want value as json, you can put `json::` in front of the value like `json::{"key":"value"}`. otherwise, type of the value would be determined automatically.',
        antiClaudeOverload:
            "If Claude overload happens, Risuai would try to prevent it by continuing with same prompt, making it less likely to happen. works only for streamed responses. this could not work for non-official api endpoints.",
        triggerScript:
            'Trigger Script is a custom script that runs when a condition is met. it can be used to modify the chat data, run a command, change variable, and etc. the type depends when it is triggered. it can also be run by buttons, which can be used with {{button::Display::TriggerName}}, or HTML buttons with `risu-trigger="<TriggerName>"` attribute.',
        autoContinueChat: "If enabled, it will try to continue the chat if it doesn't ends with a punctuation. DONT USE THIS WITH LANGUAGES THAT DOESN'T USE PUNCTUATION.",
        combineTranslation:
            "If enabled, text that is one sentence but separated by HTML tags will be combined together and translated, then Modify Display script will be reapplied to the translated output.\nThis helps the translator to make the correct translation.\nIf the UI becomes weird when you enable this option, please turn off the option and report it.",
        dynamicAssets:
            "If enabled, if the asset name is not found when processing data, it will try to find the closest asset name by using vector search and replace it with the closest asset name.",
        dynamicAssetsEditDisplay: "If enabled, the dynamic assets will be applied to the Modify Display stage too. however, this can cause performance issues.",
        nickname: "Nickname would used be in {{char}} or <char> in chat instead of character's name if it is set.",
        useRegexLorebook: "If enabled, it will use regex for lorebook search, instead of string matching. it uses /regex/flags format.",
        customChainOfThought: "Warning: chain of thought toggle is no longer recommended to use. put chain of thought prompt in other prompt entries instead.",
        customPromptTemplateToggle:
            "Here you can define your own prompt toggles. use `<toggle variable>=<toggle name>` format, seperated by newline. for example, `cot=Toggle COT`. you can use these toggles in prompt by using `{{getglobalvar::toggle_<toggle variable>}}`. like `{{getglobalvar::toggle_cot}}`.",
        defaultVariables:
            "Here you can define your own default variables. use `<variable name>=<variable value>` format, seperated by newline. for example, `name=Risuai`, which then can be used with trigger scripts and variables CBS like `{{getvar::A}}`, `{{setvar::A::B}}` or `{{? $A + 1}}`. if prompt template's default variable and character's default variable has same name, character's default variable will be used.",
        lowLevelAccess:
            "If enabled, it will enable access to features that requires high computing powers and executing AI model via triggers in the character. do not enable this unless you really need these features.",
        triggerLLMPrompt:
            "A prompt that would be sent to the model. you can use multi turns and roles by using `@@role user`, `@@role system`, `@@role assistant`. for example, \n```\n@@role system\nrespond as hello\n@@role assistant\nhello\n@@role user\nhi\n```",
        legacyTranslation:
            "If enabled, it will use the old translation method, which preprocess markdown and quotes before translations instead of postprocessing after translations.",
        luaHelp:
            "You can use Lua scripts as a trigger script. you can define onInput, onOutput, onStart functions. onInput is called when user sends a message, onOutput is called when character sends a message, onStart is called when the chat starts. for more information, see the documentation.",
        claudeCachingExperimental:
            "Caching in Claude is experimental feature that can reduce the cost of the model, but it can also increase the cost if you use it without reroll. since this is a experimental feature, it can be unstable and behavior can be changed in the future.",
        urllora:
            "You can use direct download link of the model file. you can make direct url from google drive like website like https://sites.google.com/site/gdocs2direct/ , or use civitai URL, copy the the AIR (looks like `urn:air:flux1:lora:civitai:180891@776656` or just `civitai:180891@776656`) and paste it.",
        v2GetAlertSelect: "Options are separated by | (pipe) character.",
        v2RegexTest: "Returns 1 if the regex matches, 0 if it doesn't match.",
        v2Calculate:
            "Evaluates mathematical expressions with support for basic arithmetic (+, -, *, /, %, ^), comparison operators (<, >, <=, >=, =, !=), logical operators (&&, ||, !), parentheses for precedence, and variable substitution using $variableName format. Variables are automatically converted to numbers (defaults to 0 if invalid).",
        namespace:
            "Namespace is a unique identifier for the module. it is used to prevent conflicts between modules, and for interaction of presets, other modules and etc. if you are not sure what to put, leave it blank.",
        moduleIntergration:
            "You can enable modules by putting the module namespace in the module intergartion sections. if you want to enable multiple modules, you can seperate them by comma. for example, `module1,module2,module3`. this is for advanced users, who wants to vary the use of modules by presets.",
        customCSS: "Custom CSS for styling. you can also disable/enable it by pressing (Ctrl + .) if something goes wrong.",
        betaMobileGUI: "If enabled, it will use beta mobile GUI on small (less than 800px) screens. requires refresh.",
        enableScrollToActiveChar: "If enabled, pressing the hotkey or holding Ctrl while dragging a character will scroll to the currently active character. Folders will be opened automatically if closed.",
        unrecommended: "This is a unrecommended setting. it is not recommended to use this setting.",
        jsonSchema:
            "This is a JSON Schema that will be sent to the AI model if AI model supports JSON Schema.\n\nHowever, since JSON Schema is hard to learn, In Risuai, you can use subset of TypeScript interface instead of JSON Schema. Risuai will convert it in runtime." +
            'For example, if you want to send a JSON like this:\n\n```js\n{\n  "name": "Risuai", //name must be Risuai,\n  "age": 1, //age must be number,\n  "icon": "slim", //icon must be \'slim\' or \'rounded\'\n  "thoughts": ["Good View!", "Lorem"] //thoughts must be array of strings\n}\n```\n\n' +
            "You can put this TypeScript interface:\n\n```typescript\ninterface Schema {\n  name: string;\n  age: number;\n  icon: 'slim'|'rounded'\n  thoughts: string[]\n}\n```\n\n" +
            "Name of the interface doesn't matter. for more information, see the typescript documentation. (https://www.typescriptlang.org/docs/handbook/interfaces.html), and to Check what subset of TypeScript is supported, see the below." +
            "<details><summary>Supported TypeScript Subset</summary>\n\n" +
            `Supported types are \`boolean\`, \`number\`, \`string\`, \`Array\`. Advanced typing like unit types, intersection types, union types, optional, literal types, and etc. are not supported except for these cases:\n
        - Array of primitive types: (ex. \`string[]\`, \`Array<boolean>)\`
        - Unit types between strings: (ex. \`'slim'|'rounded'\`).

        Properties must be one in a line. if there is multiple properties in a line, it will throw an error. Properties and name of the interface must be only in latin characters, in ASCII range. name of the properties must not be surrounded by quotes or double quotes. Nesting inside the interface is not supported. it is not allowed to put \`{\` or \`}\` in the line that properties are defined. If you want to use more advanced types, use JSON Schema instead.
        ` +
            "</details>",
        strictJsonSchema: "If enabled, it will strictly follow the Provided Schema for JSON on some models. if it is disabled, it may ignore the JSON Schema.",
        extractJson:
            'If it is not blank, it will extract specific JSON data from the response. for example, if you want to extract `response.text[0]` in response `{"response": {"text": ["hello"]}}`, you can put `response.text.0`.',
        translatorNote:
            "Here, you can add a unique translation prompt for each character. This option only applies when using the Ax. model for translation. To apply it, include `{{slot::tnote}}` in the language settings. It doesn't work in group chats.",
        groupInnerFormat:
            "This defines a format that is used in group chat for characters that isn't speaker. if it is not blank, it will use this format instead of the default format. if `Group Other Bot Role` is `assistant`, it will also be applied to the speaker.",
        chatHTML:
            "A HTML that would be inserted as each chat.\n\nYou can use CBS and special tags.\n- `<risutextbox>`: a textbox that would be used to render text\n- `<risuicon>`: an icon for user or assistant\n- `<risubuttons>`: icon buttons for chat edit, translations and etc.\n- `<risugeninfo>`: generation information button.",
        systemContentReplacement: "The prompt format that replaces system prompt if the model doesn't support system prompt.",
        systemRoleReplacement: "The role that replaces system role if the model doesn't support system role.",
        summarizationPrompt:
            "The prompt that is used for summarization. if it is blank, it will use the default prompt. you can also use ChatML formating with {{slot}} for the chat data. The summary output is split by double newlines (\\n\\n) into chunks for similarity search.",
        translatorPrompt:
            "The prompt that is used for translation. if it is blank, it will use the default prompt. you can also use ChatML formating with {{slot}} for the dest language, {{solt::content}} for the content, and {{slot::tnote}} for the translator note.",
        translateBeforeHTMLFormatting:
            "If enabled, it will translate the text before Regex scripts and HTML formatting. this could make the token lesser but could break the formatting.",
        autoTranslateCachedOnly: "If enabled with Auto Translation option on, it will automatically translate only the messages that the user has translated previously.",
        presetChain:
            "If it is not blank, the preset will be changed and applied randomly every time when user sends a message in the preset list in this input. preset list should be seperated by comma, for example, `preset1,preset2`.",
        legacyMediaFindings: "If enabled, it will use the old method to find media assets, without using the additional search algorithm.",
        comfyWorkflow:
            "Put the API workflow of comfy UI. you can get your API workflow in comfy UI by pressing the 'Workflow > Export (API)' button. you must also put {{risu_prompt}} in you workflow text. the {{risu_prompt}} will be replaced with the prompt provided by the Risu.",
        automaticCachePoint: "Automatically creates cache point after the chat ends, if the caching point doesn't exist.",
        experimentalChatCompressionDesc:
            "Compresses the unused chat data and saves in seperate file. this greatly reduces the size of the chat data, and greatly improves the performance, however its experimental and can be unstable, causing issues in backup feature and more.",
        promptInfoInsideChatDesc:
            "When enabled, this stores prompt preset information in the chat metadata. The stored data includes the preset name, active toggles, and the prompt text. This may slightly increase processing time and storage usage.",
        autoAdjustSchema: "When enabled, it will automatically adjust the JSON schema for Dynamic Output.",
        dynamicMessages: "When enabled, it will allow the assistant to send multiple messages in a row, instead of one at a time.",
        dynamicMemory: "When enabled, assistant will make memory notes on response time. additional prompting is required to utilize this feature.",
        dynamicResponseTiming: "When enabled, it will adjust the response timing dynamically.",
        dynamicRequest: "When enabled, it will request to model at random timing without waiting for user input.",
        settingsCloseButtonSize: "Adjusts the size of the close (X) button in the top right corner of the settings window. Default is 24.",
        showTypingEffect: "When enabled, it will show a typing indicator while the assistant is generating a response.",
        dynamicOutputPrompt: "When enabled, the schema information will be included in the request.",
        realmDirectOpen: "If enabled, clicking a character in RisuRealm preview will directly open the character description.",
        openRouterProviderOrder:
            "The order of providers to use, the first provider will be used first, if the provider is not available, it will use the next provider. See datail on https://openrouter.ai/docs/guides/routing/provider-selection#ordering-specific-providers",
        openRouterProviderOnly:
            "Only use the providers in this list, if all the provider is not available, the request will failed. See detail on https://openrouter.ai/docs/guides/routing/provider-selection#allowing-only-specific-providers",
        openRouterProviderIgnore:
            "Ignore the providers in this list, if all the provider is ingored, the request will failed. See detail on https://openrouter.ai/docs/guides/routing/provider-selection#ignoring-providers",
        additionalPrompt:
            "Text that gets appended to the Main Prompt when Prompt Preprocess is enabled. Default is 'The assistant must act as {{char}}. user is {{user}}.' This helps set up basic roleplay context.",
        hideAllImagesDesc: "Hides bot icons, bot image assets, and RisuRealm cover images.",
        hideMessagePageCountDesc: "Hides the page counter (e.g. 1/3) for regenerated messages and first message greetings. Navigation arrows and the regenerate button remain visible.",
        embedding:
            "Embedding model is used for similarity search across multiple features:\n\n" +
            "- **Long Term Memory**: HypaV2, HypaV3, Hanurai Memory, and SupaMemory (with HypaMemory enabled)\n" +
            "- **Additional Text**: Matching character additional info based on context\n" +
            "- **Dynamic Assets**: Finding similar asset names when exact match is not found\n" +
            "- **Trigger Scripts**: Similarity conditions in trigger scripts\n" +
            "- **File Attachments**: Searching within PDF/TXT/XML attachments",
        keepSessionAlive:
            "Keeps the tab active and prevents the session from expiring due to inactivity in browsers. This may require refresh to take effect.\n\n" +
            "- **Via Sound**: Plays a silent audio at regular intervals to keep the session alive. This method is known as most compatible and effective in most browsers.\n",
        reSummarizationPrompt:
            "The prompt used when merging multiple selected summaries into one via bulk edit. If blank, the default prompt is used. The summary output is split by double newlines (\\n\\n) into chunks for similarity search.",
        hypaV3MemoryTokensRatio:
            "The fraction of the max context size allocated to the long-term memory block {{slot}} in the prompt.",
        hypaV3ExtraSummarizationRatio:
            "Lowers the threshold at which summarization stops. At 0, summarization stops as soon as tokens fall below the max context. Higher values cause more summarization before stopping.",
        hypaV3MaxChatsPerSummary:
            "Maximum number of chat messages to include when creating a single summary.",
        hypaV3RecentMemoryRatio:
            "The fraction of memory tokens allocated to recent memory. Automatically filled with the most recently created summaries until the allocated tokens are full.",
        hypaV3SimilarMemoryRatio:
            "The fraction of memory tokens allocated to similar memory. Automatically filled with summaries that have the highest similarity scores to recent chats until the allocated tokens are full.",
        hypaV3RandomMemoryRatio:
            "Randomly filled from summaries not already selected by other categories.",
        hypaV3PreserveOrphanedMemory:
            "If enabled, summaries that reference deleted chat messages will be preserved. If disabled, summaries whose source messages no longer exist are automatically removed.",
        hypaV3ProcessRegexScript:
            "If enabled, regex scripts will be applied to the input chat messages when regenerating summaries in the HypaV3 modal.",
        hypaV3DoNotSummarizeUserMessage:
            "If enabled, user messages are excluded from the max messages per summary count.",
        hypaV3EnableSimilarityCorrection:
            "If enabled, a summary of recent chats is additionally used as a query. Does not work with the experimental HypaMemory V3.",
        hypaV3UseExperimentalImpl:
            "Switches to the experimental HypaMemory V3 implementation. Enables rate limit settings and changes the query method.",
        hypaV3AlwaysToggleOn:
            "If enabled, the HypaMemory toggle is automatically activated when selecting a character.",
        hypaV3SummarizationRequestsPerMinute:
            "Maximum summarization model requests per minute. Only applies when the summarization model is set to Auxiliary Model.",
        hypaV3SummarizationMaxConcurrent:
            "Maximum concurrent summarization model requests. Only applies when the summarization model is set to Auxiliary Model.",
        hypaV3EmbeddingRequestsPerMinute:
            "Maximum embedding model requests per minute for similarity search.",
        hypaV3EmbeddingMaxConcurrent:
            "Maximum concurrent embedding model requests for similarity search.",
        hypaV3QueryChatCount:
            "The number of recent chat messages used as the query for similarity search. " +
            "Higher values use more chat context to determine similarity.",
        useNodeOnlyScrollButton:
            "Shows navigation buttons to jump between chat messages while scrolling. Buttons appear on scroll and fade out after 1.5 seconds.",
}
