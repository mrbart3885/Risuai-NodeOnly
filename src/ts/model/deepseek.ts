import { dbReasoningEffortToUi } from './reasoningVerbosity'

export function isDeepSeekV4ModelId(model: string | null | undefined): boolean {
    return model === 'deepseek-v4-flash' || model === 'deepseek-v4-pro'
}

export function getDeepSeekV4ThinkingParams(
    value: number | null | undefined,
): { thinking: { type: 'enabled' | 'disabled' }, reasoning_effort?: 'high' | 'max' } | undefined {
    if (value === undefined || value === null || value === -1000) {
        return undefined
    }

    const effort = dbReasoningEffortToUi(value)
    if (effort === 'none') {
        return {
            thinking: { type: 'disabled' },
        }
    }

    return {
        thinking: { type: 'enabled' },
        reasoning_effort: effort === 'xhigh' ? 'max' : 'high',
    }
}
