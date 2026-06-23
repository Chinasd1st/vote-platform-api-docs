import { readFileSync, writeFileSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const cache = new Map()

function loadFile(filePath) {
  const s = statSync(filePath)
  if (!s.isFile()) throw new Error(`EISDIR: tried to read a directory: ${filePath}`)
  return yaml.load(readFileSync(filePath, 'utf-8'))
}

function resolveRef(basePath, ref) {
  const hashIndex = ref.indexOf('#')
  const file = hashIndex >= 0 ? ref.slice(0, hashIndex) : ''
  const pointer = hashIndex >= 0 ? ref.slice(hashIndex + 1) : ''

  const filePath = file ? resolve(dirname(basePath), file) : basePath
  const data = loadFile(filePath)

  if (!pointer) return data

  const parts = pointer.split('/').filter(Boolean)
  let current = data
  for (const part of parts) {
    const decoded = part.replace(/~1/g, '/').replace(/~0/g, '~')
    current = current?.[decoded]
  }
  return current
}

function resolveAllRefs(obj, basePath, depth = 0) {
  if (!obj || typeof obj !== 'object') return obj
  if (depth > 50) return obj

  if (obj.$ref) {
    const key = `${resolve(dirname(basePath), obj.$ref.split('#')[0] || '.')}#${obj.$ref.split('#')[1] || ''}`
    if (cache.has(key)) return cache.get(key)
    cache.set(key, obj)

    const resolved = resolveRef(basePath, obj.$ref)
    if (resolved === undefined || resolved === null) return obj

    const hashIndex = obj.$ref.indexOf('#')
    const file = hashIndex >= 0 ? obj.$ref.slice(0, hashIndex) : ''
    const refBase = file ? resolve(dirname(basePath), file) : basePath

    const result = resolveAllRefs(resolved, refBase, depth + 1)
    cache.set(key, result)
    return result
  }

  if (Array.isArray(obj)) {
    return obj.map((item, i) => resolveAllRefs(item, `${basePath}[${i}]`, depth + 1))
  }

  const result = {}
  for (const [k, v] of Object.entries(obj)) {
    result[k] = resolveAllRefs(v, basePath, depth + 1)
  }
  return result
}

const specPath = resolve(root, 'openapi.yaml')
const spec = loadFile(specPath)
const bundled = resolveAllRefs(spec, specPath)

const outPath = process.argv[2] || resolve(root, 'openapi.json')
writeFileSync(outPath, JSON.stringify(bundled, null, 2))
console.log(`✅ Bundled to ${outPath}`)
