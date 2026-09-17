import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const STATIC_FILES = new Map([
  ['/', { path: resolve(ROOT, 'web/index.html'), type: 'text/html; charset=utf-8' }],
  ['/app.js', { path: resolve(ROOT, 'web/app.js'), type: 'text/javascript; charset=utf-8' }],
  ['/mic.js', { path: resolve(ROOT, 'web/mic.js'), type: 'text/javascript; charset=utf-8' }],
  ['/sales-visual.js', { path: resolve(ROOT, 'web/sales-visual.js'), type: 'text/javascript; charset=utf-8' }],
  ['/sales-intelligence.js', { path: resolve(ROOT, 'web/sales-intelligence.js'), type: 'text/javascript; charset=utf-8' }],
  ['/styles.css', { path: resolve(ROOT, 'web/styles.css'), type: 'text/css; charset=utf-8' }],
  ['/vendor/livekit-client.esm.mjs', {
    path: resolve(ROOT, 'node_modules/livekit-client/dist/livekit-client.esm.mjs'),
    type: 'text/javascript; charset=utf-8',
  }],
])

function writeJson(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(body))
}

async function writeStatic(res, entry) {
  const body = await readFile(entry.path)
  res.writeHead(200, {
    'content-type': entry.type,
    'cache-control': entry.path.includes('node_modules') ? 'public, max-age=3600' : 'no-store',
  })
  res.end(body)
}

async function readJson(req, maxBytes = 64 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > maxBytes) throw new Error('request body too large')
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function sessionPath(pathname, suffix = '') {
  const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return pathname.match(new RegExp(`^/sessions/([^/]+)${escaped}$`))?.[1] ?? null
}

function actionMutationPath(pathname) {
  const match = pathname.match(/^\/sessions\/([^/]+)\/actions\/([^/]+)\/(confirm|cancel)$/)
  if (!match) return null
  return {
    sessionId: decodeURIComponent(match[1]),
    proposalId: decodeURIComponent(match[2]),
    action: match[3],
  }
}

function actionErrorStatus(error) {
  if (['NOT_FOUND', 'SESSION_MISMATCH'].includes(error?.code)) return 404
  if (['INVALID_TRANSITION', 'CONFIRMATION_REQUIRED', 'UNSUPPORTED_ACTION'].includes(error?.code)) return 409
  return 500
}

export function createAvatarControlServer({
  manager,
  host = '127.0.0.1',
  port = 8788,
  configuration = {},
  log = () => {},
} = {}) {
  if (!manager) throw new TypeError('manager is required')

  const server = createServer(async (req, res) => {
    if (req.method === 'OPTIONS') return writeJson(res, 204, {})
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    try {
      const staticEntry = req.method === 'GET' ? STATIC_FILES.get(url.pathname) : null
      if (staticEntry) return await writeStatic(res, staticEntry)
      if (req.method === 'GET' && url.pathname === '/health') {
        return writeJson(res, 200, {
          ok: true,
          sessions: manager.sessions?.size ?? null,
          configuration: typeof configuration === 'function' ? configuration() : configuration,
        })
      }
      if (req.method === 'POST' && url.pathname === '/sessions') {
        const session = await manager.start()
        return writeJson(res, 201, session)
      }
      const textId = sessionPath(url.pathname, '/text')
      if (req.method === 'POST' && textId) {
        const id = decodeURIComponent(textId)
        if (!manager.get(id)) return writeJson(res, 404, { error: 'session not found' })
        const body = await readJson(req)
        if (!String(body.text || '').trim()) return writeJson(res, 400, { error: 'text is required' })
        manager.sendText(id, body.text)
        return writeJson(res, 202, { ok: true })
      }
      const interruptId = sessionPath(url.pathname, '/interrupt')
      if (req.method === 'POST' && interruptId) {
        const id = decodeURIComponent(interruptId)
        if (!manager.get(id)) return writeJson(res, 404, { error: 'session not found' })
        manager.interrupt(id)
        return writeJson(res, 200, { ok: true })
      }
      const learningId = sessionPath(url.pathname, '/learning')
      if (req.method === 'GET' && learningId) {
        const bundle = manager.learning?.(decodeURIComponent(learningId))
        return writeJson(res, bundle ? 200 : 404, bundle ?? { error: 'learning session not found' })
      }
      const rewardId = sessionPath(url.pathname, '/reward')
      if (req.method === 'POST' && rewardId) {
        const id = decodeURIComponent(rewardId)
        if (!manager.learning?.(id)) return writeJson(res, 404, { error: 'learning session not found' })
        const body = await readJson(req)
        return writeJson(res, 201, manager.recordReward(id, body))
      }
      const experienceId = sessionPath(url.pathname, '/experience')
      if (req.method === 'POST' && experienceId) {
        const id = decodeURIComponent(experienceId)
        if (!manager.learning?.(id)) return writeJson(res, 404, { error: 'learning session not found' })
        const body = await readJson(req)
        return writeJson(res, 201, manager.promoteExperience(id, body))
      }
      const actionsId = sessionPath(url.pathname, '/actions')
      if (req.method === 'GET' && actionsId) {
        const actions = manager.actions?.(decodeURIComponent(actionsId))
        return writeJson(res, actions ? 200 : 404, actions ?? { error: 'action session not found' })
      }
      const actionMutation = actionMutationPath(url.pathname)
      if (req.method === 'POST' && actionMutation) {
        try {
          const proposal = actionMutation.action === 'confirm'
            ? manager.confirmAction?.(actionMutation.sessionId, actionMutation.proposalId)
            : manager.cancelAction?.(actionMutation.sessionId, actionMutation.proposalId)
          if (!proposal) return writeJson(res, 404, { error: 'action proposal not found' })
          return writeJson(res, 200, proposal)
        } catch (error) {
          return writeJson(res, actionErrorStatus(error), { error: error.message, code: error.code || null })
        }
      }
      const plainId = sessionPath(url.pathname)
      if (req.method === 'GET' && plainId) {
        const status = manager.status(decodeURIComponent(plainId))
        return writeJson(res, status ? 200 : 404, status ?? { error: 'session not found' })
      }
      if (req.method === 'DELETE' && plainId) {
        const stopped = await manager.stop(decodeURIComponent(plainId))
        return writeJson(res, stopped ? 200 : 404, { ok: stopped })
      }
      return writeJson(res, 404, { error: 'not found' })
    } catch (error) {
      log(`avatar control error: ${error.message}`)
      return writeJson(res, 500, { error: error.message })
    }
  })

  const wss = new WebSocketServer({ noServer: true })
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    const sessionId = sessionPath(url.pathname, '/audio')
    if (!sessionId || !manager.get(decodeURIComponent(sessionId))) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n')
      socket.destroy()
      return
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req, decodeURIComponent(sessionId)))
  })

  wss.on('connection', (ws, _req, sessionId) => {
    ws.on('message', (data, isBinary) => {
      try {
        let audio
        if (isBinary) audio = Buffer.from(data).toString('base64')
        else {
          const text = String(data)
          try { audio = JSON.parse(text)?.audio } catch { audio = text }
        }
        if (!audio) return
        manager.sendAudio(sessionId, audio)
      } catch (error) {
        ws.send(JSON.stringify({ type: 'error', message: error.message }))
      }
    })
  })

  return {
    server,
    wss,
    async start() {
      if (!server.listening) {
        await new Promise((resolve, reject) => {
          server.once('error', reject)
          server.listen(port, host, resolve)
        })
      }
      const address = server.address()
      const boundPort = typeof address === 'object' && address ? address.port : port
      const origin = `http://${host}:${boundPort}`
      log(`sales avatar control server running at ${origin}`)
      return { origin, port: boundPort }
    },
    async close() {
      for (const client of wss.clients) client.close()
      await manager.close()
      if (!server.listening) return
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    },
  }
}
