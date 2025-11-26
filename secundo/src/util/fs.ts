import { readFile, access, readdir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { constants } from 'node:fs'

export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

export async function readJSON(path: string): Promise<any> {
  try {
    const content = await readFile(path, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

export async function readYAML(path: string): Promise<any> {
  try {
    const content = await readFile(path, 'utf-8')
    // Simple YAML parser for now - just handle basic key: value
    const result: any = {}
    const lines = content.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      const colonIndex = trimmed.indexOf(':')
      if (colonIndex === -1) continue

      const key = trimmed.substring(0, colonIndex).trim()
      let value = trimmed.substring(colonIndex + 1).trim()

      // Remove quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }

      result[key] = value
    }

    return result
  } catch {
    return null
  }
}

export async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

export async function listFilesRecursive(dir: string, baseDir?: string): Promise<string[]> {
  const base = baseDir || dir
  const files: string[] = []

  try {
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)

      // Skip common ignore patterns
      if (entry.name === 'node_modules' ||
          entry.name === '.git' ||
          entry.name === 'dist' ||
          entry.name === '.secundo') {
        continue
      }

      if (entry.isDirectory()) {
        const subFiles = await listFilesRecursive(fullPath, base)
        files.push(...subFiles)
      } else {
        files.push(relative(base, fullPath))
      }
    }
  } catch {
    // Ignore errors
  }

  return files
}

export async function findExecutableScripts(files: string[], projectDir: string): Promise<string[]> {
  const executables: string[] = []

  for (const file of files) {
    const fullPath = join(projectDir, file)
    if (await isExecutable(fullPath)) {
      executables.push(file)
    }
  }

  return executables
}

export async function readGitRemote(projectDir: string): Promise<string | null> {
  const gitConfigPath = join(projectDir, '.git', 'config')
  if (!await fileExists(gitConfigPath)) {
    return null
  }

  try {
    const content = await readFile(gitConfigPath, 'utf-8')
    const match = content.match(/url\s*=\s*(.+)/i)
    return match ? match[1].trim() : null
  } catch {
    return null
  }
}
