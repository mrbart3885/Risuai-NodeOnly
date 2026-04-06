export const AUX_REQUESTS_MODEL_LABEL = 'Aux Requests'
export const AUX_PARAMETER_SECTION_LABEL = 'Submodel / Modules'
export const AUX_PARAMETER_HINT =
    'Shared parameters for submodel, module axLLM, and other auxiliary requests.'
export const SUBMODEL_PARAMETER_LOCATION_HINT =
    'Shared aux parameters live in Parameters > Separate Parameters > Submodel / Modules.'

export function getSeparateParameterSectionTitle(
    param: string,
    languageLike: Record<string, unknown>,
): string {
    switch (param) {
        case 'memory':
            return typeof languageLike.longTermMemory === 'string'
                ? languageLike.longTermMemory
                : 'Memory'
        case 'emotion':
            return typeof languageLike.emotionImage === 'string'
                ? languageLike.emotionImage
                : 'Emotion'
        case 'translate':
            return typeof languageLike.translator === 'string'
                ? languageLike.translator
                : 'Translations'
        case 'otherAx':
            return AUX_PARAMETER_SECTION_LABEL
        default:
            return param
    }
}
