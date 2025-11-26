import { basename, join } from 'node:path'
import type { ProjectMeta, SecundoSpec } from '../util/types.js'
import { fileExists } from '../util/fs.js'

export function resolveInterpreter(spec: SecundoSpec | null, meta: ProjectMeta): string {
  // Spec override takes precedence
  if (spec?.interpreter) {
    return spec.interpreter
  }

  // TypeScript project
  if (meta.tsconfig || meta.tsFiles.length > 0) {
    return 'ts-node'
  }

  // Node.js project
  if (meta.packageJson) {
    return 'node'
  }

  // Python project
  if (meta.pyproject || meta.requirementsTxt || meta.pyFiles.length > 0) {
    return 'python3'
  }

  // Ruby project
  if (meta.rbFiles.length > 0) {
    return 'ruby'
  }

  // Shell scripts
  if (meta.shFiles.length > 0 || meta.executableScripts.length > 0) {
    return '/bin/sh'
  }

  throw new Error('Could not detect interpreter. Please specify in secundo.spec')
}

export async function resolveEntrypoint(
  spec: SecundoSpec | null,
  meta: ProjectMeta,
  projectDir: string
): Promise<string> {
  // Spec override
  if (spec?.entry) {
    return spec.entry
  }

  // Node.js: check bin field
  if (meta.packageJson?.bin) {
    if (typeof meta.packageJson.bin === 'string') {
      return meta.packageJson.bin
    } else if (typeof meta.packageJson.bin === 'object') {
      // Take first bin entry
      const bins = Object.values(meta.packageJson.bin)
      if (bins.length > 0) {
        return bins[0] as string
      }
    }
  }

  // Node.js: check main field
  if (meta.packageJson?.main) {
    return meta.packageJson.main
  }

  // Python: common entry files
  for (const name of ['main.py', 'app.py', 'cli.py', '__main__.py']) {
    if (await fileExists(join(projectDir, name))) {
      return name
    }
  }

  // TypeScript/JavaScript: common entry files
  for (const name of ['main.ts', 'main.js', 'index.ts', 'index.js', 'cli.ts', 'cli.js']) {
    if (await fileExists(join(projectDir, name))) {
      return name
    }
  }

  // Ruby
  if (await fileExists(join(projectDir, 'main.rb'))) {
    return 'main.rb'
  }

  // Shell: look for executable scripts
  if (meta.executableScripts.length > 0) {
    // Prefer files in root or bin/
    const rootScripts = meta.executableScripts.filter(f => !f.includes('/'))
    if (rootScripts.length > 0) {
      return rootScripts[0]
    }

    const binScripts = meta.executableScripts.filter(f => f.startsWith('bin/'))
    if (binScripts.length > 0) {
      return binScripts[0]
    }

    return meta.executableScripts[0]
  }

  throw new Error('No entrypoint detected. Add entry: to secundo.spec')
}

export function resolveAppId(
  spec: SecundoSpec | null,
  meta: ProjectMeta,
  projectDir: string
): string {
  // Spec override
  if (spec?.appId) {
    return spec.appId
  }

  // From package.json
  if (meta.packageJson?.name) {
    return sanitizeToAppId(meta.packageJson.name)
  }

  // From pyproject.toml
  if (meta.pyproject?.name || meta.pyproject?.['project.name']) {
    const name = meta.pyproject.name || meta.pyproject['project.name']
    return sanitizeToAppId(name)
  }

  // From git remote
  if (meta.gitRemote) {
    const githubMatch = meta.gitRemote.match(/github\.com[:/]([^/]+)\/([^/.]+)/i)
    if (githubMatch) {
      const [, user, repo] = githubMatch
      return `com.github.${sanitizeToAppId(user)}.${sanitizeToAppId(repo)}`
    }
  }

  // Fallback: directory name
  const dirName = basename(projectDir)
  return `local.${sanitizeToAppId(dirName)}`
}

export function resolveVersion(spec: SecundoSpec | null, meta: ProjectMeta): string {
  // Spec override
  if (spec?.version) {
    return spec.version
  }

  // From package.json
  if (meta.packageJson?.version) {
    return meta.packageJson.version
  }

  // From pyproject.toml
  if (meta.pyproject?.version || meta.pyproject?.['project.version']) {
    return meta.pyproject.version || meta.pyproject['project.version']
  }

  // Default
  return '0.1.0'
}

export function resolveName(
  spec: SecundoSpec | null,
  meta: ProjectMeta,
  projectDir: string
): string {
  // Spec override
  if (spec?.name) {
    return spec.name
  }

  // From package.json
  if (meta.packageJson?.name) {
    return meta.packageJson.name
  }

  // From pyproject.toml
  if (meta.pyproject?.name || meta.pyproject?.['project.name']) {
    return meta.pyproject.name || meta.pyproject['project.name']
  }

  // Fallback: directory name
  return basename(projectDir)
}

export function resolveInterpreterArgs(spec: SecundoSpec | null, _meta: ProjectMeta): string[] {
  // Spec override or default
  return spec?.interpreterArgs || []
}

function sanitizeToAppId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
}
