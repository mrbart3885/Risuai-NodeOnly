import { fetchNative } from 'src/ts/globalApi.svelte'
import { getDatabase } from 'src/ts/storage/database.svelte'
import type { OpenAIChat } from '../index.svelte'
import { applyParameters } from './shared'
import type { RequestDataArgumentExtended, StreamResponseChunk, requestDataResponse } from './request'

const OLLAMA_CLOUD_API = 'https://ollama.com/api'
const INVALID_OPTIONS_MESSAGE = 'Ollama Cloud options JSON is invalid.'

export type OllamaCloudThinkMode = 'auto' | 'off' | 'on' | 'low' | 'medium' | 'high' | 'max'

export type OllamaCloudModelInfo = {
    id: string
    name: string
    family: string
    parameterSize: string
    quantizationLevel: string
    capabilities: string[]
}

type OllamaCloudChatBody = {
    model: string
    messages: Pick<OpenAIChat, 'role' | 'content'>[]
    stream: boolean
    think?: boolean | 'low' | 'medium' | 'high' | 'max'
    reasoning_effort?: 'high' | 'max'
    thinking?: {
        type: 'enabled' | 'disabled'
    }
    options?: Record<string, any>
}

export function resolveOllamaThinkMode(mode: OllamaCloudThinkMode): boolean | 'low' | 'medium' | 'high' | 'max' | undefined {
    if (mode === 'auto') return undefined
    if (mode === 'off') return false
    if (mode === 'on') return true
    return mode
}

export function isDeepSeekV4OrR4Model(model: string): boolean {
    return /deepseek.*[vr]4|deepseek[-_:]?[vr]4/i.test(model)
}

export function normalizeOllamaThinkModeForModel(
    model: string,
    think: boolean | 'low' | 'medium' | 'high' | 'max' | undefined,
): boolean | 'low' | 'medium' | 'high' | 'max' | undefined {
    if (typeof think !== 'string') return think

    if (isDeepSeekV4OrR4Model(model)) {
        return true
    }

    if (/gpt-oss/i.test(model)) {
        if (think === 'max') return 'high'
        return think
    }

    return true
}

function getDeepSeekReasoningEffort(
    think: boolean | 'low' | 'medium' | 'high' | 'max' | undefined,
): 'high' | 'max' | undefined {
    if (think === false) return undefined
    if (think === 'max') return 'max'
    return 'high'
}

export function parseOllamaCloudOptionsJson(value: string | undefined | null): { ok: true, options: Record<string, any> } | { ok: false, error: string } {
    if (!value?.trim()) {
        return { ok: true, options: {} }
    }

    try {
        const parsed = JSON.parse(value)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return { ok: false, error: INVALID_OPTIONS_MESSAGE }
        }
        return { ok: true, options: parsed }
    } catch {
        return { ok: false, error: INVALID_OPTIONS_MESSAGE }
    }
}

function getOllamaCloudModel(arg: RequestDataArgumentExtended): string {
    const dbModel = getDatabase().ollamaCloudModel || ''
    if (arg.modelInfo?.id === 'ollama-cloud') {
        return dbModel
    }
    return arg.modelInfo?.internalID || dbModel
}

function getOllamaCloudOptions(arg: RequestDataArgumentExtended, baseOptions: Record<string, any>): Record<string, any> | undefined {
    const options = applyParameters(
        { ...baseOptions },
        arg.modelInfo?.parameters ?? [],
        {
            repetition_penalty: 'repeat_penalty',
        },
        arg.mode ?? 'model',
        {
            modelId: arg.aiModel ?? arg.modelInfo?.id ?? getOllamaCloudModel(arg),
            ignoreTopKIfZero: true,
        },
    )

    if (arg.maxTokens !== undefined && arg.maxTokens !== null) {
        options.num_predict = arg.maxTokens
    }

    return Object.keys(options).length > 0 ? options : undefined
}

function buildMessages(formated: OpenAIChat[]): Pick<OpenAIChat, 'role' | 'content'>[] {
    return formated
        .filter((message) => message.role === 'system' || message.role === 'user' || message.role === 'assistant')
        .map((message) => ({
            role: message.role,
            content: message.content,
        }))
}

export function buildOllamaCloudChatBody(arg: RequestDataArgumentExtended, options: Record<string, any>): OllamaCloudChatBody {
    const db = getDatabase()
    const model = getOllamaCloudModel(arg)
    const rawThink = resolveOllamaThinkMode((db.ollamaCloudThink ?? 'auto') as OllamaCloudThinkMode)
    const think = normalizeOllamaThinkModeForModel(
        model,
        rawThink,
    )
    const body: OllamaCloudChatBody = {
        model,
        messages: buildMessages(arg.formated),
        stream: !!arg.useStreaming,
    }

    if (think !== undefined) {
        body.think = think
    }

    if (isDeepSeekV4OrR4Model(model)) {
        delete body.think
        body.thinking = { type: rawThink === false ? 'disabled' : 'enabled' }
        const reasoningEffort = getDeepSeekReasoningEffort(rawThink)
        if (reasoningEffort) {
            body.reasoning_effort = reasoningEffort
        }
    }

    const requestOptions = getOllamaCloudOptions(arg, options)
    if (requestOptions) {
        body.options = requestOptions
    }

    return body
}

export async function fetchOllamaCloudModels(apiKey = getDatabase().ollamaCloudKey): Promise<{ models: OllamaCloudModelInfo[], error?: string }> {
    if (!apiKey) {
        return { models: [], error: 'Ollama Cloud API key is required.' }
    }

    try {
        const res = await fetchNative(`${OLLAMA_CLOUD_API}/tags`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                Accept: 'application/json',
            },
        })

        if (!res.ok) {
            return { models: [], error: `Failed to fetch Ollama Cloud models (HTTP ${res.status})` }
        }

        const data = await res.json()
        const models = await Promise.all((data.models ?? []).map(async (model: any): Promise<OllamaCloudModelInfo> => {
            const id = model.model ?? model.name ?? ''
            const details = model.details ?? {}
            let capabilities: string[] = Array.isArray(model.capabilities) ? model.capabilities : []

            try {
                const showRes = await fetchNative(`${OLLAMA_CLOUD_API}/show`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                    body: JSON.stringify({ model: id }),
                })
                if (showRes.ok) {
                    const showData = await showRes.json()
                    capabilities = Array.isArray(showData.capabilities) ? showData.capabilities : capabilities
                }
            } catch {
                // Capability enrichment is best-effort; tags still gives a usable model list.
            }

            return {
                id,
                name: model.name ?? id,
                family: details.family ?? model.family ?? '',
                parameterSize: details.parameter_size ?? model.parameterSize ?? '',
                quantizationLevel: details.quantization_level ?? model.quantizationLevel ?? '',
                capabilities,
            }
        }))

        return { models }
    } catch (e) {
        return { models: [], error: e?.message ?? 'Failed to fetch Ollama Cloud models' }
    }
}

async function readOllamaCloudError(res: Response): Promise<string> {
    try {
        const data = await res.json()
        return data?.error ?? data?.message ?? JSON.stringify(data)
    } catch {
        try {
            return await res.text()
        } catch {
            return `HTTP ${res.status}`
        }
    }
}

function mapOllamaCloudError(message: string): string {
    if (/think/i.test(message) && /\b(low|medium|high)\b/i.test(message)) {
        return 'This model may only support Think On/Off. Use On instead of Low/Medium/High.'
    }
    return message
}

async function streamOllamaCloudResponse(res: Response): Promise<ReadableStream<StreamResponseChunk>> {
    const decoder = new TextDecoder()
    const reader = res.body?.getReader()

    return new ReadableStream<StreamResponseChunk>({
        async start(controller) {
            if (!reader) {
                controller.close()
                return
            }

            let buffer = ''
            let thinkingText = ''
            let contentText = ''
            const currentText = (done = false) => {
                if (!thinkingText) return contentText
                const closeThinking = contentText || done
                return `<Thoughts>\n${thinkingText}${closeThinking ? '\n</Thoughts>\n\n' : ''}${contentText}`
            }
            const enqueueCurrent = (done = false) => {
                const text = currentText(done)
                if (text) {
                    controller.enqueue({ '0': text })
                }
            }
            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() ?? ''

                for (const line of lines) {
                    if (!line.trim()) continue
                    const chunk = JSON.parse(line)
                    thinkingText += chunk.message?.thinking ?? ''
                    contentText += chunk.message?.content ?? ''
                    enqueueCurrent(!!chunk.done)
                    if (chunk.done) {
                        controller.close()
                        return
                    }
                }
            }

            if (buffer.trim()) {
                const chunk = JSON.parse(buffer)
                thinkingText += chunk.message?.thinking ?? ''
                contentText += chunk.message?.content ?? ''
                enqueueCurrent(!!chunk.done)
            }
            controller.close()
        },
    })
}

export async function requestOllamaCloud(arg: RequestDataArgumentExtended): Promise<requestDataResponse> {
    const db = getDatabase()
    if (!db.ollamaCloudKey) {
        return { type: 'fail', result: 'Ollama Cloud API key is required.', noRetry: true }
    }

    const model = getOllamaCloudModel(arg)
    if (!model) {
        return { type: 'fail', result: 'Select an Ollama Cloud model first.', noRetry: true }
    }

    const parsedOptions = parseOllamaCloudOptionsJson(db.ollamaCloudOptionsJson)
    if ('error' in parsedOptions) {
        return { type: 'fail', result: parsedOptions.error, noRetry: true }
    }

    const body = buildOllamaCloudChatBody(arg, parsedOptions.options)

    if (arg.previewBody) {
        return {
            type: 'success',
            result: JSON.stringify(body, null, 2),
        }
    }

    try {
        const res = await fetchNative(`${OLLAMA_CLOUD_API}/chat`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${db.ollamaCloudKey}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify(body),
            signal: arg.abortSignal,
            chatId: arg.chatId,
            proxyPolicy: arg.proxyPolicy,
        })

        if (!res.ok) {
            return {
                type: 'fail',
                result: mapOllamaCloudError(await readOllamaCloudError(res)),
                failByServerError: res.status >= 500,
            }
        }

        if (body.stream) {
            return {
                type: 'streaming',
                result: await streamOllamaCloudResponse(res),
            }
        }

        const data = await res.json()
        const thinking = data?.message?.thinking
        const content = data?.message?.content ?? ''
        return {
            type: 'success',
            result: thinking ? `<Thoughts>\n${thinking}\n</Thoughts>\n\n${content}` : content,
        }
    } catch (e) {
        return {
            type: 'fail',
            result: `Ollama Cloud request failed: ${e?.message ?? 'Unknown error'}`,
            failByServerError: true,
        }
    }
}
