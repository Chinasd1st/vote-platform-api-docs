import { readFileSync } from 'node:fs'
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

function validateRefs(obj, basePath, path = '') {
  const errors = []

  if (!obj || typeof obj !== 'object') return errors

  if (obj.$ref) {
    try {
      const resolved = resolveRef(basePath, obj.$ref)
      if (resolved === undefined) {
        errors.push(`❌ Unresolved $ref: ${obj.$ref} at ${path}`)
      }
    } catch (e) {
      errors.push(`❌ Invalid $ref: ${obj.$ref} at ${path} - ${e.message}`)
    }
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      errors.push(...validateRefs(item, basePath, `${path}[${i}]`))
    })
  } else {
    for (const [key, value] of Object.entries(obj)) {
      errors.push(...validateRefs(value, basePath, `${path}.${key}`))
    }
  }

  return errors
}

const specPath = resolve(root, 'openapi.yaml')
const spec = loadFile(specPath)

const errors = validateRefs(spec, specPath)

if (errors.length > 0) {
  console.log('\n❌ Validation failed:\n')
  errors.forEach(e => console.log(e))
  process.exit(1)
} else {
  console.log('✅ OpenAPI spec is valid!')
}
