const DEFAULT_BACKEND_PORT = 6001

export function getBackendPort(env = process.env) {
  const parsed = Number(env.PORT || DEFAULT_BACKEND_PORT)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BACKEND_PORT
}

export function getBackendOrigin(port) {
  return `http://127.0.0.1:${port}`
}

export async function isExpectedBackendHealthy({
  port,
  fetchImpl = fetch,
}) {
  try {
    const response = await fetchImpl(`${getBackendOrigin(port)}/api/test_auth`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(1000),
    })

    if (!response.ok) {
      return false
    }

    const data = await response.json().catch(() => null)
    return typeof data?.status === 'string'
  } catch {
    return false
  }
}

export async function decideBackendStartup({
  port,
  isPortOpen,
  fetchImpl = fetch,
}) {
  if (!(await isPortOpen(port))) {
    return 'start'
  }

  if (await isExpectedBackendHealthy({ port, fetchImpl })) {
    return 'reuse'
  }

  return 'conflict'
}
