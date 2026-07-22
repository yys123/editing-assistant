import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile('src/AuthContext.tsx', 'utf8')

assert.doesNotMatch(
  source,
  /apiFetch\(['"]\/api\/auth\/me['"]\)/,
  'Auth bootstrap should not use apiFetch because apiFetch reloads on 401 before loading can settle',
)
assert.match(
  source,
  /fetch\(['"]\/api\/auth\/me['"]/,
  'Auth bootstrap should fetch /api/auth/me directly and handle 401 locally',
)
assert.match(source, /finally\(\(\) => setLoading\(false\)\)/)

console.log('AuthContext tests passed')
