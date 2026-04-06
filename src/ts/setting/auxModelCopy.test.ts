import { describe, expect, test } from 'vitest'
import {
    AUX_PARAMETER_HINT,
    AUX_PARAMETER_SECTION_LABEL,
    AUX_REQUESTS_MODEL_LABEL,
    SUBMODEL_PARAMETER_LOCATION_HINT,
    getSeparateParameterSectionTitle,
} from './auxModelCopy'

describe('aux model UI copy', () => {
    test('uses user-facing labels instead of internal otherAx wording', () => {
        const fakeLanguage = {
            longTermMemory: 'Long-term Memory',
            emotionImage: 'Emotion',
            translator: 'Translator',
        }

        expect(getSeparateParameterSectionTitle('memory', fakeLanguage)).toBe('Long-term Memory')
        expect(getSeparateParameterSectionTitle('translate', fakeLanguage)).toBe('Translator')
        expect(getSeparateParameterSectionTitle('otherAx', fakeLanguage)).toBe(
            AUX_PARAMETER_SECTION_LABEL,
        )
        expect(AUX_REQUESTS_MODEL_LABEL).toBe('Aux Requests')
        expect(AUX_PARAMETER_HINT).toContain('submodel')
        expect(SUBMODEL_PARAMETER_LOCATION_HINT).toContain('Submodel / Modules')
    })
})
