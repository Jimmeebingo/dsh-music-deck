import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const run = (file, args) => execFileSync(file, args, { cwd: root, stdio: 'inherit' })
run(process.execPath, [path.join(root, 'test/selection.test.mjs')])
run(process.execPath, [path.join(root, 'test/media-type.test.mjs'), root])
run(process.execPath, [path.join(root, 'test/capabilities.test.mjs'), root])
run(process.execPath, [path.join(root, 'test/host-boundaries.test.mjs'), root])
if (process.platform === 'win32') {
  const powershell = path.join(process.env.SystemRoot || process.env.WINDIR || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe')
  run(powershell, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'test/Review-Compatibility.ps1'), '-Root', root, '-NodePath', process.execPath])
} else {
  console.log('Windows native regression tests require Windows PowerShell 5.1.')
}
