<script lang="ts">
  import { onDestroy } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import { ChevronLeft, ChevronRight, X, Download, Trash2, Info, ImageIcon } from '@lucide/svelte'

  import { language } from 'src/lang'
  import { alertConfirm, alertError, alertNormal } from 'src/ts/alert'
  import { downloadFile } from 'src/ts/globalApi.svelte'
  import {
    getCharacterChatIndex,
    getInlayAssetBlob,
    listInlayExplorerItems,
    removeInlayAsset,
    removeInlayAssets,
    scanInlayReferences,
    type CharacterChatIndexItem,
    type InlayExplorerItem,
    type InlayScanResult,
  } from 'src/ts/process/files/inlays'
  import Button from '../UI/GUI/Button.svelte'

  const PAGE_SIZE = 40

  type SortKey = 'created-desc' | 'created-asc' | 'updated-desc' | 'updated-asc'
  type SpecialFilter = 'all' | 'meta-missing' | 'orphan-character' | 'orphan-chat' | 'orphan-message'

  // Data state
  let allItems = $state<InlayExplorerItem[]>([])
  let characterIndex = $state<CharacterChatIndexItem[]>([])
  let displayCount = $state(PAGE_SIZE)
  let loading = $state(true)
  let paging = $state(false)
  let loadMoreSentinel: HTMLDivElement | null = $state(null)
  let selection = $state<Set<string>>(new SvelteSet())

  // Filter/sort state
  let sortKey = $state<SortKey>('updated-desc')
  let characterFilter = $state('')
  let chatFilter = $state('')
  let specialFilter = $state<SpecialFilter>('all')

  // Scan state
  let scanResult = $state<InlayScanResult | null>(null)

  // Viewer state
  let viewerOpen = $state(false)
  let viewerId = $state('')
  let viewerUrl = $state('')
  let viewerLoading = $state(false)
  let viewerError = $state('')
  let infoPanelOpen = $state(true)

  // --- Derived ---
  const characterMap = $derived(new Map(characterIndex.map((char) => [char.chaId, char])))
  const allChatIds = $derived(new Set(characterIndex.flatMap((char) => char.chats.map((chat) => chat.id))))
  const availableChats = $derived(characterFilter ? (characterMap.get(characterFilter)?.chats ?? []) : [])

  const filteredItems = $derived.by(() => {
    return allItems
      .filter((item) => item.type === 'image')
      .filter((item) => {
        if (characterFilter && item.meta?.charId !== characterFilter) return false
        if (chatFilter && item.meta?.chatId !== chatFilter) return false
        if (specialFilter === 'meta-missing' && item.hasMeta) return false
        if (specialFilter === 'orphan-character' && !isOrphanCharacter(item)) return false
        if (specialFilter === 'orphan-chat' && !isOrphanChat(item)) return false
        if (specialFilter === 'orphan-message' && (scanResult?.refCounts[item.id] ?? 0) > 0) return false
        return true
      })
  })

  const sortedItems = $derived.by(() => {
    return [...filteredItems].sort((left, right) => {
      const leftValue = getSortTimestamp(left, sortKey)
      const rightValue = getSortTimestamp(right, sortKey)
      return sortKey.endsWith('asc') ? leftValue - rightValue : rightValue - leftValue
    })
  })

  const displayedItems = $derived(sortedItems.slice(0, displayCount))
  const hasMore = $derived(displayCount < sortedItems.length)
  const hasSelection = $derived(selection.size > 0)
  const currentViewerItem = $derived(sortedItems.find((item) => item.id === viewerId) ?? null)
  const viewerIndex = $derived(sortedItems.findIndex((item) => item.id === viewerId))
  const canGoPrev = $derived(viewerIndex > 0)
  const canGoNext = $derived(viewerIndex >= 0 && viewerIndex < sortedItems.length - 1)

  // --- Helpers ---
  function getSortTimestamp(item: InlayExplorerItem, key: SortKey): number {
    if (key.startsWith('created')) return item.meta?.createdAt ?? 0
    return item.meta?.updatedAt ?? 0
  }

  function getCharacterName(item: InlayExplorerItem | null): string | null {
    const charId = item?.meta?.charId
    if (!charId) return null
    return characterMap.get(charId)?.name ?? charId
  }

  function getChatName(item: InlayExplorerItem | null): string | null {
    const charId = item?.meta?.charId
    const chatId = item?.meta?.chatId
    if (!chatId) return null
    if (charId) {
      const chat = characterMap.get(charId)?.chats.find((entry) => entry.id === chatId)
      return chat?.name ?? chatId
    }
    for (const char of characterIndex) {
      const chat = char.chats.find((entry) => entry.id === chatId)
      if (chat) return chat.name
    }
    return chatId
  }

  function isOrphanCharacter(item: InlayExplorerItem): boolean {
    const charId = item.meta?.charId
    return !!charId && !characterMap.has(charId)
  }

  function isOrphanChat(item: InlayExplorerItem): boolean {
    const chatId = item.meta?.chatId
    if (!chatId) return false
    const charId = item.meta?.charId
    if (charId) {
      const char = characterMap.get(charId)
      if (!char) return false
      return !char.chats.some((chat) => chat.id === chatId)
    }
    return !allChatIds.has(chatId)
  }

  function getStatusLabel(item: InlayExplorerItem | null): string | null {
    if (!item) return null
    if (!item.hasMeta) return language.playground.inlayFilterMetaMissing
    if (isOrphanCharacter(item)) return language.playground.inlayFilterOrphanCharacter
    if (isOrphanChat(item)) return language.playground.inlayFilterOrphanChat
    return null
  }

  function formatTimestamp(value?: number): string | null {
    if (!value || value <= 0) return null
    return new Date(value).toLocaleString()
  }

  function sanitizeFileName(name: string): string {
    const trimmed = name.trim()
    const fallback = trimmed.length > 0 ? trimmed : 'inlay-image.png'
    return fallback.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
  }

  function revokeViewerUrl() {
    if (viewerUrl) {
      URL.revokeObjectURL(viewerUrl)
      viewerUrl = ''
    }
  }

  async function loadViewerAsset(id: string) {
    revokeViewerUrl()
    viewerLoading = true
    viewerError = ''
    try {
      const asset = await getInlayAssetBlob(id)
      if (!asset) {
        viewerError = language.playground.inlayLoadingOriginal
        return
      }
      viewerUrl = URL.createObjectURL(asset.data)
    } catch (error) {
      viewerError = `${error}`
    } finally {
      viewerLoading = false
    }
  }

  async function openViewer(id: string) {
    viewerOpen = true
    viewerId = id
    await loadViewerAsset(id)
  }

  function closeViewer() {
    viewerOpen = false
    viewerId = ''
    viewerError = ''
    viewerLoading = false
    revokeViewerUrl()
  }

  async function goToNeighbor(offset: -1 | 1) {
    if (viewerIndex < 0) return
    const nextItem = sortedItems[viewerIndex + offset]
    if (!nextItem) return
    await openViewer(nextItem.id)
  }

  async function downloadCurrent(item: InlayExplorerItem) {
    try {
      const asset = await getInlayAssetBlob(item.id)
      if (!asset) {
        alertError('Failed to load image for download.')
        return
      }
      const buffer = new Uint8Array(await asset.data.arrayBuffer())
      await downloadFile(sanitizeFileName(item.name), buffer)
      alertNormal(language.successExport)
    } catch (error) {
      alertError(`${error}`)
    }
  }

  const toggleSelect = (id: string) => {
    if (selection.has(id)) selection.delete(id)
    else selection.add(id)
  }

  const selectAll = () => displayedItems.forEach((item) => selection.add(item.id))
  const deselectAll = () => selection.clear()

  const deleteAsset = async (id: string, name: string) => {
    if (!(await alertConfirm(language.playground.inlayDeleteConfirm.replace('{name}', name)))) return
    await removeInlayAsset(id)
    selection.delete(id)
    allItems = allItems.filter((item) => item.id !== id)
    if (viewerId === id) {
      const currentIndex = sortedItems.findIndex((item) => item.id === id)
      const nextItem = sortedItems[currentIndex + 1] ?? sortedItems[currentIndex - 1] ?? null
      if (nextItem) await openViewer(nextItem.id)
      else closeViewer()
    }
  }

  const deleteSelected = async () => {
    if (selection.size === 0) return
    if (!(await alertConfirm(language.playground.inlayDeleteMultipleConfirm.replace('{count}', selection.size.toString())))) return
    const ids = allItems.filter((item) => selection.has(item.id)).map((item) => item.id)
    await removeInlayAssets(ids)
    allItems = allItems.filter((item) => !selection.has(item.id))
    if (viewerId && selection.has(viewerId)) closeViewer()
    selection.clear()
  }

  // --- Effects ---
  $effect(() => {
    characterFilter
    const validChatIds = availableChats.map((chat) => chat.id)
    if (chatFilter && !validChatIds.includes(chatFilter)) chatFilter = ''
  })

  $effect(() => {
    allItems.length
    sortKey
    characterFilter
    chatFilter
    specialFilter
    displayCount = PAGE_SIZE
  })

  // Auto-scan when orphan-message filter is selected
  $effect(() => {
    if (specialFilter === 'orphan-message' && !scanResult) {
      scanResult = scanInlayReferences()
    }
  })

  // Keyboard shortcuts for viewer
  $effect(() => {
    if (!viewerOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeViewer()
      if (e.key === 'ArrowLeft' && canGoPrev) goToNeighbor(-1)
      if (e.key === 'ArrowRight' && canGoNext) goToNeighbor(1)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  })

  // Infinite scroll
  let observer: IntersectionObserver | null = null
  $effect(() => {
    if (!loadMoreSentinel || !hasMore) {
      observer?.disconnect()
      return
    }
    const loadMore = () => {
      if (!hasMore || loading || paging) return
      paging = true
      displayCount += PAGE_SIZE
      queueMicrotask(() => { paging = false })
    }
    observer?.disconnect()
    observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) loadMore() },
      { root: null, rootMargin: '200px 0px', threshold: 0 }
    )
    observer.observe(loadMoreSentinel)
    return () => {
      observer?.disconnect()
      observer = null
    }
  })

  onDestroy(() => {
    observer?.disconnect()
    revokeViewerUrl()
  })

  const loadAssets = async () => {
    loading = true
    const [items, index] = await Promise.all([
      listInlayExplorerItems(),
      Promise.resolve(getCharacterChatIndex()),
    ])
    allItems = items
    characterIndex = index
    loading = false
  }
  loadAssets()
</script>

<!-- Initial loading overlay -->
{#if loading}
  <div class="fixed inset-0 z-[100] bg-bgcolor/80 backdrop-blur-sm flex items-center justify-center">
    <div class="bg-darkbg border border-darkborderc rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl min-w-[240px]">
      <div class="w-12 h-12 border-4 border-darkborderc border-t-blue-500 rounded-full animate-spin"></div>
      <p class="text-textcolor font-semibold">{language.playground.inlayImageGallery}</p>
      <p class="text-textcolor2 text-sm">{language.playground.inlayLoadingMore}</p>
    </div>
  </div>
{/if}

<h2 class="text-4xl text-textcolor mt-6 font-black">{language.playground.inlayImageGallery}</h2>

<!-- Sticky header -->
<header class="flex flex-col gap-3 py-4 sticky top-0 bg-bgcolor z-20">
  <div class="flex flex-wrap gap-3 items-center">
    <span class="text-textcolor2 text-sm">
      {language.playground.inlayTotalAssets.replace('{count}', filteredItems.length.toString())}
    </span>
    <div class="flex gap-2 ml-auto">
      {#if hasSelection}
        <Button onclick={deleteSelected} styled="danger" size="sm">{language.playground.inlayDeleteSelected}</Button>
        <Button onclick={deselectAll} styled="primary" size="sm">
          {language.playground.inlayDeselectAll} ({selection.size})
        </Button>
      {:else if allItems.length > 0}
        <Button onclick={selectAll} styled="primary" size="sm">{language.playground.inlaySelectAll}</Button>
      {/if}
    </div>
  </div>

  {#if allItems.length > 0}
    <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
      <label class="flex flex-col gap-1 text-xs text-textcolor2">
        <span>{language.playground.inlaySort}</span>
        <select bind:value={sortKey} class="rounded border border-darkborderc bg-darkbg px-2 py-1.5 text-textcolor text-sm">
          <option value="updated-desc">{language.playground.inlaySortUpdatedDesc}</option>
          <option value="updated-asc">{language.playground.inlaySortUpdatedAsc}</option>
          <option value="created-desc">{language.playground.inlaySortCreatedDesc}</option>
          <option value="created-asc">{language.playground.inlaySortCreatedAsc}</option>
        </select>
      </label>
      <label class="flex flex-col gap-1 text-xs text-textcolor2">
        <span>{language.character}</span>
        <select bind:value={characterFilter} class="rounded border border-darkborderc bg-darkbg px-2 py-1.5 text-textcolor text-sm">
          <option value="">{language.none}</option>
          {#each characterIndex as char (char.chaId)}
            <option value={char.chaId}>{char.name}</option>
          {/each}
        </select>
      </label>
      <label class="flex flex-col gap-1 text-xs text-textcolor2">
        <span>{language.Chat}</span>
        <select bind:value={chatFilter} class="rounded border border-darkborderc bg-darkbg px-2 py-1.5 text-textcolor text-sm" disabled={!characterFilter}>
          <option value="">{language.none}</option>
          {#each availableChats as chat (chat.id)}
            <option value={chat.id}>{chat.name}</option>
          {/each}
        </select>
      </label>
      <label class="flex flex-col gap-1 text-xs text-textcolor2">
        <span>{language.playground.inlayFilter}</span>
        <select bind:value={specialFilter} class="rounded border border-darkborderc bg-darkbg px-2 py-1.5 text-textcolor text-sm">
          <option value="all">{language.playground.inlayFilterAll}</option>
          <option value="meta-missing">{language.playground.inlayFilterMetaMissing}</option>
          <option value="orphan-character">{language.playground.inlayFilterOrphanCharacter}</option>
          <option value="orphan-chat">{language.playground.inlayFilterOrphanChat}</option>
          <option value="orphan-message">{language.playground.inlayFilterOrphanMessage}</option>
        </select>
      </label>
    </div>
  {/if}
</header>

<!-- Empty state -->
{#if !loading && filteredItems.length === 0}
  <div class="text-center py-20 text-textcolor2">
    <p class="text-lg">{language.playground.inlayEmpty}</p>
    <p class="text-sm mt-2">{language.playground.inlayImageGalleryEmptyDesc}</p>
  </div>
{:else}
  <!-- Card grid -->
  <div class="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
    {#each displayedItems as item (item.id)}
      <div
        class="relative group aspect-[2/3] rounded-lg overflow-hidden bg-darkbg border cursor-pointer select-none transition-colors
          {selection.has(item.id) ? 'border-blue-500' : 'border-darkborderc hover:border-darkborderc/60'}"
        onclick={() => openViewer(item.id)}
      >
        <!-- Thumbnail -->
        {#if item.thumb?.data}
          <img alt={item.name} class="w-full h-full object-cover" src={item.thumb.data} />
        {:else}
          <div class="w-full h-full flex items-center justify-center text-textcolor2/40">
            <ImageIcon size={28} />
          </div>
        {/if}

        <!-- Selection checkbox -->
        <button
          class="absolute top-1.5 left-1.5 z-10 w-5 h-5 rounded flex items-center justify-center transition-all border
            {selection.has(item.id)
              ? 'bg-blue-500 border-blue-500'
              : 'bg-black/50 border-white/40 opacity-0 group-hover:opacity-100'}"
          onclick={(e) => { e.stopPropagation(); toggleSelect(item.id) }}
        >
          {#if selection.has(item.id)}
            <svg class="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 6l3 3 5-5" />
            </svg>
          {/if}
        </button>

        <!-- Status dot -->
        {#if getStatusLabel(item)}
          <div
            class="absolute top-1.5 right-1.5 z-10 w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center"
            title={getStatusLabel(item) ?? ''}
          >
            <span class="text-white text-[9px] font-bold leading-none">!</span>
          </div>
        {/if}

        <!-- Bottom gradient overlay (hover) -->
        <div
          class="absolute inset-x-0 bottom-0 pt-8 pb-2 px-2
            bg-gradient-to-t from-black/80 via-black/40 to-transparent
            opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex flex-col"
        >
          <p class="text-white text-xs font-medium truncate leading-tight">{item.name}</p>
          {#if getCharacterName(item)}
            <p class="text-white/60 text-[10px] truncate leading-tight">{getCharacterName(item)}</p>
          {/if}
          <div class="flex gap-1.5 mt-1.5 justify-end" onclick={(e) => e.stopPropagation()}>
            <button
              class="w-6 h-6 rounded bg-white/15 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
              onclick={() => downloadCurrent(item)}
              title={language.download}
            >
              <Download size={11} />
            </button>
            <button
              class="w-6 h-6 rounded bg-red-500/30 hover:bg-red-500/70 flex items-center justify-center text-white transition-colors"
              onclick={() => deleteAsset(item.id, item.name)}
              title={language.playground.inlayDelete}
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>
      </div>
    {/each}
  </div>

  <!-- Load more spinner -->
  {#if hasMore}
    <div bind:this={loadMoreSentinel} class="flex items-center justify-center py-10">
      <div class="w-7 h-7 border-4 border-darkborderc border-t-blue-500/70 rounded-full animate-spin"></div>
    </div>
  {/if}
{/if}

<!-- Fullscreen viewer -->
{#if viewerOpen}
  <div class="fixed inset-0 z-50 flex overflow-hidden" style="background: #09090b;">

    <!-- Image panel -->
    <div class="flex-1 relative flex items-center justify-center min-w-0 overflow-hidden">

      <!-- Top toolbar -->
      <div class="absolute top-0 inset-x-0 z-10 flex items-center gap-3 px-4 py-3 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
        <div class="flex-1 min-w-0">
          <p class="text-white text-sm font-semibold truncate">{currentViewerItem?.name ?? viewerId}</p>
          {#if viewerIndex >= 0}
            <p class="text-white/40 text-xs">{viewerIndex + 1} / {sortedItems.length}</p>
          {/if}
        </div>
        <div class="flex gap-2 shrink-0 pointer-events-auto">
          <button
            class="w-9 h-9 rounded-full border border-white/20 bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
            onclick={() => (infoPanelOpen = !infoPanelOpen)}
            title={language.playground.inlayInfo}
          >
            <Info size={16} />
          </button>
          <button
            class="w-9 h-9 rounded-full border border-white/20 bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
            onclick={() => currentViewerItem && downloadCurrent(currentViewerItem)}
            title={language.download}
          >
            <Download size={16} />
          </button>
          <button
            class="w-9 h-9 rounded-full border border-white/20 bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
            onclick={closeViewer}
            title={language.goback}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <!-- Prev arrow -->
      {#if canGoPrev}
        <button
          class="absolute left-3 z-10 w-11 h-11 rounded-full border border-white/20 bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
          onclick={() => goToNeighbor(-1)}
        >
          <ChevronLeft size={22} />
        </button>
      {/if}

      <!-- Image / loading / error -->
      <div class="w-full h-full flex items-center justify-center px-16 py-14">
        {#if viewerLoading}
          <div class="flex flex-col items-center gap-4">
            <div class="w-12 h-12 border-4 border-white/15 border-t-white/80 rounded-full animate-spin"></div>
            <p class="text-white/50 text-sm">{language.playground.inlayLoadingOriginal}</p>
          </div>
        {:else if viewerError}
          <p class="text-red-300 text-sm">{viewerError}</p>
        {:else if viewerUrl}
          <img
            alt={currentViewerItem?.name ?? viewerId}
            class="max-w-full max-h-full object-contain rounded shadow-2xl"
            style="max-height: calc(100vh - 112px);"
            src={viewerUrl}
          />
        {/if}
      </div>

      <!-- Next arrow -->
      {#if canGoNext}
        <button
          class="absolute right-3 z-10 w-11 h-11 rounded-full border border-white/20 bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
          onclick={() => goToNeighbor(1)}
        >
          <ChevronRight size={22} />
        </button>
      {/if}

      <!-- Status badge at bottom -->
      {#if getStatusLabel(currentViewerItem)}
        <div class="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-orange-500/80 text-white text-xs font-medium">
          {getStatusLabel(currentViewerItem)}
        </div>
      {/if}
    </div>

    <!-- Info panel -->
    {#if infoPanelOpen}
      <div class="w-72 xl:w-80 shrink-0 flex flex-col overflow-hidden border-l border-white/10" style="background: #18181b;">

        <!-- Panel header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span class="text-white/80 text-sm font-semibold">{language.playground.inlayInfo}</span>
          <button class="text-white/40 hover:text-white transition-colors" onclick={() => (infoPanelOpen = false)}>
            <X size={16} />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto">

          <!-- File info -->
          <div class="px-4 py-3 space-y-1.5 border-b border-white/10">
            <p class="text-white text-sm font-medium break-all leading-snug" title={currentViewerItem?.name}>
              {currentViewerItem?.name ?? viewerId}
            </p>
            <p class="text-white/30 text-xs font-mono break-all leading-snug">{viewerId}</p>
            {#if currentViewerItem?.width && currentViewerItem?.height}
              <p class="text-white/50 text-xs">{currentViewerItem.width} × {currentViewerItem.height} px</p>
            {/if}
            {#if getCharacterName(currentViewerItem)}
              <p class="text-white/60 text-xs">{language.character}: {getCharacterName(currentViewerItem)}</p>
            {/if}
            {#if getChatName(currentViewerItem)}
              <p class="text-white/60 text-xs">{language.Chat}: {getChatName(currentViewerItem)}</p>
            {/if}
            {#if formatTimestamp(currentViewerItem?.meta?.createdAt)}
              <p class="text-white/35 text-xs">{language.playground.inlayCreatedAt} {formatTimestamp(currentViewerItem?.meta?.createdAt)}</p>
            {/if}
            {#if formatTimestamp(currentViewerItem?.meta?.updatedAt)}
              <p class="text-white/35 text-xs">{language.playground.inlayUpdatedAt} {formatTimestamp(currentViewerItem?.meta?.updatedAt)}</p>
            {/if}
          </div>

          <!-- Actions -->
          <div class="px-4 py-4 space-y-2">
            <h3 class="text-white/50 text-[11px] font-semibold uppercase tracking-wider">
              {language.playground.inlayActions}
            </h3>
            <button
              onclick={() => currentViewerItem && downloadCurrent(currentViewerItem)}
              class="w-full flex items-center gap-2 px-3 py-2 rounded border border-white/15 hover:bg-white/5 text-white/70 hover:text-white text-sm transition-colors"
            >
              <Download size={14} />
              {language.download}
            </button>
            <button
              onclick={() => currentViewerItem && deleteAsset(currentViewerItem.id, currentViewerItem.name)}
              class="w-full flex items-center gap-2 px-3 py-2 rounded border border-red-500/25 hover:bg-red-500/15 text-red-400 hover:text-red-300 text-sm transition-colors"
            >
              <Trash2 size={14} />
              {language.playground.inlayDelete}
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}
