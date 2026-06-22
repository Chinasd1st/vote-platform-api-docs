import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function loadFile(path) {
  return yaml.load(readFileSync(path, 'utf-8'))
}

function resolveRef(basePath, ref) {
  const [file, pointer] = ref.split('#')
  const filePath = resolve(dirname(basePath), file)
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

function resolveAllRefs(obj, basePath, visited = new Set()) {
  if (!obj || typeof obj !== 'object') return obj

  if (obj.$ref) {
    const key = `${basePath}#${obj.$ref}`
    if (visited.has(key)) return { description: '(circular reference)' }
    visited.add(key)

    const resolved = resolveRef(basePath, obj.$ref)
    const refFile = obj.$ref.split('#')[0]
    const refBase = refFile.startsWith('.') ? resolve(dirname(basePath), refFile) : basePath
    return resolveAllRefs(resolved, refBase, visited)
  }

  if (Array.isArray(obj)) {
    return obj.map((item, i) => {
      const itemPath = `${basePath}[${i}]`
      return resolveAllRefs(item, itemPath, visited)
    })
  }

  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    result[key] = resolveAllRefs(value, basePath, visited)
  }
  return result
}

const specPath = resolve(root, 'openapi.yaml')
const spec = loadFile(specPath)
const bundled = resolveAllRefs(spec, specPath)

// Remove $ref if any remain at top level of components
if (bundled.components?.schemas) {
  for (const [key, value] of Object.entries(bundled.components.schemas)) {
    if (value && typeof value === 'object' && value.$ref) {
      bundled.components.schemas[key] = resolveAllRefs(value, specPath)
    }
  }
}

const outPath = process.argv[2] || resolve(root, 'openapi.json')
writeFileSync(outPath, JSON.stringify(bundled, null, 2))
console.log(`✅ Bundled to ${outPath}`)
