import { getDatabase } from 'src/ts/storage/database.svelte'
import {
    dbReasoningEffortToApi,
    dbVerbosityToApi,
} from 'src/ts/model/reasoningVerbosity'

export type LLMParameter =
    | 'temperature'
    | 'top_k'
    | 'repetition_penalty'
    | 'min_p'
    | 'top_a'
    | 'top_p'
    | 'frequency_penalty'
    | 'presence_penalty'
    | 'reasoning_effort'
    | 'thinking_tokens'
    | 'verbosity'

export type ModelModeExtended = 'model' | 'submodel' | 'memory' | 'emotion' | 'otherAx' | 'translate'

export function setObjectValue<T>(obj: T, key: string, value: any): T {
    const splitKey = key.split('.')
    if (splitKey.length > 1) {
        const firstKey = splitKey.shift()
        if (!obj[firstKey]) {
            obj[firstKey] = {}
        }
        obj[firstKey] = setObjectValue(obj[firstKey], splitKey.join('.'), value)
        return obj
    }

    obj[key] = value
    return obj
}

export function applyParameters(
    data: Record<string, any>,
    parameters: LLMParameter[],
    rename: Partial<Record<LLMParameter, string>>,
    modelMode: ModelModeExtended,
    arg: {
        ignoreTopKIfZero?: boolean
        modelId:string
    },
): Record<string, any> {
    const db = getDatabase()

    if (db.seperateParametersEnabled && (modelMode !== 'model' || db.seperateParametersByModel)) {
        let sepParams = db.seperateParameters[modelMode]
        if (db.seperateParametersByModel){
            sepParams = db.seperateParameters.overrides[arg.modelId]

            if(!sepParams){
                throw new Error(`No seperate parameters found for model ${arg.modelId} in model mode ${modelMode}. Please set parameters for this model`)
            }
        }
        if (modelMode === 'submodel') {
            sepParams = db.seperateParameters['otherAx']
        }

        for (const parameter of parameters) {
            const rawValue = sepParams[parameter]
            if (
                rawValue === -1000 ||
                rawValue === undefined ||
                rawValue === null ||
                (typeof rawValue === 'number' && isNaN(rawValue))
            ) {
                continue
            }

            let value: number | string = 0
            if (parameter === 'top_k' && arg.ignoreTopKIfZero && sepParams[parameter] === 0) {
                continue
            }

            switch (parameter) {
                case 'temperature': {
                    value =
                        sepParams.temperature === -1000
                            ? -1000
                            : sepParams.temperature / 100
                    break
                }
                case 'top_k': {
                    value = sepParams.top_k
                    break
                }
                case 'repetition_penalty': {
                    value = sepParams.repetition_penalty
                    break
                }
                case 'min_p': {
                    value = sepParams.min_p
                    break
                }
                case 'top_a': {
                    value = sepParams.top_a
                    break
                }
                case 'top_p': {
                    value = sepParams.top_p
                    break
                }
                case 'thinking_tokens': {
                    value = sepParams.thinking_tokens
                    break
                }
                case 'frequency_penalty': {
                    value =
                        sepParams.frequency_penalty === -1000
                            ? -1000
                            : sepParams.frequency_penalty / 100
                    break
                }
                case 'presence_penalty': {
                    value =
                        sepParams.presence_penalty === -1000
                            ? -1000
                            : sepParams.presence_penalty / 100
                    break
                }
                case 'reasoning_effort': {
                    value = dbReasoningEffortToApi(sepParams.reasoning_effort)
                    break
                }
                case 'verbosity': {
                    value = dbVerbosityToApi(sepParams.verbosity)
                    break
                }
            }

            if (
                value === -1000 ||
                value === undefined ||
                value === null ||
                (typeof value === 'number' && isNaN(value))
            ) {
                continue
            }

            data = setObjectValue(data, rename[parameter] ?? parameter, value)
        }
        return data
    }

    for (const parameter of parameters) {
        let value: number | string = 0
        if (parameter === 'top_k' && arg.ignoreTopKIfZero && db.top_k === 0) {
            continue
        }
        switch (parameter) {
            case 'temperature': {
                value = db.temperature === -1000 ? -1000 : db.temperature / 100
                break
            }
            case 'top_k': {
                value = db.top_k
                break
            }
            case 'repetition_penalty': {
                value = db.repetition_penalty
                break
            }
            case 'min_p': {
                value = db.min_p
                break
            }
            case 'top_a': {
                value = db.top_a
                break
            }
            case 'top_p': {
                value = db.top_p
                break
            }
            case 'reasoning_effort': {
                value = dbReasoningEffortToApi(db.reasoningEffort)
                break
            }
            case 'verbosity': {
                value = dbVerbosityToApi(db.verbosity)
                break
            }
            case 'frequency_penalty': {
                value = db.frequencyPenalty === -1000 ? -1000 : db.frequencyPenalty / 100
                break
            }
            case 'presence_penalty': {
                value = db.PresensePenalty === -1000 ? -1000 : db.PresensePenalty / 100
                break
            }
            case 'thinking_tokens': {
                value = db.thinkingTokens
                break
            }
        }

        if (value === -1000) {
            continue
        }

        data = setObjectValue(data, rename[parameter] ?? parameter, value)
    }
    return data
}
