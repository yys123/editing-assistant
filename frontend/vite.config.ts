import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function backendTarget() {
  if (process.env.DEV_BACKEND_TARGET) return process.env.DEV_BACKEND_TARGET
  if (process.env.DEV_BACKEND_PORT) return `http://127.0.0.1:${process.env.DEV_BACKEND_PORT}`

  const activeSlotFile = path.resolve(__dirname, '..', 'deploy', 'local-runtime', 'active_backend_slot')
  const bluePort = Number(process.env.BACKEND_BLUE_PORT || 8101)
  const greenPort = Number(process.env.BACKEND_GREEN_PORT || 8102)
  let slot = 'blue'
  try {
    slot = fs.readFileSync(activeSlotFile, 'utf8').trim()
  } catch {
    // Match the local blue-green proxy default on first run.
  }
  return `http://127.0.0.1:${slot === 'green' ? greenPort : bluePort}`
}

const apiTarget = backendTarget()

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5175,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
})
