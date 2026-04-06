import { fetchNative } from "src/ts/globalApi.svelte"
import { getDatabase } from "src/ts/storage/database.svelte"
import type { RequestDataArgumentExtended, requestDataResponse } from './request'
import { requestOpenAI } from './openAI/requests'

// ── Constants ────────────────────────────────────────────────────────

const NANOGPT_API = 'https://nano-gpt.com/api/v1'

// ── Key Rotation ─────────────────────────────────────────────────────

let currentKeyIndex = 0

function getCurrentKey(): string {
    const db = getDatabase()
    const keys = db.nanogpt?.apiKeys ?? []
    if (keys.length === 0) {
        throw new Error('No NanoGPT API keys configured')
    }
    return keys[currentKeyIndex % keys.length]
}

function advanceKey(): void {
    const db = getDatabase()
    const keys = db.nanogpt?.apiKeys ?? []
    if (keys.length > 1) {
        currentKeyIndex = (currentKeyIndex + 1) % keys.length
    }
}

// ── Main Request Handler ─────────────────────────────────────────────

export async function requestNanoGPT(arg: RequestDataArgumentExtended): Promise<requestDataResponse> {
    const db = getDatabase()
    const nanogptConfig = db.nanogpt
    const keys = nanogptConfig?.apiKeys ?? []

    if (keys.length === 0) {
        return {
            type: 'fail',
            result: 'No NanoGPT API keys configured. Add keys in Settings → Model → NanoGPT.'
        }
    }

    const keyRotate = nanogptConfig?.keyRotate ?? 'sequential'
    const maxAttempts = keyRotate === 'on-error' ? Math.max(keys.length, 1) : 1

    const endpoint = `${NANOGPT_API}/chat/completions`

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const apiKey = getCurrentKey()
            if (keyRotate === 'sequential' && keys.length > 1) {
                advanceKey()
            }

            const nanogptArg: RequestDataArgumentExtended = {
                ...arg,
                customURL: endpoint,
                key: apiKey,
            }

            const result = await requestOpenAI(nanogptArg)

            const isAuthError = result.type === 'fail' && /unauthorized|forbidden|token|quota|rate.limit|401|403|429/i.test(result.result)
            if (isAuthError && keyRotate === 'on-error' && attempt < maxAttempts - 1) {
                advanceKey()
                continue
            }

            return result
        } catch (e) {
            const errMsg = e?.message ?? ''
            const isRetryable = /unauthorized|forbidden|token|quota|rate.limit|fetch|network|timeout|ECONNREFUSED/i.test(errMsg)
            if (isRetryable && keyRotate === 'on-error' && attempt < maxAttempts - 1) {
                advanceKey()
                continue
            }
            return {
                type: 'fail',
                result: `NanoGPT request failed: ${e?.message ?? 'Unknown error'}`
            }
        }
    }

    return {
        type: 'fail',
        result: 'All NanoGPT API keys exhausted'
    }
}

// ── Token Validation ─────────────────────────────────────────────────

export async function validateNanoGPTKey(apiKey: string): Promise<{valid: boolean, error?: string}> {
    try {
        const res = await fetchNative(`${NANOGPT_API}/models`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json',
            }
        })

        if (!res.ok) {
            return { valid: false, error: `HTTP ${res.status}` }
        }

        return { valid: true }
    } catch (e) {
        return { valid: false, error: e?.message ?? 'Unknown error' }
    }
}

// ── Dynamic Model Fetch ──────────────────────────────────────────────

export interface NanoGPTModelInfo {
    id: string
    name: string
    ownedBy: string
}

export async function fetchNanoGPTModels(apiKey: string): Promise<{models: NanoGPTModelInfo[], error?: string}> {
    try {
        const res = await fetchNative(`${NANOGPT_API}/models?detailed=true`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json',
            }
        })

        if (!res.ok) {
            return { models: [], error: `Failed to fetch models (HTTP ${res.status})` }
        }

        const data = await res.json()
        const models: NanoGPTModelInfo[] = (data.data ?? []).map((m: any) => ({
            id: m.id,
            name: m.name ?? m.id,
            ownedBy: m.owned_by ?? 'Unknown',
        }))

        return { models }
    } catch (e) {
        return { models: [], error: e?.message ?? 'Unknown error' }
    }
}

// ── Balance Check ────────────────────────────────────────────────────

export interface NanoGPTBalance {
    usdBalance: string
    nanoBalance: string
}

export async function fetchNanoGPTBalance(apiKey: string): Promise<{balance: NanoGPTBalance | null, error?: string}> {
    try {
        const res = await fetchNative('https://nano-gpt.com/api/check-balance', {
            method: 'POST',
            body: '{}',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json',
            }
        })

        if (!res.ok) {
            return { balance: null, error: `HTTP ${res.status}` }
        }

        const data = await res.json()
        return {
            balance: {
                usdBalance: data.usd_balance ?? '0',
                nanoBalance: data.nano_balance ?? '0',
            }
        }
    } catch (e) {
        return { balance: null, error: e?.message ?? 'Unknown error' }
    }
}

// ── Subscription Usage ───────────────────────────────────────────────

export interface NanoGPTUsageInfo {
    active: boolean
    state: string
    provider: string
    providerStatus: string
    providerStatusRaw: string
    allowOverage: boolean
    cancelAt: string | null
    cancelAtPeriodEnd: boolean
    graceUntil: string | null
    periodEnd: string | null
    weeklyInputTokens: NanoGPTUsageMetric | null
    dailyInputTokens: NanoGPTUsageMetric | null
    dailyImages: NanoGPTUsageMetric | null
}

export interface NanoGPTUsageMetric {
    limit: number | null
    used: number
    remaining: number | null
    percentUsed: number
    progress: number
    resetAt: number | null
}

function toFiniteNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : null
    }
    return null
}

function normalizeNanoGPTUsageMetric(limitValue: unknown, metricValue: any): NanoGPTUsageMetric | null {
    const limit = toFiniteNumber(limitValue)
    if (!metricValue && limit === null) return null

    const used = toFiniteNumber(metricValue?.used) ?? 0
    const remaining = metricValue?.remaining === null
        ? null
        : (toFiniteNumber(metricValue?.remaining) ?? (limit === null ? null : Math.max(limit - used, 0)))

    const rawPercentUsed = toFiniteNumber(metricValue?.percentUsed)
    const percentUsed = rawPercentUsed === null
        ? (limit && limit > 0 ? (used / limit) * 100 : 0)
        : (rawPercentUsed <= 1 ? rawPercentUsed * 100 : rawPercentUsed)

    return {
        limit,
        used,
        remaining,
        percentUsed,
        progress: Math.min(Math.max(percentUsed / 100, 0), 1),
        resetAt: toFiniteNumber(metricValue?.resetAt),
    }
}

export async function fetchNanoGPTUsage(apiKey: string): Promise<{usage: NanoGPTUsageInfo | null, error?: string}> {
    try {
        const res = await fetchNative('https://nano-gpt.com/api/subscription/v1/usage', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json',
            }
        })

        if (!res.ok) {
            return { usage: null, error: `HTTP ${res.status}` }
        }

        const data = await res.json()
        return {
            usage: {
                active: data.active ?? false,
                state: data.state ?? 'unknown',
                provider: data.provider ?? 'unknown',
                providerStatus: data.providerStatus ?? data.state ?? 'unknown',
                providerStatusRaw: data.providerStatusRaw ?? data.providerStatus ?? data.state ?? 'unknown',
                allowOverage: data.allowOverage ?? false,
                cancelAt: data.cancelAt ?? null,
                cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
                graceUntil: data.graceUntil ?? null,
                periodEnd: data.period?.currentPeriodEnd ?? null,
                weeklyInputTokens: normalizeNanoGPTUsageMetric(data.limits?.weeklyInputTokens, data.weeklyInputTokens),
                dailyInputTokens: normalizeNanoGPTUsageMetric(data.limits?.dailyInputTokens, data.dailyInputTokens),
                dailyImages: normalizeNanoGPTUsageMetric(data.limits?.dailyImages, data.dailyImages),
            }
        }
    } catch (e) {
        return { usage: null, error: e?.message ?? 'Unknown error' }
    }
}
