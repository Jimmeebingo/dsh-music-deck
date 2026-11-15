import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { pathToFileURL } from 'node:url'
import test from 'node:test'

const root = path.resolve(process.argv[2])
const tempParent = path.join(import.meta.dirname, 'tmp')
fs.mkdirSync(tempParent, { recursive: true })

function plugin(t, release = '10.0.22631', sharedTemporary = null, verdict = undefined) {
  const temporary = sharedTemporary || fs.mkdtempSync(path.join(tempParent, 'host-check-'))
  let workDir = path.join(temporary, `dsh-music-deck-${process.pid}`)
  t.after(() => {
    assert.ok(temporary.startsWith(tempParent + path.sep))
    fs.rmSync(temporary, { recursive: true, force: true })
  })
  const spawns = []
  const spawn = (...args) => {
    spawns.push(args)
    const child = new EventEmitter()
    child.pid = 123456
    child.exitCode = null
    child.stderr = new EventEmitter()
    child.kill = () => true
    return child
  }
  const file = path.join(root, 'index.js')
  const source = fs.readFileSync(file, 'utf8')
    .replace(/^import .+$/gm, '')
    .replace(/\bexport (?=(?:const|function) )/g, '')
    .replaceAll('import.meta.url', JSON.stringify(pathToFileURL(file).href))
  const reads = []
  const { apply } = vm.runInNewContext(`(function(){${source}; return {apply};})()`, {
    fs: {
      ...fs,
      mkdtempSync(prefix) { workDir = fs.mkdtempSync(prefix); return workDir },
      readFileSync(target, ...rest) { reads.push(String(target)); return fs.readFileSync(target, ...rest) },
    },
    path, spawn, Buffer, URL, console, setTimeout, clearTimeout,
    os: { ...os, tmpdir: () => temporary, release: () => release },
    fileURLToPath: () => file,
    process: { platform: 'win32', pid: process.pid, env: { SystemRoot: 'C:\\Windows', WINDIR: 'C:\\Windows' } },
  })
  const routes = new Map()
  let start
  const seen = []
  // The host decides; these tests only prove the plugin asks and obeys the answer.
  const connection =
    verdict === 'missing'
      ? undefined
      : verdict === 'throwing'
        ? { requestRejection() { throw new Error('host check exploded') } }
        : {
            requestRejection(request) {
              seen.push(request)
              return typeof verdict === 'function' ? verdict(request) : verdict
            },
          }
  apply({
    logger: { info() {}, warn() {} },
    connection,
    webServer: { register(route) { routes.set(route.path, route.handler); return () => routes.delete(route.path) } },
    effect(effect, label) {
      if (label === 'music-deck: media agent') start = effect
      else effect()
    },
  })
  return { routes, workDir, spawns, start, seen, reads }
}

async function request(handler, value, headers = {}, method = 'POST', pathname = '/music-deck/cmd') {
  const req = new PassThrough()
  req.method = method
  req.url = pathname
  req.headers = { host: '127.0.0.1:3080', 'content-type': 'application/json', ...headers }
  const res = {
    status: null, body: '', raw: Buffer.alloc(0), headers: {},
    writeHead(status, extra) { this.status = status; Object.assign(this.headers, extra || {}) },
    end(body = '') {
      const chunk = Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf8')
      this.raw = Buffer.concat([this.raw, chunk])
      this.body += chunk.toString('utf8')
    },
  }
  const running = Promise.resolve(handler(req, res))
  req.end(method === 'GET' || method === 'HEAD' ? undefined : JSON.stringify(value))
  await running
  return { res, req }
}

const COVER = '/music-deck/cover?k=abcdef123456'

async function cover(app, verdictHeaders = {}) {
  return request(app.routes.get('/music-deck/cover'), undefined, verdictHeaders, 'GET', COVER)
}

// ---------------------------------------------------------------- allowed

test('same-origin JSON queues the exact requested app', async t => {
  const app = plugin(t)
  const { res } = await request(app.routes.get('/music-deck/cmd'), { action: 'next', app: 'cloudmusic.exe' }, { origin: 'http://127.0.0.1:3080' })
  assert.equal(res.status, 200)
  const commandDir = path.join(app.workDir, 'cmd')
  const names = fs.readdirSync(commandDir)
  assert.equal(names.length, 1)
  assert.equal(JSON.parse(fs.readFileSync(path.join(commandDir, names[0]), 'utf8')).app, 'cloudmusic.exe')
})

test('a foreign website cannot enqueue media commands', async t => {
  const app = plugin(t)
  const { res } = await request(app.routes.get('/music-deck/cmd'), { action: 'pause', app: 'cloudmusic.exe' }, { origin: 'https://untrusted.example' })
  assert.equal(res.status, 403)
  assert.equal(fs.existsSync(path.join(app.workDir, 'cmd')), false)
})

test('simple text POST cannot enqueue a browser CSRF command', async t => {
  const app = plugin(t)
  const { res } = await request(app.routes.get('/music-deck/cmd'), { action: 'pause' }, { 'content-type': 'text/plain' })
  assert.equal(res.status, 415)
  assert.equal(fs.existsSync(path.join(app.workDir, 'cmd')), false)
})

test('a host-allowed request without an Origin still works', async t => {
  const app = plugin(t)
  const { res } = await request(app.routes.get('/music-deck/cmd'), { action: 'next', app: 'cloudmusic.exe' })
  assert.equal(res.status, 200)
  assert.equal(app.seen.length, 1, 'the host check must run for the desktop bridge too')
})

test('opaque browser origins cannot submit commands even on loopback', async t => {
  const app = plugin(t)
  const { res } = await request(app.routes.get('/music-deck/cmd'), { action: 'pause' }, { origin: 'null' })
  assert.equal(res.status, 403)
})

test('opaque-origin commands are refused on a non-loopback host', async t => {
  const app = plugin(t)
  const { res } = await request(app.routes.get('/music-deck/cmd'), { action: 'pause' }, { host: '192.0.2.10:3080', origin: 'null' })
  assert.equal(res.status, 403)
})

test('diagnostic output is confined to the agent temporary directory', async t => {
  const app = plugin(t)
  const { res } = await request(app.routes.get('/music-deck/cmd'), { action: 'dump', path: 'C:\\Users\\Public\\unrelated.txt' })
  assert.equal(res.status, 200)
  const commands = path.join(app.workDir, 'cmd')
  const command = JSON.parse(fs.readFileSync(path.join(commands, fs.readdirSync(commands)[0]), 'utf8'))
  const target = path.resolve(command.path)
  assert.ok(target.startsWith(path.resolve(app.workDir) + path.sep), 'caller chose an arbitrary output path')
})

// ---------------------------------------------------------------- host verdicts

test('401 rejects a command before anything is queued', async t => {
  const app = plugin(t, '10.0.22631', null, 401)
  const { res } = await request(app.routes.get('/music-deck/cmd'), { action: 'next' })
  assert.equal(res.status, 401)
  assert.equal(res.body, 'unauthorized')
  assert.equal(res.headers['cache-control'], 'no-store')
  assert.equal(fs.existsSync(path.join(app.workDir, 'cmd')), false)
})

test('403 rejects a command before anything is queued', async t => {
  const app = plugin(t, '10.0.22631', null, 403)
  const { res } = await request(app.routes.get('/music-deck/cmd'), { action: 'pause' })
  assert.equal(res.status, 403)
  assert.equal(res.body, 'forbidden')
  assert.equal(fs.existsSync(path.join(app.workDir, 'cmd')), false)
})

test('a rejected state request is not counted and leaks no media data', async t => {
  let verdict = 401
  const app = plugin(t, '10.0.22631', null, request => verdict)
  const denied = await request(app.routes.get('/music-deck/state'), undefined, {}, 'GET', '/music-deck/state')
  assert.equal(denied.res.status, 401)
  assert.equal(denied.res.body, 'unauthorized')

  verdict = undefined
  const allowed = await request(app.routes.get('/music-deck/state'), undefined, {}, 'GET', '/music-deck/state')
  assert.equal(allowed.res.status, 200)
  assert.equal(JSON.parse(allowed.res.body).hits, 1, 'a rejected request must not advance the counter')
})

test('a rejected cover request never serves image bytes', async t => {
  const app = plugin(t, '10.0.22631', null, 403)
  fs.mkdirSync(app.workDir, { recursive: true })
  fs.writeFileSync(path.join(app.workDir, 'cover-abcdef123456.bin'), Buffer.from([0xff, 0xd8, 0xff, 0x00]))

  const { res } = await cover(app)
  assert.equal(res.status, 403)
  assert.equal(res.body, 'forbidden')
  assert.equal(res.headers['content-type'], 'text/plain; charset=utf-8')
})

test('the host check runs before the method check on every route', async t => {
  const app = plugin(t, '10.0.22631', null, 401)
  const head = await request(app.routes.get('/music-deck/cover'), undefined, {}, 'HEAD', COVER)
  const put = await request(app.routes.get('/music-deck/cmd'), {}, {}, 'PUT')
  const options = await request(app.routes.get('/music-deck/state'), undefined, {}, 'OPTIONS', '/music-deck/state')

  assert.equal(head.res.status, 401)
  assert.equal(put.res.status, 401)
  assert.equal(options.res.status, 401)
  assert.equal(app.seen.length, 3)
})

test('a missing connection service fails closed', async t => {
  const app = plugin(t, '10.0.22631', null, 'missing')
  const state = await request(app.routes.get('/music-deck/state'), undefined, {}, 'GET', '/music-deck/state')
  const cmd = await request(app.routes.get('/music-deck/cmd'), { action: 'next' })

  assert.equal(state.res.status, 500)
  assert.equal(cmd.res.status, 500)
  assert.equal(fs.existsSync(path.join(app.workDir, 'cmd')), false)
})

test('a throwing access check fails closed instead of falling through', async t => {
  const app = plugin(t, '10.0.22631', null, 'throwing')
  const { res } = await request(app.routes.get('/music-deck/cmd'), { action: 'next' })
  assert.equal(res.status, 500)
  assert.equal(fs.existsSync(path.join(app.workDir, 'cmd')), false)
})

test('an unexpected verdict is refused rather than treated as allowed', async t => {
  const app = plugin(t, '10.0.22631', null, 200)
  const { res } = await request(app.routes.get('/music-deck/cmd'), { action: 'next' })
  assert.equal(res.status, 500)
  assert.equal(fs.existsSync(path.join(app.workDir, 'cmd')), false)
})

test('the host check receives the original request object', async t => {
  const app = plugin(t)
  const { req } = await request(app.routes.get('/music-deck/state'), undefined, {}, 'GET', '/music-deck/state')
  assert.equal(app.seen.length, 1)
  assert.equal(app.seen[0], req)
  assert.equal(app.seen[0].url, '/music-deck/state')
})

test('an allowed cover miss is not cached', async t => {
  const app = plugin(t)
  const { res } = await cover(app)
  assert.equal(res.status, 404)
  assert.equal(res.headers['cache-control'], 'no-store')
})

test('an allowed cover request returns the stored image bytes', async t => {
  const app = plugin(t)
  fs.mkdirSync(app.workDir, { recursive: true })
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01])
  fs.writeFileSync(path.join(app.workDir, 'cover-abcdef123456.bin'), png)

  const { res } = await cover(app)
  assert.equal(res.status, 200)
  assert.equal(res.headers['content-type'], 'image/png')
  assert.deepEqual(res.raw, png)
  assert.equal(res.headers['cache-control'], 'private, max-age=604800, immutable')
})

// The matrix: every route answers allow / 401 / 403.

test('state covers allow, 401 and 403', async t => {
  let verdict
  const app = plugin(t, '10.0.22631', null, request => verdict)
  const call = () => request(app.routes.get('/music-deck/state'), undefined, {}, 'GET', '/music-deck/state')

  verdict = 403
  assert.equal((await call()).res.status, 403)
  verdict = 401
  assert.equal((await call()).res.status, 401)
  verdict = undefined
  assert.equal((await call()).res.status, 200)
})

test('cover covers allow, 401 and 403', async t => {
  let verdict
  const app = plugin(t, '10.0.22631', null, request => verdict)
  fs.mkdirSync(app.workDir, { recursive: true })
  fs.writeFileSync(path.join(app.workDir, 'cover-abcdef123456.bin'), Buffer.from([0xff, 0xd8, 0xff]))

  verdict = 401
  assert.equal((await cover(app)).res.status, 401)
  verdict = 403
  assert.equal((await cover(app)).res.status, 403)
  verdict = undefined
  assert.equal((await cover(app)).res.status, 200)
})

test('cmd covers allow, 401 and 403', async t => {
  let verdict
  const app = plugin(t, '10.0.22631', null, request => verdict)
  const call = () => request(app.routes.get('/music-deck/cmd'), { action: 'pause' })

  verdict = 401
  assert.equal((await call()).res.status, 401)
  verdict = 403
  assert.equal((await call()).res.status, 403)
  verdict = undefined
  assert.equal((await call()).res.status, 200)
})

// Rejections must not touch the work the handler would otherwise do.

test('a rejected state request never reads the state file', async t => {
  const app = plugin(t, '10.0.22631', null, 401)
  await request(app.routes.get('/music-deck/state'), undefined, {}, 'GET', '/music-deck/state')
  assert.deepEqual(app.reads.filter(entry => entry.includes('state.json')), [])

  const allowed = plugin(t)
  await request(allowed.routes.get('/music-deck/state'), undefined, {}, 'GET', '/music-deck/state')
  assert.ok(allowed.reads.some(entry => entry.includes('state.json')), 'the allowed path should read the state file')
})

test('a rejected cover request never reads the cover file', async t => {
  const app = plugin(t, '10.0.22631', null, 403)
  fs.mkdirSync(app.workDir, { recursive: true })
  fs.writeFileSync(path.join(app.workDir, 'cover-abcdef123456.bin'), Buffer.from([0xff, 0xd8, 0xff]))

  await cover(app)
  assert.deepEqual(app.reads.filter(entry => entry.includes('cover-')), [])
})

test('a rejected command never parses the request body', async t => {
  const app = plugin(t, '10.0.22631', null, 401)
  const req = new PassThrough()
  req.method = 'POST'
  req.url = '/music-deck/cmd'
  req.headers = { host: '127.0.0.1:3080', 'content-type': 'application/json' }
  let bodyReadAttempts = 0
  const originalOn = req.on
  req.on = function (event, ...args) {
    if (event === 'data' || event === 'end') bodyReadAttempts += 1
    return originalOn.call(this, event, ...args)
  }
  const res = {
    status: null,
    writeHead(status) { this.status = status },
    end() {},
  }
  const running = Promise.resolve(app.routes.get('/music-deck/cmd')(req, res))
  req.end('{ deliberately-invalid-json')
  await running
  assert.equal(res.status, 401)
  assert.equal(bodyReadAttempts, 0, 'a denied command must not start reading its body')
  assert.equal(fs.existsSync(path.join(app.workDir, 'cmd')), false)
})

// ---------------------------------------------------------------- lifecycle

test('Windows before build 17763 does not start an unsupported media worker', async t => {
  const app = plugin(t, '10.0.17134')
  app.start()
  const { res } = await request(app.routes.get('/music-deck/state'), undefined, {}, 'GET', '/music-deck/state')
  assert.equal(app.spawns.length, 0)
  assert.equal(JSON.parse(res.body).reason, 'unsupported-windows-version')
})

test('overlapping plugin instances cannot consume or overwrite each other commands', async t => {
  const temporary = fs.mkdtempSync(path.join(tempParent, 'host-shared-'))
  const first = plugin(t, '10.0.22631', temporary)
  const second = plugin(t, '10.0.22631', temporary)
  await request(first.routes.get('/music-deck/cmd'), { action: 'next', app: 'first.exe' })
  await request(second.routes.get('/music-deck/cmd'), { action: 'pause', app: 'second.exe' })
  const queuedApps = app => fs.readdirSync(path.join(app.workDir, 'cmd')).map(name => JSON.parse(fs.readFileSync(path.join(app.workDir, 'cmd', name), 'utf8')).app)
  assert.deepEqual(queuedApps(first), ['first.exe'])
  assert.deepEqual(queuedApps(second), ['second.exe'])
})
