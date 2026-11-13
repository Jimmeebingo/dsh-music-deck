import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const source = fs.readFileSync(path.join(path.resolve(process.argv[2]), 'client.js'), 'utf8')
const helpers = source.slice(source.indexOf('function serviceOf('), source.indexOf('function hueOf('))
const { canControl } = new Function(`${helpers}; return {canControl:typeof canControl==='function'?canControl:null}`)()
for (const [label, session, action, expected] of [
  ['no source', null, 'play', false],
  ['legacy source', { id: 'player.exe' }, 'play', true],
  ['seek unavailable', { controls: { seek: false } }, 'seek', false],
  ['next supported', { controls: { next: true } }, 'next', true],
  ['pause unavailable', { controls: { pause: false } }, 'pause', false],
]) {
  test(`media control capability: ${label}`, () => {
    assert.equal(typeof canControl, 'function', 'control capability handling is missing')
    assert.equal(canControl(session, action), expected)
  })
}
