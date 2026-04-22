export type ReasoningEffortUiValue = 'default' | 'none' | 'low' | 'medium' | 'high' | 'xhigh'
export type VerbosityUiValue = 'default' | 'low' | 'medium' | 'high'
export type ReasoningEffortApiValue = 'low' | 'medium' | 'high' | 'xhigh'

export const reasoningEffortSelectOptions = [
    { value: 'none', label: 'None' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'xhigh', label: 'XHigh' },
] as const

export const reasoningEffortSelectOptionsWithDefault = [
    { value: 'default', label: 'Global' },
    ...reasoningEffortSelectOptions,
] as const

export const verbositySelectOptions = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
] as const

export const verbositySelectOptionsWithDefault = [
    { value: 'default', label: 'Global' },
    ...verbositySelectOptions,
] as const

export function dbReasoningEffortToUi(
    value: number | null | undefined,
    arg: { allowDefault?: boolean } = {},
): ReasoningEffortUiValue {
    if (arg.allowDefault && (value === undefined || value === null || value === -1000)) {
        return 'default'
    }

    switch (value) {
        case 3:
            return 'xhigh'
        case 2:
            return 'high'
        case 1:
            return 'medium'
        case 0:
            return 'low'
        case -1:
            return 'none'
        default:
            return 'low'
    }
}

export function uiReasoningEffortToDb(value: ReasoningEffortUiValue): number {
    switch (value) {
        case 'default':
            return -1000
        case 'none':
            return -1
        case 'low':
            return 0
        case 'medium':
            return 1
        case 'high':
            return 2
        case 'xhigh':
            return 3
    }
}

// Returns undefined for 'none' so the request builder omits the field entirely —
// some Copilot models (e.g. gpt-5.4) reject `reasoning_effort: "none"` outright.
// Mirrors Cupcake plugin's "Off" behavior (parameter not sent).
export function dbReasoningEffortToApi(
    value: number | null | undefined,
): ReasoningEffortApiValue | undefined {
    switch (dbReasoningEffortToUi(value)) {
        case 'none':
            return undefined
        case 'medium':
            return 'medium'
        case 'high':
            return 'high'
        case 'xhigh':
            return 'xhigh'
        case 'default':
        case 'low':
        default:
            return 'low'
    }
}

export function dbVerbosityToUi(
    value: number | null | undefined,
    arg: { allowDefault?: boolean } = {},
): VerbosityUiValue {
    if (arg.allowDefault && (value === undefined || value === null || value === -1000)) {
        return 'default'
    }

    switch (value) {
        case 2:
            return 'high'
        case 1:
            return 'medium'
        case 0:
        default:
            return 'low'
    }
}

export function uiVerbosityToDb(value: VerbosityUiValue): number {
    switch (value) {
        case 'default':
            return -1000
        case 'high':
            return 2
        case 'medium':
            return 1
        case 'low':
        default:
            return 0
    }
}

export function dbVerbosityToApi(value: number | null | undefined): 'low' | 'medium' | 'high' {
    switch (dbVerbosityToUi(value)) {
        case 'high':
            return 'high'
        case 'medium':
            return 'medium'
        case 'default':
        case 'low':
        default:
            return 'low'
    }
}
