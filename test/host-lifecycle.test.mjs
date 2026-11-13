import fs from 'node:fs'
import path from 'node:path'
import { EventEmitter } from 'node:events'

const rootIndex = process.argv.indexOf('--root')
if (rootIndex < 0 || !process.argv[rootIndex + 1]) {
  console.log(JSON.stringify({ results: [{ name: 'Root argument', status: 'ENV_ERROR', detail: 'Pass --root SOURCE_DIRECTORY.' }] }))
  process.exitCode = 2
} else {
  const root = path.resolve(process.argv[rootIndex + 1])
  const results = []
  const sourceFile = path.join(root, 'index.js')
  let importSequence = 0

  async function fixture() {
    if (process.platform !== 'win32') throw new Error('The production apply() is Windows-only; run this probe on Windows.')
    let source = fs.readFileSync(sourceFile, 'utf8')
    const replacements = [
      ["import { spawn } from 'node:child_process'", 'const spawn = globalThis.__reviewHost.spawn'],
      ["import fs from 'node:fs'", 'const fs = globalThis.__reviewHost.fs'],
      ['fileURLToPath(import.meta.url)', 'globalThis.__reviewHost.sourceFile'],
    ]
    for (const [before, after] of replacements) {
      if (!source.includes(before)) throw new Error(`Source adapter did not find ${before}; update the dependency-injection adapter.`)
      source = source.replace(before, after)
    }
    const children = []
    const spawnCalls = []
    const cleanups = []
    let killCalls = 0
    const fakeFs = {
      existsSync: () => true,
      mkdirSync: () => {},
      mkdtempSync: prefix => prefix + 'review-instance',
      rmSync: () => {},
    }
    const fakeSpawn = (command, args) => {
      const child = new EventEmitter()
      child.pid = 12345
      child.exitCode = null
      child.stderr = new EventEmitter()
      child.kill = () => { killCalls += 1; return true }
      children.push(child)
      spawnCalls.push({ command, args })
      return child
    }
    globalThis.__reviewHost = { fs: fakeFs, spawn: fakeSpawn, sourceFile }
    source += `\n// review-fixture-${++importSequence}\n`
    const imported = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
    imported.apply({
      effect: (effect) => { cleanups.push(effect()) },
      logger: { info() {}, warn() {} },
      webServer: { register: () => () => {} },
    })
    if (!children[0] || typeof cleanups[0] !== 'function') throw new Error('Production agent lifecycle did not initialize in the mock fixture.')
    return { children, spawnCalls, cleanup: cleanups[0], get killCalls() { return killCalls } }
  }

  async function check(name, run) {
    try {
      await run()
      results.push({ name, status: 'PASS', detail: '' })
    } catch (error) {
      results.push({ name, status: error.message.startsWith('ASSERTION: ') ? 'FAIL' : 'ENV_ERROR', detail: error.message })
    }
  }

  function assert(condition, message) {
    if (!condition) throw new Error(`ASSERTION: ${message}`)
  }

  await check('Agent shutdown must fall back when taskkill emits an asynchronous error', async () => {
    const f = await fixture()
    f.cleanup()
    if (!f.children[1]) {
      assert(f.killCalls > 0, 'Shutdown neither spawned a terminator nor killed the agent.')
      return
    }
    f.children[1].emit('error', Object.assign(new Error('spawn taskkill ENOENT'), { code: 'ENOENT' }))
    await new Promise(setImmediate)
    assert(f.killCalls > 0, `taskkill ENOENT left agent.kill() call count at ${f.killCalls}; expected a fallback.`)
  })

  await check('Agent shutdown must fall back when taskkill exits nonzero', async () => {
    const f = await fixture()
    f.cleanup()
    if (!f.children[1]) {
      assert(f.killCalls > 0, 'Shutdown neither spawned a terminator nor killed the agent.')
      return
    }
    f.children[1].exitCode = 1
    f.children[1].emit('exit', 1, null)
    f.children[1].emit('close', 1, null)
    await new Promise(setImmediate)
    assert(f.killCalls > 0, `taskkill exit 1 left agent.kill() call count at ${f.killCalls}; expected a fallback.`)
  })

  console.log(JSON.stringify({ results }))
  process.exitCode = results.some((item) => item.status === 'ENV_ERROR') ? 2 : results.some((item) => item.status === 'FAIL') ? 1 : 0
}
