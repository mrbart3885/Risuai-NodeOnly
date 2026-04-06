import { fetchNative } from "src/ts/globalApi.svelte"
import { LLMFormat } from "src/ts/model/modellist"
import { getDatabase } from "src/ts/storage/database.svelte"
import { v4 } from "uuid"
import type { RequestDataArgumentExtended, requestDataResponse } from './request'
import { requestClaude } from './anthropic'
import { requestOpenAI, requestOpenAIResponseAPI } from './openAI/requests'

// ── Constants ────────────────────────────────────────────────────────

const COPILOT_API = 'https://api.individual.githubcopilot.com'
const GITHUB_API = 'https://api.github.com'
const DEFAULT_VS_CODE_VERSION = '1.111.0'
const DEFAULT_CHAT_VERSION = '0.39.2'
const COPILOT_PROXY_POLICY = 'always' as const

function getVersions(): { vsCode: string, chat: string } {
    const db = getDatabase()
    return {
        vsCode: db.copilot?.vsCodeVersion || DEFAULT_VS_CODE_VERSION,
        chat: db.copilot?.chatVersion || DEFAULT_CHAT_VERSION,
    }
}

function getUserAgent(): string {
    const { vsCode } = getVersions()
    return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Code/${vsCode} Chrome/142.0.7444.265 Electron/39.6.0 Safari/537.36`
}

// ── Token Cache ──────────────────────────────────────────────────────

interface TidToken {
    token: string
    expiresAt: number
}

const tidCache = new Map<string, TidToken>()

async function getTidToken(githubToken: string): Promise<string> {
    const cached = tidCache.get(githubToken)
    if (cached && cached.expiresAt - Date.now() > 60_000) {
        return cached.token
    }

    const res = await fetchNative(`${GITHUB_API}/copilot_internal/v2/token`, {
        method: 'GET',
        headers: {
            'Authorization': `token ${githubToken}`,
            'User-Agent': getUserAgent(),
            'Accept': 'application/json',
        },
        proxyPolicy: COPILOT_PROXY_POLICY,
    })

    // Fix #1: single text() call, sanitized error message
    if (!res.ok) {
        const status = res.status
        throw new Error(`Copilot token request failed (HTTP ${status}). Check your GitHub token.`)
    }

    const data = await res.json()
    const tid: TidToken = {
        token: data.token,
        expiresAt: data.expires_at * 1000
    }
    tidCache.set(githubToken, tid)
    return tid.token
}

// ── Machine ID (persisted to DB) ─────────────────────────────────────

let cachedMachineId: string | null = null

function getMachineId(): string {
    if (cachedMachineId) return cachedMachineId
    const db = getDatabase()
    if (db.copilot?.machineId) {
        cachedMachineId = db.copilot.machineId
        return cachedMachineId
    }
    // Fix #5: persist generated ID back to DB
    cachedMachineId = v4()
    if (db.copilot) {
        db.copilot.machineId = cachedMachineId
    }
    return cachedMachineId
}

// ── Session ID (persisted per page session) ──────────────────────────

let cachedSessionId: string | null = null

// Fix #6: reuse session ID across requests (like real VSCode)
function getSessionId(): string {
    if (!cachedSessionId) cachedSessionId = v4()
    return cachedSessionId
}

// ── Header Builder ───────────────────────────────────────────────────

function buildHeaders(tidToken: string): Record<string, string> {
    const requestId = v4()
    return {
        'Authorization': `Bearer ${tidToken}`,
        'Content-Type': 'application/json',
        'Copilot-Integration-Id': 'vscode-chat',
        'Editor-Version': `vscode/${getVersions().vsCode}`,
        'Editor-plugin-version': `copilot-chat/${getVersions().chat}`,
        'User-Agent': getUserAgent(),
        'Vscode-Machineid': getMachineId(),
        'Editor-Device-Id': getMachineId(),
        'Vscode-Sessionid': getSessionId(),
        'X-Request-Id': requestId,
        'X-Agent-Task-Id': requestId,
        'X-Interaction-Id': v4(),
        'X-Interaction-Type': 'conversation-panel',
        'Openai-Intent': 'conversation-agent',
        'X-Initiator': 'user',
        'X-Github-Api-Version': '2025-10-01',
        'X-Vscode-User-Agent-Library-Version': 'electron-fetch',
    }
}

// ── Key Rotation ─────────────────────────────────────────────────────

let currentKeyIndex = 0

function getCurrentToken(): string {
    const db = getDatabase()
    const tokens = db.copilot?.githubTokens ?? []
    if (tokens.length === 0) {
        throw new Error('No GitHub Copilot tokens configured')
    }
    return tokens[currentKeyIndex % tokens.length]
}

function advanceKey(): void {
    const db = getDatabase()
    const tokens = db.copilot?.githubTokens ?? []
    if (tokens.length > 1) {
        currentKeyIndex = (currentKeyIndex + 1) % tokens.length
    }
}

// ── Endpoint Selection ───────────────────────────────────────────────

function getEndpoint(format: LLMFormat): string {
    switch (format) {
        case LLMFormat.Anthropic:
            return `${COPILOT_API}/v1/messages`
        case LLMFormat.OpenAIResponseAPI:
            return `${COPILOT_API}/responses`
        case LLMFormat.OpenAICompatible:
        default:
            return `${COPILOT_API}/chat/completions`
    }
}

// ── Main Request Handler ─────────────────────────────────────────────

export async function requestCopilot(arg: RequestDataArgumentExtended): Promise<requestDataResponse> {
    const db = getDatabase()
    const copilotConfig = db.copilot
    const keyRotate = copilotConfig?.keyRotate ?? 'sequential'
    const tokens = copilotConfig?.githubTokens ?? []

    if (tokens.length === 0) {
        return {
            type: 'fail',
            result: 'No GitHub Copilot tokens configured. Add tokens in Settings → Model → GitHub Copilot.'
        }
    }

    const maxAttempts = keyRotate === 'on-error' ? Math.max(tokens.length, 1) : 1

    const format = arg.modelInfo.format
    const endpoint = getEndpoint(format)

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // Fix #4: declare githubToken outside try so catch can access it
        let githubToken: string | undefined
        try {
            githubToken = getCurrentToken()
            if (keyRotate === 'sequential' && tokens.length > 1) {
                advanceKey()
            }
            const tidToken = await getTidToken(githubToken)
            const copilotHeaders = buildHeaders(tidToken)

            const copilotArg: RequestDataArgumentExtended = {
                ...arg,
                customURL: endpoint,
                key: tidToken,
                extraHeaders: copilotHeaders,
                proxyPolicy: COPILOT_PROXY_POLICY,
            }

            let result: requestDataResponse

            switch (format) {
                case LLMFormat.Anthropic:
                    result = await requestClaude(copilotArg)
                    break
                case LLMFormat.OpenAIResponseAPI:
                    result = await requestOpenAIResponseAPI(copilotArg)
                    break
                case LLMFormat.OpenAICompatible:
                default:
                    result = await requestOpenAI(copilotArg)
                    break
            }

            // Only rotate on auth/quota errors, not on bad payloads or model errors
            const isAuthError = result.type === 'fail' && /unauthorized|forbidden|token|quota|rate.limit|401|403|429/i.test(result.result)
            if (isAuthError && keyRotate === 'on-error' && attempt < maxAttempts - 1) {
                advanceKey()
                tidCache.delete(githubToken)
                continue
            }

            return result
        } catch (e) {
            const errMsg = e?.message ?? ''
            const isRetryable = /unauthorized|forbidden|token|quota|rate.limit|fetch|network|timeout|ECONNREFUSED/i.test(errMsg)
            if (githubToken && isRetryable) tidCache.delete(githubToken)
            if (isRetryable && keyRotate === 'on-error' && attempt < maxAttempts - 1) {
                advanceKey()
                continue
            }
            return {
                type: 'fail',
                result: `Copilot request failed: ${e?.message ?? 'Unknown error'}`
            }
        }
    }

    return {
        type: 'fail',
        result: 'All Copilot tokens exhausted'
    }
}

// ── Token Validation ─────────────────────────────────────────────────

export async function validateCopilotToken(githubToken: string): Promise<{valid: boolean, error?: string}> {
    try {
        await getTidToken(githubToken)
        return { valid: true }
    } catch (e) {
        return { valid: false, error: e?.message ?? 'Unknown error' }
    }
}

// ── Dynamic Model Fetch ──────────────────────────────────────────────

export interface CopilotModelInfo {
    id: string
    name: string
    vendor: string
    maxContextTokens: number
    maxOutputTokens: number
    supportsVision: boolean
    supportsThinking: boolean
    supportedEndpoints: string[]
}

export async function fetchCopilotModels(githubToken: string): Promise<{models: CopilotModelInfo[], error?: string}> {
    try {
        const tidToken = await getTidToken(githubToken)
        const headers = buildHeaders(tidToken)

        const res = await fetchNative(`${COPILOT_API}/models`, {
            method: 'GET',
            headers,
            proxyPolicy: COPILOT_PROXY_POLICY,
        })

        if (!res.ok) {
            return { models: [], error: `Failed to fetch models (HTTP ${res.status})` }
        }

        const data = await res.json()
        const models: CopilotModelInfo[] = (data.data ?? [])
            .filter((m: any) => m.capabilities?.type === 'chat')
            .map((m: any) => ({
                id: m.id,
                name: m.name ?? m.id,
                vendor: m.vendor ?? 'Unknown',
                maxContextTokens: m.capabilities?.limits?.max_context_window_tokens ?? 0,
                maxOutputTokens: m.capabilities?.limits?.max_output_tokens ?? 0,
                supportsVision: !!m.capabilities?.supports?.vision,
                supportsThinking: !!m.capabilities?.supports?.adaptive_thinking,
                supportedEndpoints: m.supported_endpoints ?? [],
            }))

        return { models }
    } catch (e) {
        return { models: [], error: e?.message ?? 'Unknown error' }
    }
}

// ── Quota / Usage Check ──────────────────────────────────────────────

export interface CopilotQuotaSnapshot {
    quotaId: string
    entitlement: number
    remaining: number
    percentRemaining: number
    unlimited: boolean
}

export interface CopilotUsageInfo {
    planType: string
    login: string
    quotaResetDate: string
    quotas: CopilotQuotaSnapshot[]
}

export async function fetchCopilotUsage(githubToken: string): Promise<{usage: CopilotUsageInfo | null, error?: string}> {
    try {
        const res = await fetchNative(`${GITHUB_API}/copilot_internal/user`, {
            method: 'GET',
            headers: {
                'Authorization': `token ${githubToken}`,
                'User-Agent': getUserAgent(),
                'Accept': 'application/json',
            },
            proxyPolicy: COPILOT_PROXY_POLICY,
        })

        if (!res.ok) {
            return { usage: null, error: `Failed to fetch usage (HTTP ${res.status})` }
        }

        const data = await res.json()
        const snapshots = data.quota_snapshots ?? {}

        const quotas: CopilotQuotaSnapshot[] = Object.values(snapshots).map((s: any) => ({
            quotaId: s.quota_id ?? 'unknown',
            entitlement: s.entitlement ?? 0,
            remaining: s.remaining ?? 0,
            percentRemaining: s.percent_remaining ?? 100,
            unlimited: !!s.unlimited,
        }))

        const usage: CopilotUsageInfo = {
            planType: data.copilot_plan ?? 'unknown',
            login: data.login ?? '',
            quotaResetDate: data.quota_reset_date ?? '',
            quotas,
        }

        return { usage }
    } catch (e) {
        return { usage: null, error: e?.message ?? 'Unknown error' }
    }
}
