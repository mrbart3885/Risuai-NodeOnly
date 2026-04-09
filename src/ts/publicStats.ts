import { writable } from "svelte/store"

export interface PublicStats {
    dau: number
    yesterdayDau: number
    visits: number
    timezone: string
}

export const publicStatsStore = writable<PublicStats | null>(null)

export async function fetchPublicStats(): Promise<void> {
    try {
        const res = await fetch('/api/public-stats')
        if (!res.ok) return
        const data: PublicStats = await res.json()
        publicStatsStore.set(data)
    } catch {
        // silently ignore
    }
}
