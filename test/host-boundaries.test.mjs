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

function plugin(t, release = '10.0.22631', sharedTemporary = null) {
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
  const { apply } = vm.runInNewContext(`(function(){${source}; return {apply};})()`, {
    fs: { ...fs, mkdtempSync(prefix) { workDir = fs.mkdtempSync(prefix); return workDir } },
    path, spawn, Buffer, URL, console, setTimeout, clearTimeout,
    os: { ...os, tmpdir: () => temporary, release: () => release },
    fileURLToPath: () => file,
    process: { platform: 'win32', pid: process.pid, env: { SystemRoot: 'C:\\Windows', WINDIR: 'C:\\Windows' } },
  })
  const routes = new Map()
  let start
  apply({
    logger: { info() {}, warn() {} },
    webServer: { register(route) { routes.set(route.path, route.handler); return () => routes.delete(route.path) } },
    effect(effect, label) {
      if (label === 'music-deck: media agent') start = effect
      else effect()
    },
  })
  return { routes, workDir, spawns, start }
}

async function request(handler, value, headers = {}, method = 'POST') {
  const req = new PassThrough()
  req.method = method
  req.url = '/music-deck/cmd'
  req.headers = { host: '127.0.0.1:3080', 'content-type': 'application/json', ...headers }
  const res = {
    status: null, body: '',
    writeHead(status) { this.status = status },
    end(body = '') { this.body += body },
  }
  const running = Promise.resolve(handler(req, res))
  req.end(method === 'GET' ? undefined : JSON.stringify(value))
  await running
  return res
}

test('same-origin JSON queues the exact requested app', async t => {
  const app = plugin(t)
  const res = await request(app.routes.get('/music-deck/cmd'), { action: 'next', app: 'cloudmusic.exe' }, { origin: 'http://127.0.0.1:3080' })
  assert.equal(res.status, 200)
  const commandDir = path.join(app.workDir, 'cmd')
  const names = fs.readdirSync(commandDir)
  assert.equal(names.length, 1)
  assert.equal(JSON.parse(fs.readFileSync(path.join(commandDir, names[0]), 'utf8')).app, 'cloudmusic.exe')
})

test('a foreign website cannot enqueue media commands', async t => {
  const app = plugin(t)
  const res = await request(app.routes.get('/music-deck/cmd'), { action: 'pause', app: 'cloudmusic.exe' }, { origin: 'https://untrusted.example' })
  assert.equal(res.status, 403)
  assert.equal(fs.existsSync(path.join(app.workDir, 'cmd')), false)
})

test('simple text POST cannot enqueue a browser CSRF command', async t => {
  const app = plugin(t)
  const res = await request(app.routes.get('/music-deck/cmd'), { action: 'pause' }, { 'content-type': 'text/plain' })
  assert.equal(res.status, 415)
  assert.equal(fs.existsSync(path.join(app.workDir, 'cmd')), false)
})

test('the DSH desktop IPC bridge can forward JSON without an Origin header', async t => {
  const app = plugin(t)
  const res = await request(app.routes.get('/music-deck/cmd'), { action: 'next', app: 'cloudmusic.exe' })
  assert.equal(res.status, 200)
})

test('opaque browser origins cannot submit commands even on loopback', async t => {
  const app = plugin(t)
  const res = await request(app.routes.get('/music-deck/cmd'), { action: 'pause' }, { origin: 'null' })
  assert.equal(res.status, 403)
})

test('opaque-origin commands are refused on a non-loopback host', async t => {
  const app = plugin(t)
  const res = await request(app.routes.get('/music-deck/cmd'), { action: 'pause' }, { host: '192.0.2.10:3080', origin: 'null' })
  assert.equal(res.status, 403)
})

test('diagnostic output is confined to the agent temporary directory', async t => {
  const app = plugin(t)
  const res = await request(app.routes.get('/music-deck/cmd'), { action: 'dump', path: 'C:\\Users\\Public\\unrelated.txt' })
  assert.equal(res.status, 200)
  const commands = path.join(app.workDir, 'cmd')
  const command = JSON.parse(fs.readFileSync(path.join(commands, fs.readdirSync(commands)[0]), 'utf8'))
  const target = path.resolve(command.path)
  assert.ok(target.startsWith(path.resolve(app.workDir) + path.sep), 'caller chose an arbitrary output path')
})

test('Windows before build 17763 does not start an unsupported media worker', async t => {
  const app = plugin(t, '10.0.17134')
  app.start()
  const res = await request(app.routes.get('/music-deck/state'), undefined, {}, 'GET')
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
