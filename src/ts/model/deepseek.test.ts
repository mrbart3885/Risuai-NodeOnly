import { describe, expect, test } from 'vitest'
import { getDeepSeekV4ThinkingParams, isDeepSeekV4ModelId } from './deepseek'

describe('DeepSeek model helpers', () => {
    test('detects official DeepSeek V4 model ids', () => {
        expect(isDeepSeekV4ModelId('deepseek-v4-flash')).toBe(true)
        expect(isDeepSeekV4ModelId('deepseek-v4-pro')).toBe(true)
        expect(isDeepSeekV4ModelId('deepseek-chat')).toBe(false)
    })

    test('maps UI reasoning effort values to DeepSeek V4 thinking params', () => {
        expect(getDeepSeekV4ThinkingParams(-1)).toEqual({
            thinking: { type: 'disabled' },
        })
        expect(getDeepSeekV4ThinkingParams(0)).toEqual({
            thinking: { type: 'enabled' },
            reasoning_effort: 'high',
        })
        expect(getDeepSeekV4ThinkingParams(1)).toEqual({
            thinking: { type: 'enabled' },
            reasoning_effort: 'high',
        })
        expect(getDeepSeekV4ThinkingParams(2)).toEqual({
            thinking: { type: 'enabled' },
            reasoning_effort: 'high',
        })
        expect(getDeepSeekV4ThinkingParams(3)).toEqual({
            thinking: { type: 'enabled' },
            reasoning_effort: 'max',
        })
        expect(getDeepSeekV4ThinkingParams(-1000)).toBeUndefined()
    })
})
