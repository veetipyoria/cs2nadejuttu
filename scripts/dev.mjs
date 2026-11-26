// `npm run dev` at the repo root: starts the API (server/) and the website (web/) together,
// with each line of output labelled. Ctrl+C stops both; if either one exits, the other stops too.
import { spawn } from 'node:child_process'

const services = [
  { name: 'api', dir: 'server', color: '\x1b[35m' },
  { name: 'web', dir: 'web', color: '\x1b[36m' },
]
const reset = '\x1b[0m'
const children = []
let stopping = false

function stopAll(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) {
    if (child.exitCode !== null) continue
    // npm runs through a shell on Windows, so stop the whole process tree there.
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'])
    else child.kill('SIGTERM')
  }
  setTimeout(() => process.exit(code), 500)
}

for (const { name, dir, color } of services) {
  const child = spawn('npm', ['run', 'dev'], {
    cwd: new URL(`../${dir}/`, import.meta.url),
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const label = `${color}[${name}]${reset} `
  for (const stream of [child.stdout, child.stderr]) {
    let buffered = ''
    stream.on('data', (chunk) => {
      buffered += chunk
      const lines = buffered.split(/\r?\n/)
      buffered = lines.pop() ?? ''
      for (const line of lines) process.stdout.write(label + line + '\n')
    })
  }
  child.on('exit', (code) => {
    if (!stopping) {
      process.stdout.write(`${label}stopped (exit code ${code}), stopping the other one too\n`)
      stopAll(code ?? 1)
    }
  })
  children.push(child)
}

process.on('SIGINT', () => stopAll(0))
process.on('SIGTERM', () => stopAll(0))
