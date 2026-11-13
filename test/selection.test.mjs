import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// Pull the pure selection helpers straight out of the shipped client so the
// test cannot drift from the real code.
const here = path.dirname(fileURLToPath(import.meta.url))
const source = readFileSync(path.join(here, '..', 'client.js'), 'utf8')
const start = source.indexOf('function serviceOf(')
const end = source.indexOf('function hueOf(')
if (start < 0 || end < 0) throw new Error('selection helpers not found in client.js')
const { serviceOf, appName, pickSession, isKnownService } = new Function(
  `${source.slice(start, end)}; return { serviceOf, appName, pickSession, isKnownService }`,
)()

const cases = []
const check = (name, actual, expected) => {
  cases.push({ name, ok: JSON.stringify(actual) === JSON.stringify(expected), actual, expected })
}

check('netease by id', serviceOf('cloudmusic.exe'), 'netease')
check('netease by process', serviceOf('com.netease.cloudmusic', 'cloudmusic'), 'netease')
check('netease camel id', serviceOf('NeteaseCloudMusic.exe'), 'netease')
check('qq', serviceOf('QQMusic.exe'), 'qq')
check('spotify', serviceOf('Spotify.exe'), 'spotify')
check('unknown', serviceOf('com.ss.android.ugc.aweme'), 'other')
check('empty', serviceOf(''), 'other')

check('appName package id', appName('com.ss.android.ugc.aweme'), 'aweme')
check('appName exe', appName('Douyin.exe'), 'Douyin')
check('appName aumid', appName('SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify'), 'Spotify')

const s = (id, status, isCurrent, process) => ({ id, status, isCurrent, process })

// The reported bug: a short-video app is "current" and playing, and a music
// player is playing too. The music player has to win.
check(
  'known music beats current short-video app',
  pickSession(
    [s('com.ss.android.ugc.aweme', 'playing', true), s('cloudmusic.exe', 'playing', false)],
    null,
  ).id,
  'cloudmusic.exe',
)
check(
  'stays on the picked source',
  pickSession(
    [s('com.ss.android.ugc.aweme', 'playing', true), s('cloudmusic.exe', 'paused', false)],
    'cloudmusic.exe',
  ).id,
  'cloudmusic.exe',
)
check('only session', pickSession([s('com.ss.android.ugc.aweme', 'paused', true)], null).id, 'com.ss.android.ugc.aweme')
check('empty list', pickSession([], null), null)
check('vanished pick', pickSession([s('spotify.exe', 'playing', true)], 'gone.exe').id, 'spotify.exe')
check('known flag', isKnownService(s('QQMusic.exe', 'paused', false)), true)

let failed = 0
for (const item of cases) {
  if (!item.ok) failed += 1
  const actual = JSON.stringify(item.actual)
  console.log(`${item.ok ? 'ok  ' : 'FAIL'}  ${item.name} -> ${actual}${item.ok ? '' : ` (expected ${JSON.stringify(item.expected)})`}`)
}
console.log(failed === 0 ? `\nall ${cases.length} checks passed` : `\n${failed} of ${cases.length} failed`)
process.exitCode = failed === 0 ? 0 : 1