import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'

function writeJson(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type',
  })
  res.end(JSON.stringify(body))
}

function sessionPath(pathname, suffix = '') {
  const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return pathname.match(new RegExp(`^/sessions/([^/]+)${escaped}$`))?.[1] ?? null
}

export function createAvatarControlServer({
  manager,
  host = '127.0.0.1',
  port = 8788,
  log = () => {},
} = {}) {
  if (!manager) throw new TypeError('manager is required')

  const server = createServer(async (req, res) => {
    if (req.method === 'OPTIONS') return writeJson(res, 204, {})
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    try {
      if (req.method === 'GET' && url.pathname === '/health') {
        return writeJson(res, 200, { ok: true, sessions: manager.sessions?.size ?? null })
      }
      if (req.method === 'POST' && url.pathname === '/sessions') {
        const session = await manager.start()
        return writeJson(res, 201, session)
      }
      const interruptId = sessionPath(url.pathname, '/interrupt')
      if (req.method === 'POST' && interruptId) {
        manager.interrupt(decodeURIComponent(interruptId))
        return writeJson(res, 200, { ok: true })
      }
      const deleteId = sessionPath(url.pathname)
      if (req.method === 'DELETE' && deleteId) {
        const stopped = await manager.stop(decodeURIComponent(deleteId))
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
    wss.handleUpgrade(req, socket, head, ws => {
      wss.emit('connection', ws, req, decodeURIComponent(sessionId))
    })
  })

  wss.on('connection', (ws, _req, sessionId) => {
    ws.on('message', (data, isBinary) => {
      try {
        let audio
        if (isBinary) {
          audio = Buffer.from(data).toString('base64')
        } else {
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
