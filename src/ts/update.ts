import { writable, get } from "svelte/store"
import { forageStorage } from "./globalApi.svelte"

export interface UpdateInfo {
    currentVersion: string
    latestVersion: string
    hasUpdate: boolean
    severity: 'none' | 'optional' | 'required' | 'outdated'
    releaseUrl: string
    releaseName: string
    publishedAt: string
    popupMessage?: string
    disabled?: boolean
    deploymentType?: 'portable' | 'git' | 'docker'
    canSelfUpdate?: boolean
    manualOnly?: boolean
}

export interface SelfUpdateProgress {
    step: 'checking' | 'downloading' | 'extracting' | 'replacing' | 'restarting' | 'done' | 'error' | 'reconnecting'
    progress: number | null
    message: string
}

/** Reactive store for update info — used by home screen and popup */
export const updateInfoStore = writable<UpdateInfo | null>(null)

/** Independent store for the update popup — does not collide with alertStore */
export const updatePopupStore = writable<UpdateInfo | null>(null)

/** Self-update progress — non-null while an update is running */
export const selfUpdateProgressStore = writable<SelfUpdateProgress | null>(null)

export async function checkRisuUpdate(): Promise<UpdateInfo | null> {
    try {
        const res = await fetch('/api/update-check')
        if (!res.ok) return null
        const data: UpdateInfo = await res.json()
        updateInfoStore.set(data)

        if (data.hasUpdate) {
            showUpdatePopupOnce(data)
        }

        return data
    } catch {
        return null
    }
}

const DISMISSED_KEY = 'risuNodeOnly_dismissedUpdateVersion'

function showUpdatePopupOnce(info: UpdateInfo) {
    const dismissed = localStorage.getItem(DISMISSED_KEY)
    if (dismissed === info.latestVersion) return

    localStorage.setItem(DISMISSED_KEY, info.latestVersion)
    updatePopupStore.set(info)
}

export function dismissUpdatePopup() {
    updatePopupStore.set(null)
}

/** Execute self-update (portable only). Streams NDJSON progress, then waits for server restart. */
export async function executeSelfUpdate(): Promise<void> {
    const set = (p: SelfUpdateProgress) => selfUpdateProgressStore.set(p)
    set({ step: 'checking', progress: 0, message: 'Starting update...' })

    try {
        const auth = await forageStorage.createAuth()
        const res = await fetch('/api/self-update', {
            method: 'POST',
            headers: { 'risu-auth': auth },
        })

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Unknown error' }))
            throw new Error(err.error || `HTTP ${res.status}`)
        }

        // Read NDJSON stream
        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let buf = ''

        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buf += decoder.decode(value, { stream: true })
            const lines = buf.split('\n')
            buf = lines.pop()! // keep incomplete line in buffer
            for (const line of lines) {
                if (!line) continue
                try {
                    const progress: SelfUpdateProgress = JSON.parse(line)
                    set(progress)
                    if (progress.step === 'error') throw new Error(progress.message)
                } catch (e) {
                    if (e instanceof SyntaxError) continue
                    throw e
                }
            }
        }

        // Server is restarting — poll until the new version is actually running
        set({ step: 'reconnecting', progress: null, message: 'Waiting for server to restart...' })
        const expectedVersion = get(updateInfoStore)?.latestVersion ?? ''
        await waitForServerRestart(expectedVersion)

        set({ step: 'done', progress: 100, message: 'Update complete!' })
    } catch (e: any) {
        set({ step: 'error', progress: null, message: e.message || 'Update failed' })
    }
}

async function waitForServerRestart(expectedVersion: string, timeoutMs = 60000): Promise<void> {
    const start = Date.now()
    // Give the server a moment to shut down before polling
    await new Promise(r => setTimeout(r, 3000))

    while (Date.now() - start < timeoutMs) {
        try {
            const res = await fetch('/api/update-check')
            if (res.ok) {
                const data: UpdateInfo = await res.json()
                // Verify the new server is actually running the updated version,
                // not the old process still alive after a failed restart
                if (data.currentVersion === expectedVersion) return
            }
        } catch { /* server not yet up */ }
        await new Promise(r => setTimeout(r, 2000))
    }
    throw new Error('Server did not restart within timeout')
}
