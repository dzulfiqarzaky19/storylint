import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

const storePath = 'src/server/store.ts'
const testPath = 'src/server/server.test.ts'
const orig = fs.readFileSync(storePath, 'utf8')
const needle = `} catch (error) {
      await unlink(temporary).catch(() => undefined)
      throw error
    }`
const replacement = `} catch (error) {
      await unlink(temporary).catch(() => undefined)
      if (error && typeof error === 'object' && 'code' in error && error.code === 'EPERM') return
      throw error
    }`
if (!orig.includes(needle)) {
  console.error('needle missing')
  process.exit(2)
}
fs.writeFileSync(storePath, orig.replace(needle, replacement))
const r = spawnSync(
  process.execPath,
  ['--experimental-strip-types', '--test-name-pattern', 'failed atomic rename', '--test', testPath],
  { encoding: 'utf8' },
)
process.stdout.write(r.stdout || '')
process.stderr.write(r.stderr || '')
fs.writeFileSync(storePath, orig)
console.log('EXIT', r.status)
process.exit(r.status === 1 ? 0 : 3)
