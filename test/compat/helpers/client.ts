/**
 * Thin HTTP helpers for talking to a RisuAI-NodeOnly server during tests.
 */

export interface RisuClient {
  /** JWT auth token obtained from /api/login. */
  token: string
  /** Export the backup as a raw Buffer. */
  exportBackup: () => Promise<Buffer>
  /**
   * Import a .bin backup (runs the two-stage prepare → import flow).
   * Returns the JSON response from the import endpoint.
   */
  importBackup: (data: Buffer) => Promise<{ ok: boolean; assetsRestored?: number; coldStorageFailed?: number; error?: string }>
  /** Raw fetch with auth header pre-set. */
  fetch: (path: string, init?: RequestInit) => Promise<Response>
}

export async function createClient(port: number, password: string): Promise<RisuClient> {
  const base = `http://127.0.0.1:${port}`

  // Login
  const loginRes = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  if (!loginRes.ok) {
    const body = await loginRes.text()
    throw new Error(`Login failed (${loginRes.status}): ${body}`)
  }
  const { token } = (await loginRes.json()) as { status: string; token: string }
  if (!token) throw new Error('Login succeeded but no token returned')

  const authFetch = (urlPath: string, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers)
    headers.set('risu-auth', token)
    return fetch(`${base}${urlPath}`, { ...init, headers })
  }

  const exportBackup = async (): Promise<Buffer> => {
    const res = await authFetch('/api/backup/export')
    if (!res.ok) throw new Error(`Export failed (${res.status}): ${await res.text()}`)
    return Buffer.from(await res.arrayBuffer())
  }

  const importBackup = async (data: Buffer) => {
    // Stage 1: prepare
    const prepRes = await authFetch('/api/backup/import/prepare', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ size: data.byteLength }),
    })
    if (!prepRes.ok) {
      const body = await prepRes.json().catch(() => ({})) as Record<string, unknown>
      throw new Error(`Import prepare failed (${prepRes.status}): ${JSON.stringify(body)}`)
    }

    // Stage 2: upload
    // Use application/x-risu-backup so that express.raw() (which only handles
    // application/octet-stream) does NOT consume the request body.  The import
    // handler streams from the raw request, not req.body.
    const impRes = await authFetch('/api/backup/import', {
      method: 'POST',
      headers: { 'content-type': 'application/x-risu-backup' },
      body: new Uint8Array(data),
    })
    return (await impRes.json()) as { ok: boolean; assetsRestored?: number; coldStorageFailed?: number; error?: string }
  }

  return { token, exportBackup, importBackup, fetch: authFetch }
}
