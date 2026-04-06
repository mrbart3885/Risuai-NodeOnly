import { describe, expect, test } from 'vitest'
import { modelSpecificParameterItems } from './botSettingsParamsData'

describe('botSettingsParamsData reasoning/verbosity controls', () => {
    test('uses segmented button controls for reasoning effort and verbosity', () => {
        const reasoningEffort = modelSpecificParameterItems.find(
            (item) => item.id === 'params.reasoningEffort',
        )
        const verbosity = modelSpecificParameterItems.find(
            (item) => item.id === 'params.verbosity',
        )

        expect(reasoningEffort?.type).toBe('segmented')
        expect(reasoningEffort?.options?.segmentOptions?.map((option) => option.value)).toEqual([
            'none',
            'low',
            'medium',
            'high',
            'xhigh',
        ])
        expect(reasoningEffort?.options?.segmentWrap).toBe(true)
        expect(reasoningEffort?.options?.segmentFullWidth).toBe(true)

        expect(verbosity?.type).toBe('segmented')
        expect(verbosity?.options?.segmentOptions?.map((option) => option.value)).toEqual([
            'low',
            'medium',
            'high',
        ])
        expect(verbosity?.options?.segmentFullWidth).toBe(true)
    })
})
