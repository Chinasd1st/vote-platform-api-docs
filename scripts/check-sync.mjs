/**
 * check-sync.mjs
 *
 * 验证 OpenAPI 文档与源码路由是否同步
 *
 * 用法：
 *   node scripts/check-sync.mjs [source-dir]
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(__dirname, '..')
const SOURCE_DIR = process.argv[2] || join(ROOT, '..', 'vote-platform')

// ── 扫描源码路由 ─────────────────────────────────────────────────────────────
function scanSourceRoutes(dir) {
  const routes = new Set()
  const apiDir = join(dir, 'src', 'app', 'api')

  function walk(currentDir) {
    try {
      const entries = readdirSync(currentDir)
      for (const entry of entries) {
        const fullPath = join(currentDir, entry)
        const stat = statSync(fullPath)
        if (stat.isDirectory()) {
          walk(fullPath)
        } else if (entry === 'route.ts') {
          const relativePath = relative(join(dir, 'src', 'app', 'api'), fullPath)
          let apiPath = '/' + relativePath
            .replace(/\\/g, '/')
            .replace(/\/route\.ts$/, '')
            .replace(/\[([^\]]+)\]/g, '{$1}')
            .replace(/\[\.\.\.([^\]]+)\]/g, '{$1}')
          routes.add(apiPath)
        }
      }
    } catch (e) {
      // 忽略目录不存在等错误
    }
  }

  walk(apiDir)
  return routes
}

// ── 提取 OpenAPI 路径 ────────────────────────────────────────────────────────
function extractOpenAPIPaths(openapiPath) {
  const content = readFileSync(openapiPath, 'utf-8')

  // 简单正则提取 paths 部分
  const pathsMatch = content.match(/^paths:\s*\n((?:  .+\n)*)/m)
  if (!pathsMatch) return new Set()

  const paths = new Set()
  const lines = pathsMatch[1].split('\n')

  for (const line of lines) {
    // 匹配一级路径（非 $ref）
    const pathMatch = line.match(/^  (\/\S+):/)
    if (pathMatch && !line.includes('$ref')) {
      paths.add(pathMatch[1])
    }
  }

  return paths
}

// ── 主流程 ───────────────────────────────────────────────────────────────────
function main() {
  console.log('🔍 检查 OpenAPI 文档与源码同步...\n')

  // 1. 扫描源码路由
  console.log(`📂 源码目录: ${SOURCE_DIR}`)
  const sourceRoutes = scanSourceRoutes(SOURCE_DIR)
  console.log(`   找到 ${sourceRoutes.size} 个路由\n`)

  // 2. 提取 OpenAPI 路径
  const openapiPath = join(ROOT, 'openapi.yaml')
  console.log(`📄 OpenAPI: ${openapiPath}`)
  const openapiPaths = extractOpenAPIPaths(openapiPath)
  console.log(`   找到 ${openapiPaths.size} 个路径\n`)

  // 3. 比较差异
  const missingInDocs = [...sourceRoutes].filter(r => !openapiPaths.has(r))
  const extraInDocs = [...openapiPaths].filter(p =>
    !p.startsWith('/{') && !sourceRoutes.has(p)
  )

  // 4. 输出结果
  console.log('═'.repeat(60))

  if (missingInDocs.length === 0 && extraInDocs.length === 0) {
    console.log('✅ 同步状态: 完全一致')
  } else {
    console.log('⚠️  同步状态: 存在差异\n')

    if (missingInDocs.length > 0) {
      console.log('❌ 源码中有但文档中缺失的路由:')
      for (const route of missingInDocs.sort()) {
        console.log(`   ${route}`)
      }
      console.log()
    }

    if (extraInDocs.length > 0) {
      console.log('⚠️  文档中有但源码中不存在的路径:')
      for (const path of extraInDocs.sort()) {
        console.log(`   ${path}`)
      }
      console.log()
    }
  }

  console.log('═'.repeat(60))

  // 5. 列出所有已同步的路由
  console.log('\n📋 已同步的路由:')
  const synced = [...sourceRoutes].filter(r => openapiPaths.has(r))
  for (const route of synced.sort()) {
    console.log(`   ✅ ${route}`)
  }

  // 返回退出码
  process.exit(missingInDocs.length > 0 ? 1 : 0)
}

main()
