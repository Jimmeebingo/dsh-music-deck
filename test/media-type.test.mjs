import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

const source = fs.readFileSync(path.join(path.resolve(process.argv[2]), 'client.js'), 'utf8')
const helpers = source.slice(source.indexOf('function serviceOf('), source.indexOf('function hueOf('))
const { pickSession } = new Function(`${helpers}; return {pickSession}`)()
const video = { id: 'short-video-app.exe', status: 'playing', isCurrent: true, mediaType: 'video' }
const music = { id: 'unlisted-music-player.exe', status: 'playing', isCurrent: false, mediaType: 'music' }

test('system-declared music has priority even when its app name is not hardcoded', () => {
  assert.equal(pickSession([video, music], null).id, 'unlisted-music-player.exe')
})
test('an explicit user source still overrides automatic music priority', () => {
  assert.equal(pickSession([video, music], 'short-video-app.exe').id, 'short-video-app.exe')
})
test('a generic session remains selectable when it is the only source', () => {
  assert.equal(pickSession([music], null).id, 'unlisted-music-player.exe')
})

test('the current music source wins when two music sources are playing', () => {
  const qq = { id: 'QQMusic.exe', status: 'playing', mediaType: 'music', isCurrent: false }
  const netease = { id: 'cloudmusic.exe', status: 'playing', mediaType: 'music', isCurrent: true }
  assert.equal(pickSession([qq, netease], null).id, 'cloudmusic.exe')
})

test('declared music wins over a known app currently publishing video', () => {
  const knownVideo = { id: 'Spotify.exe', status: 'playing', mediaType: 'video', isCurrent: true }
  assert.equal(pickSession([knownVideo, music], null).id, 'unlisted-music-player.exe')
})
