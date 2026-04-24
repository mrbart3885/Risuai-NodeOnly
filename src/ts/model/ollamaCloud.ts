import { LLMFlags, LLMFormat, LLMProvider, LLMTokenizer, type LLMModel } from './types'
import type { ModelGridItem } from './modelGrid'

export type OllamaCloudModelInfo = {
    id: string
    name: string
    family: string
    parameterSize: string
    quantizationLevel: string
    capabilities: string[]
}

export function getOllamaCloudTokenizer(family: string, id: string): LLMTokenizer {
    const modelLabel = `${family} ${id}`.toLowerCase()
    return modelLabel.includes('llama') ? LLMTokenizer.Llama : LLMTokenizer.Unknown
}

export function toOllamaCloudDynamicModel(model: OllamaCloudModelInfo): LLMModel {
    const flags: LLMFlags[] = [LLMFlags.hasFullSystemPrompt, LLMFlags.hasStreaming]

    return {
        id: `dynamic_ollama_cloud_${model.id}`,
        name: model.name,
        shortName: `Ollama Cloud ${model.name}`,
        fullName: `Ollama Cloud ${model.name}`,
        internalID: model.id,
        provider: LLMProvider.OllamaCloud,
        format: LLMFormat.Ollama,
        flags,
        parameters: ['temperature', 'top_p', 'top_k', 'repetition_penalty'],
        tokenizer: getOllamaCloudTokenizer(model.family, model.id),
    }
}

export async function getOllamaCloudModels(apiKey?: string): Promise<OllamaCloudModelInfo[]> {
    const { fetchOllamaCloudModels } = await import('../process/request/ollamaCloud')
    const { models } = await fetchOllamaCloudModels(apiKey)
    return models
}

export function toModelGridItem(model: OllamaCloudModelInfo): ModelGridItem {
    const details = [
        model.parameterSize,
        model.quantizationLevel,
        model.capabilities.length ? model.capabilities.join(', ') : '',
    ].filter(Boolean)

    return {
        id: model.id,
        displayName: model.name,
        providerName: model.family || 'Ollama',
        description: details.join(' · '),
        context_length: 0,
        sortPrice: Infinity,
        prices: [],
    }
}
