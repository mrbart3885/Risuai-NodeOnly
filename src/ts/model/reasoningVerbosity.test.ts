import { describe, expect, test } from 'vitest'
import {
    dbReasoningEffortToApi,
    dbReasoningEffortToUi,
    dbVerbosityToApi,
    dbVerbosityToUi,
    uiReasoningEffortToDb,
    uiVerbosityToDb,
} from './reasoningVerbosity'

describe('reasoning and verbosity helpers', () => {
    test('maps DB reasoning values to fixed UI options', () => {
        expect(dbReasoningEffortToUi(-1)).toBe('none')
        expect(dbReasoningEffortToUi(0)).toBe('low')
        expect(dbReasoningEffortToUi(1)).toBe('medium')
        expect(dbReasoningEffortToUi(2)).toBe('high')
        expect(dbReasoningEffortToUi(3)).toBe('xhigh')
        expect(dbReasoningEffortToUi(undefined, { allowDefault: true })).toBe('default')
        expect(uiReasoningEffortToDb('xhigh')).toBe(3)
    })

    test('maps DB verbosity values to fixed UI and API options', () => {
        expect(dbVerbosityToUi(0)).toBe('low')
        expect(dbVerbosityToUi(1)).toBe('medium')
        expect(dbVerbosityToUi(2)).toBe('high')
        expect(dbVerbosityToUi(undefined, { allowDefault: true })).toBe('default')
        expect(uiVerbosityToDb('high')).toBe(2)
        expect(dbVerbosityToApi(1)).toBe('medium')
    })

    test('sends reasoning effort exactly as selected without model-based correction', () => {
        expect(dbReasoningEffortToApi(-1)).toBe('none')
        expect(dbReasoningEffortToApi(0)).toBe('low')
        expect(dbReasoningEffortToApi(1)).toBe('medium')
        expect(dbReasoningEffortToApi(2)).toBe('high')
        expect(dbReasoningEffortToApi(3)).toBe('xhigh')
    })
})
