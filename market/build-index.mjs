import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Regenerates market/index.json from package.json and the repository.
// Run it after a release commit:  node market/build-index.mjs
//
// The package is published on npm, so the index points at the registry and
// installs with `dsh-music-deck@<version>` — no git on the user's machine.
// Pass `--git` to pin a repository commit instead.

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const useGit = process.argv.includes('--git')

function normalize(raw) {
  return raw
    .trim()
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/^ssh:\/\/git@/, 'https://')
    .replace(/^git@([^:]+):/, 'https://$1/')
    .replace(/\.git$/, '')
}

function resolveRepoUrl() {
  const arg = process.argv.slice(2).find((value) => !value.startsWith('--'))
  if (arg) return normalize(arg)
  try {
    return normalize(execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: root, encoding: 'utf8' }))
  } catch {
    throw new Error('no git remote named origin; pass the repository URL as an argument')
  }
}

const url = resolveRepoUrl()
const slug = url.replace(/^https:\/\/[^/]+\//, '')
const commit = useGit ? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim() : null
if (useGit && !/^[0-9a-f]{40}$/.test(commit)) throw new Error(`unexpected commit: ${commit}`)

const index = {
  format: 1,
  title: { en: 'Music deck', zh: '音乐台' },
  plugins: [
    {
      name: pkg.name,
      title: { en: 'Music deck', zh: '音乐台' },
      description: {
        en: pkg.description,
        zh: '悬浮播放器，读取 QQ音乐、网易云音乐、Spotify 的系统媒体会话。',
      },
      icon: `https://raw.githubusercontent.com/${slug}/main/icon.svg`,
      homepage: `${url}#readme`,
      repository: { url },
      metadata: {
        keywords: pkg.keywords.filter((keyword) => keyword !== 'dsh' && keyword !== 'dsh-plugin'),
      },
      versions: [
        {
          version: pkg.version,
          publishTimestamp: Math.floor(Date.now() / 1000),
          source: useGit ? { type: 'git', url, commit } : { type: 'npm' },
        },
      ],
    },
  ],
}

const target = path.join(here, 'index.json')
writeFileSync(target, `${JSON.stringify(index, null, 2)}\n`, 'utf8')
console.log(`wrote ${target}`)
console.log(`  ${pkg.name}@${pkg.version} -> ${useGit ? `${url}#${commit.slice(0, 7)}` : 'npm registry'}`)