import { describe, expect, test } from 'vitest'

import { CopilotModels } from './copilot'
import { NanoGPTModels } from './nanogpt'
import { LLMFlags, LLMFormat, LLMTokenizer } from '../types'

describe('provider model metadata', () => {
    test('marks requested Copilot models as recommended', () => {
        const recommendedIds = new Set(
            CopilotModels.filter((model) => model.recommended).map((model) => model.id)
        )

        expect(recommendedIds.has('copilot-gpt-5.1')).toBe(true)
        expect(recommendedIds.has('copilot-gemini-3-flash-preview')).toBe(true)
        expect(recommendedIds.has('copilot-gemini-3.1-pro-preview')).toBe(true)
    })

    test('keeps static Copilot GPT-5.4 on chat completions format', () => {
        const gpt54 = CopilotModels.find((model) => model.id === 'copilot-gpt-5.4')

        expect(gpt54?.format).toBe(LLMFormat.OpenAICompatible)
    })

    test('marks static Copilot GPT-5 models to use completion-token field', () => {
        const gpt5Ids = [
            'copilot-gpt-5.4',
            'copilot-gpt-5.2',
            'copilot-gpt-5.1',
            'copilot-gpt-5-mini',
        ]

        for (const id of gpt5Ids) {
            const model = CopilotModels.find((entry) => entry.id === id)
            expect(model?.flags.includes(LLMFlags.OAICompletionTokens)).toBe(true)
        }
    })

    test('keeps NanoGPT models OpenAI-compatible with o200 tokenizer', () => {
        for (const model of NanoGPTModels) {
            expect(model.format).toBe(LLMFormat.OpenAICompatible)
            expect(model.tokenizer).toBe(LLMTokenizer.tiktokenO200Base)
        }
    })

    test('includes requested NanoGPT Gemma and GLM recommendations', () => {
        const modelMap = new Map(NanoGPTModels.map((model) => [model.id, model]))

        expect(modelMap.get('nanogpt-google/gemma-4-31b-it')?.recommended).toBe(true)
        expect(modelMap.get('nanogpt-google/gemma-4-26b-a4b-it')?.recommended).toBe(true)
        expect(modelMap.get('nanogpt-google/gemma-4-26b-a4b-it:thinking')?.recommended).toBe(true)
        expect(modelMap.get('nanogpt-zai-org/glm-5.1')?.recommended).toBe(true)
        expect(modelMap.get('nanogpt-zai-org/glm-5.1:thinking')?.recommended).toBe(true)
    })
})
