import { LLMFlags, LLMFormat, LLMProvider, LLMTokenizer, ClaudeParameters, OpenAIParameters, GPT5Parameters, type LLMModel } from '../types'

export const NanoGPTModels: LLMModel[] = [

    // ── OpenAI (via NanoGPT) ────────────────────────────────────────

    {
        name: "GPT-5.4",
        id: 'nanogpt-openai/gpt-5.4',
        internalID: 'openai/gpt-5.4',
        shortName: "NanoGPT 5.4",
        provider: LLMProvider.NanoGPT,
        format: LLMFormat.OpenAICompatible,
        flags: [
            LLMFlags.hasImageInput,
            LLMFlags.hasFullSystemPrompt,
            LLMFlags.hasStreaming,
        ],
        parameters: GPT5Parameters,
        tokenizer: LLMTokenizer.tiktokenO200Base,
        recommended: true
    },
    {
        name: "GPT-5.2",
        id: 'nanogpt-openai/gpt-5.2',
        internalID: 'openai/gpt-5.2',
        shortName: "NanoGPT 5.2",
        provider: LLMProvider.NanoGPT,
        format: LLMFormat.OpenAICompatible,
        flags: [
            LLMFlags.hasImageInput,
            LLMFlags.hasFullSystemPrompt,
            LLMFlags.hasStreaming,
        ],
        parameters: GPT5Parameters,
        tokenizer: LLMTokenizer.tiktokenO200Base,
        recommended: true,
    },
    {
        name: "GPT-5.1",
        id: 'nanogpt-openai/gpt-5.1',
        internalID: 'openai/gpt-5.1',
        shortName: "NanoGPT 5.1",
        provider: LLMProvider.NanoGPT,
        format: LLMFormat.OpenAICompatible,
        flags: [
            LLMFlags.hasImageInput,
            LLMFlags.hasFullSystemPrompt,
            LLMFlags.hasStreaming,
        ],
        parameters: GPT5Parameters,
        tokenizer: LLMTokenizer.tiktokenO200Base,
    },
    {
        name: "GPT-5 Mini",
        id: 'nanogpt-openai/gpt-5-mini',
        internalID: 'openai/gpt-5-mini',
        shortName: "NanoGPT 5 Mini",
        provider: LLMProvider.NanoGPT,
        format: LLMFormat.OpenAICompatible,
        flags: [
            LLMFlags.hasImageInput,
            LLMFlags.hasFullSystemPrompt,
            LLMFlags.hasStreaming,
        ],
        parameters: GPT5Parameters,
        tokenizer: LLMTokenizer.tiktokenO200Base,
    },
    {
        name: "GPT-4o",
        id: 'nanogpt-openai/gpt-4o',
        internalID: 'openai/gpt-4o',
        shortName: "NanoGPT 4o",
        provider: LLMProvider.NanoGPT,
        format: LLMFormat.OpenAICompatible,
        flags: [
            LLMFlags.hasImageInput,
            LLMFlags.hasFullSystemPrompt,
            LLMFlags.hasStreaming,
        ],
        parameters: OpenAIParameters,
        tokenizer: LLMTokenizer.tiktokenO200Base,
    },

    // ── Anthropic (via NanoGPT) ─────────────────────────────────────

    {
        name: "Claude 4.6 Opus",
        id: 'nanogpt-anthropic/claude-opus-4.6',
        internalID: 'anthropic/claude-opus-4.6',
        shortName: "NanoGPT Opus 4.6",
        provider: LLMProvider.NanoGPT,
        format: LLMFormat.OpenAICompatible,
        flags: [
            LLMFlags.hasImageInput,
            LLMFlags.hasFullSystemPrompt,
            LLMFlags.hasStreaming,
        ],
        parameters: OpenAIParameters,
        tokenizer: LLMTokenizer.tiktokenO200Base,
        recommended: true
    },
    {
        name: "Claude 4.6 Sonnet",
        id: 'nanogpt-anthropic/claude-sonnet-4.6',
        internalID: 'anthropic/claude-sonnet-4.6',
        shortName: "NanoGPT Sonnet 4.6",
        provider: LLMProvider.NanoGPT,
        format: LLMFormat.OpenAICompatible,
        flags: [
            LLMFlags.hasImageInput,
            LLMFlags.hasFullSystemPrompt,
            LLMFlags.hasStreaming,
        ],
        parameters: OpenAIParameters,
        tokenizer: LLMTokenizer.tiktokenO200Base,
        recommended: true
    },
    {
        name: "Claude 4.5 Sonnet",
        id: 'nanogpt-anthropic/claude-sonnet-4.5',
        internalID: 'anthropic/claude-sonnet-4.5',
        shortName: "NanoGPT Sonnet 4.5",
        provider: LLMProvider.NanoGPT,
        format: LLMFormat.OpenAICompatible,
        flags: [
            LLMFlags.hasImageInput,
            LLMFlags.hasFullSystemPrompt,
            LLMFlags.hasStreaming,
        ],
        parameters: OpenAIParameters,
        tokenizer: LLMTokenizer.tiktokenO200Base,
    },
    {
        name: "Claude 4.5 Haiku",
        id: 'nanogpt-anthropic/claude-haiku-4.5',
        internalID: 'anthropic/claude-haiku-4.5',
        shortName: "NanoGPT Haiku 4.5",
        provider: LLMProvider.NanoGPT,
        format: LLMFormat.OpenAICompatible,
        flags: [
            LLMFlags.hasImageInput,
            LLMFlags.hasFullSystemPrompt,
            LLMFlags.hasStreaming,
        ],
        parameters: OpenAIParameters,
        tokenizer: LLMTokenizer.tiktokenO200Base,
    },

    // ── Google (via NanoGPT) ────────────────────────────────────────

    {
        name: "Gemini 2.5 Pro",
        id: 'nanogpt-google/gemini-2.5-pro',
        internalID: 'google/gemini-2.5-pro',
        shortName: "NanoGPT 2.5 Pro",
        provider: LLMProvider.NanoGPT,
        format: LLMFormat.OpenAICompatible,
        flags: [
            LLMFlags.hasImageInput,
            LLMFlags.hasFullSystemPrompt,
            LLMFlags.hasStreaming,
        ],
        parameters: OpenAIParameters,
        tokenizer: LLMTokenizer.tiktokenO200Base,
    },
    {
        name: "Gemini 3 Flash",
        id: 'nanogpt-google/gemini-3-flash',
        internalID: 'google/gemini-3-flash',
        shortName: "NanoGPT 3 Flash",
        provider: LLMProvider.NanoGPT,
        format: LLMFormat.OpenAICompatible,
        flags: [
            LLMFlags.hasImageInput,
            LLMFlags.hasFullSystemPrompt,
            LLMFlags.hasStreaming,
        ],
        parameters: OpenAIParameters,
        tokenizer: LLMTokenizer.tiktokenO200Base,
    },
    {
        name: "Gemini 3 Pro",
        id: 'nanogpt-google/gemini-3-pro',
        internalID: 'google/gemini-3-pro',
        shortName: "NanoGPT 3 Pro",
        provider: LLMProvider.NanoGPT,
        format: LLMFormat.OpenAICompatible,
        flags: [
            LLMFlags.hasImageInput,
            LLMFlags.hasFullSystemPrompt,
            LLMFlags.hasStreaming,
        ],
        parameters: OpenAIParameters,
        tokenizer: LLMTokenizer.tiktokenO200Base,
    },

    // ── DeepSeek (via NanoGPT) ──────────────────────────────────────

    {
        name: "DeepSeek R1",
        id: 'nanogpt-deepseek/deepseek-r1',
        internalID: 'deepseek/deepseek-r1',
        shortName: "NanoGPT R1",
        provider: LLMProvider.NanoGPT,
        format: LLMFormat.OpenAICompatible,
        flags: [
            LLMFlags.hasFullSystemPrompt,
            LLMFlags.hasStreaming,
        ],
        parameters: OpenAIParameters,
        tokenizer: LLMTokenizer.tiktokenO200Base,
    },
    {
        name: "DeepSeek V3",
        id: 'nanogpt-deepseek/deepseek-v3',
        internalID: 'deepseek/deepseek-v3',
        shortName: "NanoGPT V3",
        provider: LLMProvider.NanoGPT,
        format: LLMFormat.OpenAICompatible,
        flags: [
            LLMFlags.hasFullSystemPrompt,
            LLMFlags.hasStreaming,
        ],
        parameters: OpenAIParameters,
        tokenizer: LLMTokenizer.tiktokenO200Base,
    },

    // ── xAI (via NanoGPT) ───────────────────────────────────────────

    {
        name: "Grok 4",
        id: 'nanogpt-x-ai/grok-4',
        internalID: 'x-ai/grok-4',
        shortName: "NanoGPT Grok 4",
        provider: LLMProvider.NanoGPT,
        format: LLMFormat.OpenAICompatible,
        flags: [
            LLMFlags.hasImageInput,
            LLMFlags.hasFullSystemPrompt,
            LLMFlags.hasStreaming,
        ],
        parameters: OpenAIParameters,
        tokenizer: LLMTokenizer.tiktokenO200Base,
    },

    // ── Google Gemma (via NanoGPT) ──────────────────────────────────

    {
        name: "Gemma 4 31B Instruct",
        id: 'nanogpt-google/gemma-4-31b-it',
        internalID: 'google/gemma-4-31b-it',
        shortName: "NanoGPT Gemma 4 31B",
        provider: LLMProvider.NanoGPT,
        format: LLMFormat.OpenAICompatible,
        flags: [
            LLMFlags.hasFullSystemPrompt,
            LLMFlags.hasStreaming,
        ],
        parameters: OpenAIParameters,
        tokenizer: LLMTokenizer.tiktokenO200Base,
        recommended: true,
    },
    {
        name: "Gemma 4 26B A4B Instruct",
        id: 'nanogpt-google/gemma-4-26b-a4b-it',
        internalID: 'google/gemma-4-26b-a4b-it',
        shortName: "NanoGPT Gemma 4 26B",
        provider: LLMProvider.NanoGPT,
        format: LLMFormat.OpenAICompatible,
        flags: [
            LLMFlags.hasFullSystemPrompt,
            LLMFlags.hasStreaming,
        ],
        parameters: OpenAIParameters,
        tokenizer: LLMTokenizer.tiktokenO200Base,
        recommended: true,
    },
    {
        name: "Gemma 4 26B A4B Thinking",
        id: 'nanogpt-google/gemma-4-26b-a4b-it:thinking',
        internalID: 'google/gemma-4-26b-a4b-it:thinking',
        shortName: "NanoGPT Gemma 4 26B Think",
        provider: LLMProvider.NanoGPT,
        format: LLMFormat.OpenAICompatible,
        flags: [
            LLMFlags.hasFullSystemPrompt,
            LLMFlags.hasStreaming,
        ],
        parameters: OpenAIParameters,
        tokenizer: LLMTokenizer.tiktokenO200Base,
        recommended: true,
    },

    // ── ZAI (via NanoGPT) ───────────────────────────────────────────

    {
        name: "GLM 5.1",
        id: 'nanogpt-zai-org/glm-5.1',
        internalID: 'zai-org/glm-5.1',
        shortName: "NanoGPT GLM 5.1",
        provider: LLMProvider.NanoGPT,
        format: LLMFormat.OpenAICompatible,
        flags: [
            LLMFlags.hasFullSystemPrompt,
            LLMFlags.hasStreaming,
        ],
        parameters: OpenAIParameters,
        tokenizer: LLMTokenizer.tiktokenO200Base,
        recommended: true,
    },
    {
        name: "GLM 5.1 Thinking",
        id: 'nanogpt-zai-org/glm-5.1:thinking',
        internalID: 'zai-org/glm-5.1:thinking',
        shortName: "NanoGPT GLM 5.1 Think",
        provider: LLMProvider.NanoGPT,
        format: LLMFormat.OpenAICompatible,
        flags: [
            LLMFlags.hasFullSystemPrompt,
            LLMFlags.hasStreaming,
        ],
        parameters: OpenAIParameters,
        tokenizer: LLMTokenizer.tiktokenO200Base,
        recommended: true,
    },
]
