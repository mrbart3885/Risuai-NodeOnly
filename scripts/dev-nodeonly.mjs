import { spawn } from 'node:child_process'
import net from 'node:net'
import { decideBackendStartup, getBackendPort } from './dev-nodeonly-lib.mjs'

const pnpmBin = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const viteArgs = process.argv.slice(2)
const backendPort = getBackendPort(process.env)

const children = []

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port })
    socket.once('connect', () => {
      socket.end()
      resolve(true)
    })
    socket.once('error', () => {
      resolve(false)
    })
  })
}

function start(name, args) {
  const child = spawn(pnpmBin, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  })

  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`[dev-nodeonly] ${name} exited with signal ${signal}`)
    } else if (code && code !== 0) {
      console.error(`[dev-nodeonly] ${name} exited with code ${code}`)
      shutdown(code)
    }
  })

  children.push(child)
  return child
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM')
    }
  }
  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) {
        child.kill('SIGKILL')
      }
    }
  }, 1500).unref()
  process.exit(code)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

const backendDecision = await decideBackendStartup({
  port: backendPort,
  isPortOpen,
})

if (backendDecision === 'reuse') {
  console.log(`[dev-nodeonly] backend already running on port ${backendPort}, skipping node server startup`)
} else if (backendDecision === 'conflict') {
  console.error(`[dev-nodeonly] port ${backendPort} is already in use by a different process; stop it or choose another PORT before running pnpm dev`)
  process.exit(1)
} else {
  start('node-server', ['runserver'])
}
start('vite', ['exec', 'vite', ...viteArgs])
