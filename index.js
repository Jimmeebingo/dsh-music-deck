import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Host half of the music deck bundle.
 *
 * It owns one long-lived PowerShell agent that reads the Windows system media
 * sessions (SMTC) shared by QQ Music, NetEase Cloud Music and Spotify, and
 * exposes that state over two local routes the browser half polls:
 *
 *   GET  /music-deck/state  -> the last media snapshot
 *   POST /music-deck/cmd    -> a transport command for the agent
 *   GET  /music-deck/cover  -> the album art of one track
 */

export const inject = ['webServer']

const HERE = path.dirname(fileURLToPath(import.meta.url))
const AGENT_SCRIPT = path.join(HERE, 'agent', 'smtc.ps1')

const ACTIONS = new Set(['play', 'pause', 'toggle', 'next', 'prev', 'seek', 'volume', 'mute', 'dump'])

function readJsonBody(request, limit = 8192) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    request.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('request body too large'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => {
      try {
        resolve(chunks.length === 0 ? {} : JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('invalid JSON body'))
      }
    })
    request.on('error', reject)
  })
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  })
  response.end(body)
}

/** Replace a file without letting a reader observe a half-written JSON document. */
function writeAtomic(target, text) {
  const temporary = `${target}.${process.pid}.tmp`
  fs.writeFileSync(temporary, text, 'utf8')
  fs.renameSync(temporary, target)
}

/** Identify the artwork format from its magic bytes; the agent stores raw bytes. */
function imageType(bytes) {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  if (bytes.length > 12 && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  if (bytes.length > 6 && bytes.toString('ascii', 0, 3) === 'GIF') return 'image/gif'
  return 'application/octet-stream'
}

export function apply(ctx) {
  if (process.platform !== 'win32') {
    ctx.logger?.info?.('music-deck: system media sessions are only available on Windows')
    return
  }

  const workDir = path.join(os.tmpdir(), `dsh-music-deck-${process.pid}`)
  const stateFile = path.join(workDir, 'state.json')
  const cmdDir = path.join(workDir, 'cmd')
  const aliveFile = path.join(workDir, 'alive')

  let child = null
  let disposed = false
  let restartTimer = null
  let lastFailure = ''
  let stateRequests = 0
  let commandSeq = 0
  let lastCommand = null

  function readState() {
    let payload
    try {
      payload = JSON.parse(fs.readFileSync(stateFile, 'utf8'))
    } catch {
      payload = { ok: false, reason: child === null ? 'agent-stopped' : 'agent-warming-up' }
    }

    let beat = 0
    try {
      beat = fs.statSync(aliveFile).mtimeMs
    } catch {
      beat = 0
    }
    const live = beat > 0 && Date.now() - beat < 4000

    return { ...payload, agent: live ? 'live' : 'stale', failure: lastFailure || undefined }
  }

  function startAgent() {
    if (disposed) return
    lastFailure = ''
    fs.mkdirSync(workDir, { recursive: true })

    child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', AGENT_SCRIPT, '-Dir', workDir],
      { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
    )

    const current = child
    current.stderr?.on('data', (chunk) => {
      const text = String(chunk).trim()
      if (text) {
        lastFailure = text.split('\n').slice(-1)[0].slice(0, 300)
        ctx.logger?.warn?.(`music-deck agent: ${text.slice(0, 400)}`)
      }
    })

    current.on('error', (error) => {
      lastFailure = `spawn failed: ${error.message}`
      ctx.logger?.warn?.(`music-deck: cannot start the media agent: ${error.message}`)
    })

    current.on('exit', (code) => {
      if (child === current) child = null
      if (disposed) return
      ctx.logger?.warn?.(`music-deck agent exited (code ${code}); restarting`)
      restartTimer = setTimeout(startAgent, 1500)
    })
  }

  function stopAgent() {
    if (restartTimer !== null) {
      clearTimeout(restartTimer)
      restartTimer = null
    }
    const current = child
    child = null
    if (current && current.exitCode === null) {
      try {
        spawn('taskkill', ['/pid', String(current.pid), '/T', '/F'], { windowsHide: true }).on('error', () => {})
      } catch {
        current.kill()
      }
    }
  }

  ctx.effect(() => {
    startAgent()
    return () => {
      disposed = true
      stopAgent()
      try {
        fs.rmSync(workDir, { recursive: true, force: true })
      } catch {
        /* best effort */
      }
    }
  }, 'music-deck: media agent')

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: '/music-deck/state',
        handler: (request, response) => {
          if (request.method !== 'GET') {
            response.writeHead(405, { allow: 'GET' })
            response.end()
            return
          }
          stateRequests += 1
          sendJson(response, 200, { ...readState(), hits: stateRequests, lastCommand })
        },
      }),
    'music-deck: state route',
  )

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: '/music-deck/cover',
        handler: (request, response) => {
          if (request.method !== 'GET') {
            response.writeHead(405, { allow: 'GET' })
            response.end()
            return
          }

          let key = ''
          try {
            key = new URL(request.url, 'http://127.0.0.1').searchParams.get('k') ?? ''
          } catch {
            key = ''
          }
          if (!/^[a-f0-9]{12}$/.test(key)) {
            response.writeHead(400)
            response.end()
            return
          }

          let bytes
          try {
            bytes = fs.readFileSync(path.join(workDir, `cover-${key}.bin`))
          } catch {
            response.writeHead(404)
            response.end()
            return
          }
          response.writeHead(200, {
            'content-type': imageType(bytes),
            'content-length': bytes.length,
            // The key is the content hash of the track, so one key never changes.
            'cache-control': 'public, max-age=604800, immutable',
          })
          response.end(bytes)
        },
      }),
    'music-deck: cover route',
  )

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: '/music-deck/cmd',
        handler: async (request, response) => {
          if (request.method !== 'POST') {
            response.writeHead(405, { allow: 'POST' })
            response.end()
            return
          }
          let body
          try {
            body = await readJsonBody(request)
          } catch (error) {
            sendJson(response, 400, { ok: false, error: error.message })
            return
          }

          const action = String(body.action ?? '')
          if (!ACTIONS.has(action)) {
            sendJson(response, 400, { ok: false, error: `unknown action "${action}"` })
            return
          }

          const command = { action }
          if (typeof body.app === 'string' && body.app) command.app = body.app.slice(0, 200)
          if (action === 'seek') {
            const position = Number(body.position)
            if (!Number.isFinite(position) || position < 0) {
              sendJson(response, 400, { ok: false, error: 'seek needs a position in milliseconds' })
              return
            }
            command.position = Math.round(position)
          }
          if (action === 'volume') {
            const level = Number(body.level)
            if (!Number.isFinite(level)) {
              sendJson(response, 400, { ok: false, error: 'volume needs a level between 0 and 1' })
              return
            }
            command.level = Math.min(1, Math.max(0, level))
          }
          if (action === 'mute') {
            if (typeof body.muted !== 'boolean') {
              sendJson(response, 400, { ok: false, error: 'mute needs a boolean muted flag' })
              return
            }
            command.muted = body.muted
          }
          if (typeof body.exclusive === 'boolean') command.exclusive = body.exclusive
          if (action === 'dump') {
            if (typeof body.path !== 'string' || !body.path) {
              sendJson(response, 400, { ok: false, error: 'dump needs a target path' })
              return
            }
            command.path = body.path
          }

          try {
            fs.mkdirSync(cmdDir, { recursive: true })
            // One file per command: the agent drains the queue, so rapid clicks
            // are never collapsed into a single write.
            commandSeq += 1
            const name = `cmd-${String(Date.now()).padStart(13, '0')}-${String(commandSeq).padStart(5, '0')}.json`
            writeAtomic(path.join(cmdDir, name), JSON.stringify(command))
            lastCommand = { ...command, seq: commandSeq, at: Date.now() }
          } catch (error) {
            sendJson(response, 500, { ok: false, error: `cannot reach the media agent: ${error.message}` })
            return
          }
          sendJson(response, 200, { ok: true })
        },
      }),
    'music-deck: command route',
  )
}