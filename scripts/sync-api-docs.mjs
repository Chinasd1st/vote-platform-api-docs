/**
 * sync-api-docs.mjs
 *
 * 从 vote-platform 源码自动生成 OpenAPI 规范
 *
 * 用法：
 *   node scripts/sync-api-docs.mjs [source-dir] [output-dir]
 *
 * 默认：
 *   node scripts/sync-api-docs.mjs ../vote-platform ./schemas
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, relative, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const SOURCE_DIR = process.argv[2] || join(ROOT, '..', 'vote-platform')
const OUTPUT_DIR = process.argv[3] || join(ROOT, 'schemas')

// ── 读取 Zod schemas ─────────────────────────────────────────────────────────
function readZodSchemas() {
  const apiTsPath = join(SOURCE_DIR, 'src', 'types', 'api.ts')
  const content = readFileSync(apiTsPath, 'utf-8')

  const schemas = {}

  // 提取所有 z.object 定义
  const objectRegex = /export const (\w+Schema) = z\.object\(\{([\s\S]*?)\}\)/g
  let match

  while ((match = objectRegex.exec(content)) !== null) {
    const name = match[1]
    const body = match[2]

    const fields = parseZodFields(body)
    schemas[name] = {
      type: 'object',
      properties: fields.properties,
      required: fields.required,
    }
  }

  return schemas
}

// ── 解析 Zod 字段 ────────────────────────────────────────────────────────────
function parseZodFields(body) {
  const properties = {}
  const required = []

  // 简化解析：逐行分析
  const lines = body.split('\n')
  let currentField = null
  let currentType = null
  let depth = 0

  for (const line of lines) {
    const trimmed = line.trim()

    // 匹配字段名: value:
    const fieldMatch = trimmed.match(/^(\w+):\s*(.*)$/)
    if (fieldMatch && depth === 0) {
      currentField = fieldMatch[1]
      const value = fieldMatch[2]
      const result = inferOpenAPIType(value)
      if (result) {
        properties[currentField] = result.schema
        if (result.required) required.push(currentField)
      }
      currentField = null
    }
  }

  return { properties, required }
}

// ── 推断 OpenAPI 类型 ────────────────────────────────────────────────────────
function inferOpenAPIType(zodExpr) {
  const expr = zodExpr.trim()

  // string
  if (expr.startsWith('z.string()')) {
    const schema = { type: 'string' }
    const required = !expr.includes('.optional()') && !expr.includes('.nullable()')
    if (expr.includes('.email()')) schema.format = 'email'
    if (expr.includes('.uuid()')) schema.format = 'uuid'
    if (expr.includes('.url()')) schema.format = 'uri'
    if (expr.includes('.datetime()')) schema.format = 'date-time'

    const minMatch = expr.match(/\.min\((\d+)/)
    if (minMatch) schema.minLength = parseInt(minMatch[1])
    const maxMatch = expr.match(/\.max\((\d+)/)
    if (maxMatch) schema.maxLength = parseInt(maxMatch[1])

    if (expr.includes('.optional()') || expr.includes('.nullable()')) {
      return { schema: { oneOf: [schema, { type: 'null' }] }, required: false }
    }
    return { schema, required }
  }

  // number
  if (expr.startsWith('z.number()') || expr.startsWith('z.coerce.number()')) {
    const schema = { type: 'integer' }
    const required = !expr.includes('.optional()')
    if (expr.includes('.int()')) schema.type = 'integer'

    const minMatch = expr.match(/\.min\((\d+)/)
    if (minMatch) schema.minimum = parseInt(minMatch[1])
    const maxMatch = expr.match(/\.max\((\d+)/)
    if (maxMatch) schema.maximum = parseInt(maxMatch[1])

    const defaultMatch = expr.match(/\.default\((\d+)\)/)
    if (defaultMatch) schema.default = parseInt(defaultMatch[1])

    if (expr.includes('.optional()')) {
      return { schema: { oneOf: [schema, { type: 'null' }] }, required: false }
    }
    return { schema, required }
  }

  // boolean
  if (expr.startsWith('z.boolean()')) {
    const schema = { type: 'boolean' }
    const defaultMatch = expr.match(/\.default\((true|false)\)/)
    if (defaultMatch) schema.default = defaultMatch[1] === 'true'
    const required = !expr.includes('.optional()')
    if (expr.includes('.optional()')) {
      return { schema: { oneOf: [schema, { type: 'null' }] }, required: false }
    }
    return { schema, required }
  }

  // enum
  if (expr.includes('z.enum([')) {
    const enumMatch = expr.match(/z\.enum\(\[(.*?)\]\)/)
    if (enumMatch) {
      const values = enumMatch[1].split(',').map(v => v.trim().replace(/['"]/g, ''))
      const schema = { type: 'string', enum: values }
      const required = !expr.includes('.optional()')

      const defaultMatch = expr.match(/\.default\(['"]?(\w+)['"]?\)/)
      if (defaultMatch) schema.default = defaultMatch[1]

      if (expr.includes('.optional()') || expr.includes('.nullable()')) {
        return { schema: { oneOf: [schema, { type: 'null' }] }, required: false }
      }
      return { schema, required }
    }
  }

  // array
  if (expr.includes('z.array(')) {
    const itemType = expr.includes('z.string()') ? { type: 'string' } : { type: 'string' }
    const schema = { type: 'array', items: itemType }

    const minMatch = expr.match(/\.min\((\d+)/)
    if (minMatch) schema.minItems = parseInt(minMatch[1])
    const maxMatch = expr.match(/\.max\((\d+)/)
    if (maxMatch) schema.maxItems = parseInt(maxMatch[1])

    const required = !expr.includes('.optional()')
    if (expr.includes('.optional()')) {
      return { schema: { oneOf: [schema, { type: 'null' }] }, required: false }
    }
    return { schema, required }
  }

  // null 或 nullable
  if (expr.includes('z.null()') || expr.includes('.nullable()')) {
    return { schema: { type: 'null' }, required: false }
  }

  return null
}

// ── 扫描路由文件 ─────────────────────────────────────────────────────────────
function scanRoutes(dir) {
  const routes = []

  function walk(currentDir) {
    const entries = readdirSync(currentDir)

    for (const entry of entries) {
      const fullPath = join(currentDir, entry)
      const stat = statSync(fullPath)

      if (stat.isDirectory()) {
        walk(fullPath)
      } else if (entry === 'route.ts') {
        const route = parseRouteFile(fullPath)
        if (route) routes.push(route)
      }
    }
  }

  walk(dir)
  return routes
}

// ── 解析路由文件 ─────────────────────────────────────────────────────────────
function parseRouteFile(filePath) {
  const content = readFileSync(filePath, 'utf-8')

  // 提取 HTTP 方法
  const methods = []
  if (content.includes('export async function GET')) methods.push('get')
  if (content.includes('export async function POST')) methods.push('post')
  if (content.includes('export async function PUT')) methods.push('put')
  if (content.includes('export async function DELETE')) methods.push('delete')

  if (methods.length === 0) return null

  // 推断路径
  const relativePath = relative(join(SOURCE_DIR, 'src', 'app', 'api'), filePath)
  let apiPath = '/' + relativePath
    .replace(/\\/g, '/')
    .replace(/\/route\.ts$/, '')
    .replace(/\[([^\]]+)\]/g, '{$1}')  // [id] -> {id}

  // 处理 catch-all 路由 [...nextauth]
  apiPath = apiPath.replace(/\[\.\.\.([^\]]+)\]/g, '{$1}')

  return {
    path: apiPath,
    methods,
    filePath: relative(ROOT, filePath),
  }
}

// ── 生成 OpenAPI paths ──────────────────────────────────────────────────────
function generatePaths(routes) {
  const paths = {}

  for (const route of routes) {
    if (!paths[route.path]) {
      paths[route.path] = {}
    }

    for (const method of route.methods) {
      paths[route.path][method] = {
        operationId: generateOperationId(method, route.path),
        summary: generateSummary(method, route.path),
        tags: [generateTag(route.path)],
        'x-source-file': route.filePath,
      }
    }
  }

  return paths
}

// ── 生成 operationId ─────────────────────────────────────────────────────────
function generateOperationId(method, path) {
  const parts = path.split('/').filter(Boolean)
  const resource = parts[0] || 'root'

  const methodMap = {
    get: parts.length > 1 ? 'get' : 'list',
    post: 'create',
    put: 'update',
    delete: 'delete',
  }

  const verb = methodMap[method] || method
  const name = parts.slice(1).join('-').replace(/\{(\w+)\}/g, 'by-$1')

  return verb + (name ? '-' + name : '') + '-' + resource
}

// ── 生成 summary ─────────────────────────────────────────────────────────────
function generateSummary(method, path) {
  const parts = path.split('/').filter(Boolean)
  const resource = parts[0] || ''
  const isDetail = path.includes('{id}')

  const methodNames = {
    get: isDetail ? '获取' : '列表',
    post: '创建',
    put: '更新',
    delete: '删除',
  }

  const resourceNames = {
    polls: '投票',
    posts: '推文',
    comments: '评论',
    users: '用户',
    profile: '资料',
    notifications: '通知',
    sessions: '会话',
    bindings: '绑定',
    topics: '主题',
    follows: '关注',
    admin: '管理',
    settings: '设置',
    auth: '认证',
  }

  const name = resourceNames[resource] || resource
  const verb = methodNames[method] || method

  return `${verb}${name}`
}

// ── 生成 tag ─────────────────────────────────────────────────────────────────
function generateTag(path) {
  const parts = path.split('/').filter(Boolean)
  const resource = parts[0] || 'Other'

  const tagMap = {
    polls: 'Polls',
    posts: 'Posts',
    comments: 'Comments',
    users: 'Auth',
    profile: 'Profile',
    notifications: 'Notifications',
    sessions: 'Sessions',
    bindings: 'Bindings',
    topics: 'Topics',
    follows: 'Follows',
    admin: 'Admin',
    settings: 'Settings',
    auth: 'Auth',
  }

  return tagMap[resource] || 'Other'
}

// ── 主流程 ───────────────────────────────────────────────────────────────────
function main() {
  console.log(`📂 源码目录: ${SOURCE_DIR}`)
  console.log(`📂 输出目录: ${OUTPUT_DIR}`)

  // 1. 读取 Zod schemas
  console.log('\n📖 读取 Zod schemas...')
  const zodSchemas = readZodSchemas()
  console.log(`   找到 ${Object.keys(zodSchemas).length} 个 schema`)

  // 2. 扫描路由
  console.log('\n🔍 扫描路由文件...')
  const apiDir = join(SOURCE_DIR, 'src', 'app', 'api')
  const routes = scanRoutes(apiDir)
  console.log(`   找到 ${routes.length} 个路由`)

  // 3. 生成 paths
  console.log('\n📝 生成 paths...')
  const paths = generatePaths(routes)

  // 4. 输出统计
  const totalPaths = Object.keys(paths).length
  const totalOperations = Object.values(paths).reduce(
    (sum, p) => sum + Object.keys(p).length,
    0
  )

  console.log(`   ${totalPaths} 个路径, ${totalOperations} 个操作`)

  // 5. 输出路由摘要
  console.log('\n📋 路由摘要:')
  for (const route of routes.sort((a, b) => a.path.localeCompare(b.path))) {
    const methods = route.methods.map(m => m.toUpperCase()).join(', ')
    console.log(`   ${methods.padEnd(12)} ${route.path}`)
  }

  // 6. 生成同步报告
  const report = {
    timestamp: new Date().toISOString(),
    source: SOURCE_DIR,
    stats: {
      zodSchemas: Object.keys(zodSchemas).length,
      routes: routes.length,
      paths: totalPaths,
      operations: totalOperations,
    },
    zodSchemas: Object.keys(zodSchemas),
    routes: routes.map(r => ({
      path: r.path,
      methods: r.methods,
      file: r.filePath,
    })),
  }

  writeFileSync(
    join(ROOT, 'sync-report.json'),
    JSON.stringify(report, null, 2)
  )

  console.log('\n✅ 同步报告已生成: sync-report.json')
  console.log('\n💡 提示: 此脚本提取路由结构，详细 schema 需手动维护或后续增强')
}

main()
