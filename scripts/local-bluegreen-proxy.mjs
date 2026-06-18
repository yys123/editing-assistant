import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const port = Number(process.env.LOCAL_PROXY_PORT || 5175)
const staticRoot = process.env.FRONTEND_DIST || path.join(root, 'frontend', 'dist')
const activeSlotFile = process.env.ACTIVE_SLOT_FILE || path.join(root, 'deploy', 'local-runtime', 'active_backend_slot')
const bluePort = Number(process.env.BACKEND_BLUE_PORT || 8101)
const greenPort = Number(process.env.BACKEND_GREEN_PORT || 8102)

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function activeBackendPort() {
  let slot = 'blue'
  try {
    slot = fs.readFileSync(activeSlotFile, 'utf8').trim()
  } catch {
    // First run defaults to blue until the deploy script switches it.
  }
  return slot === 'green' ? greenPort : bluePort
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { 'content-type': 'text/plain; charset=utf-8' })
  res.end(text)
}

function proxyRequest(req, res) {
  const backendPort = activeBackendPort()
  const headers = { ...req.headers, host: `127.0.0.1:${backendPort}` }
  const upstream = http.request(
    {
      hostname: '127.0.0.1',
      port: backendPort,
      path: req.url,
      method: req.method,
      headers,
    },
    upstreamRes => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers)
      upstreamRes.pipe(res)
    },
  )

  upstream.setTimeout(300_000, () => upstream.destroy(new Error('backend request timed out')))
  upstream.on('error', err => {
    if (!res.headersSent) {
      sendText(res, 502, `Backend ${backendPort} is unavailable: ${err.message}`)
    } else {
      res.destroy(err)
    }
  })
  req.pipe(upstream)
}

function safeStaticPath(requestPath) {
  const decoded = decodeURIComponent(requestPath.split('?')[0] || '/')
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '')
  const candidate = path.join(staticRoot, normalized)
  if (!candidate.startsWith(staticRoot)) return null
  return candidate
}

function serveStatic(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  let filePath = safeStaticPath(url.pathname)
  if (!filePath) return sendText(res, 400, 'Invalid path')

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(staticRoot, 'index.html')
  }
  if (!fs.existsSync(filePath)) {
    return sendText(res, 503, 'frontend/dist is missing. Run ./deploy-local-bluegreen.sh frontend first.')
  }

  const ext = path.extname(filePath)
  res.writeHead(200, {
    'content-type': mimeTypes[ext] || 'application/octet-stream',
    'cache-control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
  })
  fs.createReadStream(filePath).pipe(res)
}

const server = http.createServer((req, res) => {
  const url = req.url || '/'
  if (url === '/local-proxy-healthz') {
    return sendText(res, 200, `ok backend=${activeBackendPort()}`)
  }
  if (url === '/healthz' || url.startsWith('/api/')) {
    return proxyRequest(req, res)
  }
  return serveStatic(req, res)
})

server.on('upgrade', (req, socket) => {
  socket.destroy()
})

server.listen(port, '0.0.0.0', () => {
  console.log(`local blue-green proxy listening on http://0.0.0.0:${port}`)
  console.log(`serving ${staticRoot}`)
})
