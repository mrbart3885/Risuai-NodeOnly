<script lang="ts">
    import SettingPage from 'src/lib/UI/GUI/SettingPage.svelte'
    import ShButton from 'src/lib/UI/GUI/ShButton.svelte'
    import ShInput from 'src/lib/UI/GUI/ShInput.svelte'
    import ShBadge from 'src/lib/UI/GUI/ShBadge.svelte'
    import SegmentedControl from 'src/lib/UI/GUI/SegmentedControl.svelte'
    import { Collapsible, Tooltip } from 'bits-ui'
    import {
        RefreshCwIcon,
        CopyIcon,
        Trash2Icon,
        ChevronDownIcon,
        CircleXIcon,
        TriangleAlertIcon,
        InfoIcon,
        MonitorIcon,
        SmartphoneIcon,
        ServerIcon,
        ScrollTextIcon,
    } from '@lucide/svelte'
    import { alertConfirm, notifyError, notifySuccess } from 'src/ts/alert'
    import { forageStorage } from 'src/ts/globalApi.svelte'
    import { language } from 'src/lang'

    type LogLevel = 'error' | 'warning' | 'info'
    type LogOrigin = 'client' | 'server'

    interface LogEntry {
        id: number
        timestamp: number
        level: LogLevel
        origin: LogOrigin
        message: string
        description?: string
        source?: string
        count: number
        platform?: string
        clientId?: string
        userAgent?: string
    }

    const PAGE_SIZE = 200

    let entries = $state<LogEntry[]>([])
    let totalCount = $state(0)
    let loading = $state(false)
    let loadingMore = $state(false)
    let hasMore = $state(false)
    let loadError = $state<string | null>(null)

    let levelFilter = $state<'all' | LogLevel>('all')
    let originFilter = $state<'all' | LogOrigin>('all')
    let search = $state('')

    let expanded = $state<Record<number, boolean>>({})

    // ─── Fetch ──────────────────────────────────────────────────────────────
    async function loadInitial() {
        loading = true
        loadError = null
        try {
            const data = await fetchLogs({ limit: PAGE_SIZE })
            entries = data.rows
            totalCount = data.total
            hasMore = data.rows.length >= PAGE_SIZE && data.rows.length < data.total
            expanded = {}
        } catch (err) {
            loadError = err instanceof Error ? err.message : String(err)
        } finally {
            loading = false
        }
    }

    async function loadMore() {
        if (loadingMore || !hasMore || entries.length === 0) return
        loadingMore = true
        try {
            const oldestTs = entries[entries.length - 1].timestamp
            const data = await fetchLogs({ limit: PAGE_SIZE, before: oldestTs })
            // Filter by id to avoid duplicates if timestamps collide.
            const existing = new Set(entries.map(e => e.id))
            const fresh = data.rows.filter(r => !existing.has(r.id))
            entries = [...entries, ...fresh]
            totalCount = data.total
            hasMore = fresh.length >= PAGE_SIZE && entries.length < data.total
        } catch (err) {
            loadError = err instanceof Error ? err.message : String(err)
        } finally {
            loadingMore = false
        }
    }

    async function fetchLogs(opts: { limit?: number; before?: number } = {}) {
        const auth = await forageStorage.createAuth()
        const params = new URLSearchParams()
        if (opts.limit) params.set('limit', String(opts.limit))
        if (opts.before) params.set('before', String(opts.before))
        const res = await fetch(`/api/logs?${params.toString()}`, {
            headers: { 'risu-auth': auth },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        return { rows: (json.content ?? []) as LogEntry[], total: json.total ?? 0 }
    }

    async function handleClearAll() {
        const ok = await alertConfirm(language.systemLogsClearConfirm)
        if (!ok) return
        try {
            const auth = await forageStorage.createAuth()
            const res = await fetch('/api/logs', {
                method: 'DELETE',
                headers: { 'risu-auth': auth },
            })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            entries = []
            totalCount = 0
            hasMore = false
            expanded = {}
        } catch (err) {
            notifyError(language.systemLogsFailedLoad, {
                description: err instanceof Error ? err.message : String(err),
                source: 'logs-page',
            })
        }
    }

    // ─── Client-side filtering ──────────────────────────────────────────────
    const filtered = $derived.by(() => {
        const needle = search.trim().toLowerCase()
        return entries.filter((e) => {
            if (levelFilter !== 'all' && e.level !== levelFilter) return false
            if (originFilter !== 'all' && e.origin !== originFilter) return false
            if (!needle) return true
            const hay = [
                e.message,
                e.description ?? '',
                e.source ?? '',
                e.platform ?? '',
                e.clientId ?? '',
                e.userAgent ?? '',
            ].join(' ').toLowerCase()
            return hay.includes(needle)
        })
    })

    // ─── Formatting helpers ─────────────────────────────────────────────────
    function formatRelative(ts: number): string {
        const diff = Date.now() - ts
        if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s ago`
        if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
        if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
        const days = Math.floor(diff / 86_400_000)
        if (days < 7) return `${days}d ago`
        return new Date(ts).toLocaleDateString()
    }

    function formatAbsolute(ts: number): string {
        const d = new Date(ts)
        const pad = (n: number) => String(n).padStart(2, '0')
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    }

    function deviceKind(e: LogEntry): 'server' | 'mobile' | 'desktop' {
        if (e.origin === 'server') return 'server'
        const p = (e.platform ?? '').toLowerCase()
        if (p.includes('ios') || p.includes('android') || p.includes('ipad') || p.includes('mobile')) return 'mobile'
        return 'desktop'
    }

    function levelVariant(level: LogLevel): 'destructive' | 'warning' | 'info' {
        return level === 'error' ? 'destructive' : level === 'warning' ? 'warning' : 'info'
    }

    function formatEntry(e: LogEntry): string {
        const head = `[${e.level.toUpperCase()}] ${formatAbsolute(e.timestamp)} — ${e.message}${e.count > 1 ? ` (×${e.count})` : ''}`
        const meta = `origin=${e.origin}${e.source ? ` source=${e.source}` : ''}${e.platform ? ` platform=${e.platform}` : ''}${e.clientId ? ` client=${e.clientId}` : ''}`
        const desc = e.description ? `\n${e.description}` : ''
        return `${head}\n${meta}${desc}`
    }

    async function copyEntry(e: LogEntry) {
        try {
            await navigator.clipboard.writeText(formatEntry(e))
            notifySuccess(language.systemLogsCopied)
        } catch (err) {
            notifyError(String(err))
        }
    }

    async function copyAllFiltered() {
        try {
            const text = filtered.map(formatEntry).join('\n\n---\n\n')
            await navigator.clipboard.writeText(text)
            notifySuccess(language.systemLogsCopied)
        } catch (err) {
            notifyError(String(err))
        }
    }

    function onBadgeClick(token: string) {
        search = token
    }

    // Initial load
    $effect(() => {
        loadInitial()
    })
</script>

<SettingPage title={language.systemLogs}>
    <p class="text-textcolor2 text-sm mb-4">{language.systemLogsDesc}</p>

    <!-- Toolbar -->
    <div class="flex flex-col gap-3 mb-4">
        <div class="flex flex-wrap gap-2 items-center">
            <SegmentedControl
                bind:value={levelFilter}
                size="sm"
                options={[
                    { value: 'all', label: language.systemLogsLevelAll },
                    { value: 'error', label: language.systemLogsLevelError },
                    { value: 'warning', label: language.systemLogsLevelWarning },
                    { value: 'info', label: language.systemLogsLevelInfo },
                ]}
            />
            <SegmentedControl
                bind:value={originFilter}
                size="sm"
                options={[
                    { value: 'all', label: language.systemLogsOriginAll },
                    { value: 'client', label: language.systemLogsOriginClient },
                    { value: 'server', label: language.systemLogsOriginServer },
                ]}
            />
        </div>
        <div class="flex gap-2 items-stretch">
            <div class="flex-1 min-w-0">
                <ShInput bind:value={search} placeholder={language.systemLogsSearchPlaceholder} />
            </div>
            <ShButton variant="outline" size="default" onclick={loadInitial}>
                <RefreshCwIcon size={16} />
                <span class="hidden sm:inline">{language.systemLogsRefresh}</span>
            </ShButton>
            <ShButton variant="outline" size="default" onclick={copyAllFiltered}>
                <CopyIcon size={16} />
                <span class="hidden sm:inline">{language.systemLogsCopyAll}</span>
            </ShButton>
            <ShButton variant="destructive" size="default" onclick={handleClearAll}>
                <Trash2Icon size={16} />
                <span class="hidden sm:inline">{language.systemLogsClearAll}</span>
            </ShButton>
        </div>
    </div>

    <!-- Status bar -->
    <div class="text-textcolor2 text-xs mb-2 flex items-center gap-2">
        {#if loading}
            <span>Loading...</span>
        {:else if loadError}
            <span class="text-draculared">{language.systemLogsFailedLoad}: {loadError}</span>
        {:else}
            <span>{language.systemLogsFiltered(filtered.length, totalCount)}</span>
        {/if}
    </div>

    <!-- List -->
    {#if !loading && filtered.length === 0}
        <div class="flex flex-col items-center justify-center text-center py-16 border border-darkborderc rounded-md bg-darkbg/30">
            <ScrollTextIcon size={48} class="text-textcolor2 mb-3 opacity-50" />
            <div class="text-textcolor font-medium mb-1">{language.systemLogsEmpty}</div>
            <div class="text-textcolor2 text-sm">{language.systemLogsEmptyDesc}</div>
        </div>
    {:else}
        <Tooltip.Provider delayDuration={300}>
            <div class="flex flex-col gap-1 border border-darkborderc rounded-md bg-darkbg/30 overflow-hidden">
                {#each filtered as entry (entry.id)}
                    <Collapsible.Root
                        open={expanded[entry.id] === true}
                        onOpenChange={(v) => { expanded = { ...expanded, [entry.id]: v } }}
                    >
                        <Collapsible.Trigger class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-selected/30 focus-visible:outline-none focus-visible:bg-selected/30 border-b border-darkborderc/50 group">
                            <!-- Level icon + badge -->
                            <ShBadge variant={levelVariant(entry.level)} className="shrink-0">
                                {#if entry.level === 'error'}
                                    <CircleXIcon size={12} />
                                {:else if entry.level === 'warning'}
                                    <TriangleAlertIcon size={12} />
                                {:else}
                                    <InfoIcon size={12} />
                                {/if}
                                <span class="hidden sm:inline">{entry.level}</span>
                            </ShBadge>

                            <!-- Time (relative + absolute tooltip) -->
                            <Tooltip.Root>
                                <Tooltip.Trigger class="text-textcolor2 text-xs shrink-0 tabular-nums cursor-help">
                                    {formatRelative(entry.timestamp)}
                                </Tooltip.Trigger>
                                <Tooltip.Content
                                    class="bg-darkbg border border-darkborderc rounded-md px-2 py-1 text-xs text-textcolor shadow-lg z-50"
                                    sideOffset={4}
                                >
                                    {formatAbsolute(entry.timestamp)}
                                </Tooltip.Content>
                            </Tooltip.Root>

                            <!-- Message -->
                            <span class="flex-1 min-w-0 truncate text-sm text-textcolor">{entry.message}</span>

                            <!-- Count -->
                            {#if entry.count > 1}
                                <ShBadge variant="outline" className="shrink-0 tabular-nums">×{entry.count}</ShBadge>
                            {/if}

                            <!-- Device badge (click to filter) -->
                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <span
                                class="shrink-0"
                                onclick={(e) => { e.stopPropagation(); onBadgeClick(entry.clientId ?? (entry.origin === 'server' ? 'server' : deviceKind(entry))) }}
                            >
                                <ShBadge variant="secondary">
                                    {#if deviceKind(entry) === 'server'}
                                        <ServerIcon size={12} />
                                    {:else if deviceKind(entry) === 'mobile'}
                                        <SmartphoneIcon size={12} />
                                    {:else}
                                        <MonitorIcon size={12} />
                                    {/if}
                                    <span class="hidden md:inline text-[10px]">
                                        {entry.platform ?? (entry.origin === 'server' ? 'server' : '')}
                                        {#if entry.clientId}#{entry.clientId}{/if}
                                    </span>
                                </ShBadge>
                            </span>

                            <ChevronDownIcon size={14} class="shrink-0 text-textcolor2 transition-transform group-data-[state=open]:rotate-180" />
                        </Collapsible.Trigger>

                        <Collapsible.Content class="bg-darkbg/60 border-b border-darkborderc/50">
                            <div class="p-3 text-xs text-textcolor2 space-y-2">
                                {#if entry.description}
                                    <pre class="whitespace-pre-wrap break-all bg-bgcolor/50 border border-darkborderc/50 rounded p-2 text-textcolor font-mono">{entry.description}</pre>
                                {/if}
                                <div class="flex flex-wrap gap-x-4 gap-y-1">
                                    <span><span class="text-textcolor2/70">timestamp:</span> {formatAbsolute(entry.timestamp)}</span>
                                    <span><span class="text-textcolor2/70">origin:</span> {entry.origin}</span>
                                    {#if entry.source}<span><span class="text-textcolor2/70">source:</span> {entry.source}</span>{/if}
                                    {#if entry.platform}<span><span class="text-textcolor2/70">platform:</span> {entry.platform}</span>{/if}
                                    {#if entry.clientId}<span><span class="text-textcolor2/70">client:</span> #{entry.clientId}</span>{/if}
                                </div>
                                {#if entry.userAgent}
                                    <div class="break-all"><span class="text-textcolor2/70">user-agent:</span> {entry.userAgent}</div>
                                {/if}
                                <div class="pt-1">
                                    <ShButton variant="outline" size="sm" onclick={() => copyEntry(entry)}>
                                        <CopyIcon size={14} />
                                        <span>{language.systemLogsCopyEntry}</span>
                                    </ShButton>
                                </div>
                            </div>
                        </Collapsible.Content>
                    </Collapsible.Root>
                {/each}
            </div>
        </Tooltip.Provider>

        {#if hasMore}
            <div class="flex justify-center mt-3">
                <ShButton variant="outline" size="default" disabled={loadingMore} onclick={loadMore}>
                    {loadingMore ? 'Loading...' : language.systemLogsLoadMore}
                </ShButton>
            </div>
        {/if}
    {/if}
</SettingPage>
