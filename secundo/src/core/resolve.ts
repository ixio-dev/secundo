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

function resolveNodeEntrypoint(packageJson: any): string | null {
  if (packageJson.bin) {
    if (typeof packageJson.bin === 'string') {
      return packageJson.bin
    }
    if (typeof packageJson.bin === 'object') {
      const bins = Object.values(packageJson.bin)
      if (bins.length > 0) {
        return bins[0] as string
      }
    }
  }

  if (packageJson.main) {
    return packageJson.main
  }

  return null
}

async function resolveCommonEntrypoint(projectDir: string): Promise<string | null> {
  const candidates = [
    'main.py', 'app.py', 'cli.py', '__main__.py',
    'main.ts', 'main.js', 'index.ts', 'index.js', 'cli.ts', 'cli.js',
    'main.rb'
  ]

  for (const name of candidates) {
    if (await fileExists(join(projectDir, name))) {
      return name
    }
  }

  return null
}

function resolveExecutableScript(executableScripts: string[]): string | null {
  if (executableScripts.length === 0) {
    return null
  }

  const rootScripts = executableScripts.filter(f => !f.includes('/'))
  if (rootScripts.length > 0) {
    return rootScripts[0]
  }

  const binScripts = executableScripts.filter(f => f.startsWith('bin/'))
  if (binScripts.length > 0) {
    return binScripts[0]
  }

  return executableScripts[0]
}

export async function resolveEntrypoint(
  spec: SecundoSpec | null,
  meta: ProjectMeta,
  projectDir: string
): Promise<string> {
  if (spec?.entry) {
    return spec.entry
  }

  if (meta.packageJson) {
    const nodeEntry = resolveNodeEntrypoint(meta.packageJson)
    if (nodeEntry) return nodeEntry
  }

  const commonEntry = await resolveCommonEntrypoint(projectDir)
  if (commonEntry) return commonEntry

  const scriptEntry = resolveExecutableScript(meta.executableScripts)
  if (scriptEntry) return scriptEntry

  throw new Error('No entrypoint detected. Add entry: to secundo.spec')
}

function parseGitHubRemote(gitRemote: string): string | null {
  const match = gitRemote.match(/github\.com[:/]([^/]+)\/([^/.]+)/i)
  if (!match) return null

  const [, user, repo] = match
  return `com.github.${sanitizeToAppId(user)}.${sanitizeToAppId(repo)}`
}

function getAppIdFromProject(meta: ProjectMeta): string | null {
  if (meta.packageJson?.name) {
    return sanitizeToAppId(meta.packageJson.name)
  }

  if (meta.pyproject?.name || meta.pyproject?.['project.name']) {
    const name = meta.pyproject.name || meta.pyproject['project.name']
    return sanitizeToAppId(name)
  }

  return null
}

export function resolveAppId(
  spec: SecundoSpec | null,
  meta: ProjectMeta,
  projectDir: string
): string {
  if (spec?.appId) {
    return spec.appId
  }

  const projectAppId = getAppIdFromProject(meta)
  if (projectAppId) return projectAppId

  if (meta.gitRemote) {
    const githubAppId = parseGitHubRemote(meta.gitRemote)
    if (githubAppId) return githubAppId
  }

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
