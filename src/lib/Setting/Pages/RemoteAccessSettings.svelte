<script lang="ts">
    import { language } from "src/lang";
    import SettingPage from "src/lib/UI/GUI/SettingPage.svelte";
    import { forageStorage } from "src/ts/globalApi.svelte";
    import { alertConfirm } from "src/ts/alert";
    import ShButton from "src/lib/UI/GUI/ShButton.svelte";
    import ShInput from "src/lib/UI/GUI/ShInput.svelte";
    import ShAlert from "src/lib/UI/GUI/ShAlert.svelte";
    import { LoaderCircleIcon, CopyIcon, CheckIcon, DownloadIcon, TriangleAlertIcon, InfoIcon } from "@lucide/svelte";
    import QRCode from "qrcode";

    let status = $state<'loading' | 'disabled' | 'off' | 'downloading' | 'starting' | 'running' | 'error'>('loading');
    let tunnelUrl = $state<string | null>(null);
    let tunnelError = $state<string | null>(null);
    let qrDataUrl = $state<string | null>(null);
    let copied = $state(false);
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    async function authHeaders() {
        const auth = await forageStorage.createAuth();
        return { 'risu-auth': auth };
    }

    async function fetchStatus() {
        try {
            const res = await fetch('/api/tunnel/status', { headers: await authHeaders() });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            if (data.disabled) {
                status = 'disabled';
            } else {
                status = data.status;
                tunnelUrl = data.url;
                tunnelError = data.error;

                if (data.status === 'running' && data.url) {
                    qrDataUrl = await QRCode.toDataURL(data.url, { width: 200, margin: 2 });
                }

                if ((data.status === 'starting' || data.status === 'downloading') && !pollTimer) {
                    pollTimer = setInterval(fetchStatus, 2000);
                } else if (data.status !== 'starting' && data.status !== 'downloading' && pollTimer) {
                    clearInterval(pollTimer);
                    pollTimer = null;
                }
            }
        } catch {
            if (status === 'loading') status = 'error';
            tunnelError = 'Failed to connect to server';
            if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
        }
    }

    async function startTunnel() {
        status = 'starting';
        tunnelError = null;
        try {
            const res = await fetch('/api/tunnel/start', {
                method: 'POST',
                headers: await authHeaders(),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(data.error);
            }
            const data = await res.json();
            if (data.status === 'downloading') status = 'downloading';
            if (pollTimer) clearInterval(pollTimer);
            pollTimer = setInterval(fetchStatus, 2000);
        } catch (e: any) {
            status = 'error';
            tunnelError = e.message;
        }
    }

    async function stopTunnel() {
        if (!await alertConfirm(language.remoteAccessCloseConfirm)) return;
        try {
            await fetch('/api/tunnel/stop', {
                method: 'POST',
                headers: await authHeaders(),
            });
        } catch {}
        status = 'off';
        tunnelUrl = null;
        qrDataUrl = null;
        tunnelError = null;
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    }

    async function copyUrl() {
        if (!tunnelUrl) return;
        try {
            await navigator.clipboard.writeText(tunnelUrl);
            copied = true;
            setTimeout(() => { copied = false; }, 2000);
        } catch {}
    }

    $effect(() => {
        fetchStatus();
        return () => {
            if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
        };
    });
</script>

<SettingPage title={language.remoteAccess}>
<div class="flex flex-col gap-4">
    <p class="text-sm text-textcolor2">{language.remoteAccessDesc}</p>

    {#if status === 'loading'}
        <div class="flex items-center justify-center py-8 text-textcolor2">
            <LoaderCircleIcon class="animate-spin" size={28} />
        </div>

    {:else if status === 'disabled'}
        <div class="text-sm text-yellow-400">{language.remoteAccessDisabled}</div>

    {:else if status === 'off'}
        <ShButton onclick={startTunnel} className="mt-2 self-start">{language.remoteAccessOpen}</ShButton>

    {:else if status === 'downloading'}
        <div class="flex items-center gap-3 py-4 text-textcolor2">
            <DownloadIcon class="animate-pulse" size={24} />
            <span>{language.remoteAccessDownloading}</span>
        </div>

    {:else if status === 'starting'}
        <div class="flex items-center gap-3 py-4 text-textcolor2">
            <LoaderCircleIcon class="animate-spin" size={24} />
            <span>{language.remoteAccessStarting}</span>
        </div>

    {:else if status === 'running' && tunnelUrl}
        <div class="flex flex-col items-center gap-4 bg-darkbg rounded-lg p-6 border border-darkborderc">
            {#if qrDataUrl}
                <img src={qrDataUrl} alt="QR Code" class="rounded-lg" width="200" height="200" />
                <p class="text-sm text-textcolor2">{language.remoteAccessQrHint}</p>
            {/if}

            <div class="flex items-center gap-2 w-full max-w-md">
                <ShInput
                    type="text"
                    readonly
                    value={tunnelUrl}
                    className="flex-1 select-all"
                />
                <ShButton size="icon" onclick={copyUrl}>
                    {#if copied}
                        <CheckIcon size={16} />
                    {:else}
                        <CopyIcon size={16} />
                    {/if}
                </ShButton>
            </div>

            <ShAlert variant="destructive" className="w-full max-w-md">
                {#snippet icon()}<TriangleAlertIcon />{/snippet}
                {language.remoteAccessWarning}
            </ShAlert>

            <ShAlert variant="info" className="w-full max-w-md">
                {#snippet icon()}<InfoIcon />{/snippet}
                {language.remoteAccessInfo}
            </ShAlert>

            <ShButton variant="destructive" onclick={stopTunnel} className="mt-2">{language.remoteAccessClose}</ShButton>
        </div>

    {:else if status === 'error'}
        <div class="flex flex-col gap-2">
            <div class="text-sm text-red-400">
                {language.remoteAccessError}{tunnelError ? `: ${tunnelError}` : ''}
            </div>
            <ShButton size="sm" onclick={startTunnel} className="mt-1 self-start">{language.remoteAccessRetry}</ShButton>
        </div>
    {/if}
</div>
</SettingPage>
