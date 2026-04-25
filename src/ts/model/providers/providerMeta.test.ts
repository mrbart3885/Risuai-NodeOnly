import { describe, expect, test } from 'vitest'

import { CopilotModels } from './copilot'
import { NanoGPTModels } from './nanogpt'
import { OpenAIModels } from './openai'
import { LLMFlags, LLMFormat, LLMTokenizer } from '../types'

describe('provider model metadata', () => {
    test('marks requested Copilot models as recommended', () => {
        const recommendedIds = new Set(
            CopilotModels.filter((model) => model.recommended).map((model) => model.id)
        )

        expect(recommendedIds.has('copilot-gpt-5.5')).toBe(true)
        expect(recommendedIds.has('copilot-gpt-5.5-pro')).toBe(true)
        expect(recommendedIds.has('copilot-gpt-5.1')).toBe(true)
        expect(recommendedIds.has('copilot-gemini-3-flash-preview')).toBe(true)
        expect(recommendedIds.has('copilot-gemini-3.1-pro-preview')).toBe(true)
    })

    test('registers upcoming OpenAI GPT-5.5 aliases', () => {
        const modelMap = new Map(OpenAIModels.map((model) => [model.id, model]))

        expect(modelMap.get('gpt-5.5')?.internalID).toBe('gpt-5.5')
        expect(modelMap.get('gpt-5.5-pro')?.internalID).toBe('gpt-5.5-pro')
        expect(modelMap.get('gpt-5.5')?.recommended).toBe(true)
    })

    test('registers upcoming Copilot GPT-5.5 aliases', () => {
        const modelMap = new Map(CopilotModels.map((model) => [model.id, model]))

        expect(modelMap.get('copilot-gpt-5.5')?.internalID).toBe('gpt-5.5')
        expect(modelMap.get('copilot-gpt-5.5-pro')?.internalID).toBe('gpt-5.5-pro')
    })

    test('routes Copilot GPT-5.5 models through the responses API', () => {
        const modelMap = new Map(CopilotModels.map((model) => [model.id, model]))

        expect(modelMap.get('copilot-gpt-5.5')?.format).toBe(LLMFormat.OpenAIResponseAPI)
        expect(modelMap.get('copilot-gpt-5.5-pro')?.format).toBe(LLMFormat.OpenAIResponseAPI)
    })

    test('keeps static Copilot GPT-5.4 on chat completions format', () => {
        const gpt54 = CopilotModels.find((model) => model.id === 'copilot-gpt-5.4')

        expect(gpt54?.format).toBe(LLMFormat.OpenAICompatible)
    })

    test('marks static Copilot GPT-5 models to use completion-token field', () => {
        const gpt5Ids = [
            'copilot-gpt-5.5',
            'copilot-gpt-5.5-pro',
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

    test('includes requested NanoGPT GLM recommendations', () => {
        const modelMap = new Map(NanoGPTModels.map((model) => [model.id, model]))

        expect(modelMap.get('nanogpt-zai-org/glm-5.1')?.recommended).toBe(true)
        expect(modelMap.get('nanogpt-zai-org/glm-5.1:thinking')?.recommended).toBe(true)
    })
})
