import { readFile, access, readdir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { constants, type Dirent } from 'node:fs'

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
    const result: any = {}
    const lines = content.split('\n')

    let currentKey: string | null = null
    let currentArray: string[] | null = null
    let currentObject: any | null = null
    let indent = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()

      if (!trimmed || trimmed.startsWith('#')) continue

      const lineIndent = line.length - line.trimStart().length

      // Array item
      if (trimmed.startsWith('- ')) {
        const arrayValue = trimmed.substring(2).trim()
        if (currentArray && currentKey) {
          currentArray.push(arrayValue)
        }
        continue
      }

      const colonIndex = trimmed.indexOf(':')
      if (colonIndex === -1) continue

      const key = trimmed.substring(0, colonIndex).trim()
      let value = trimmed.substring(colonIndex + 1).trim()

      // Check if this is starting a nested structure
      if (!value || value === '') {
        // Check next line to determine if it's an array or object
        const nextLine = i + 1 < lines.length ? lines[i + 1] : ''
        const nextTrimmed = nextLine.trim()

        if (nextTrimmed.startsWith('- ')) {
          // Starting an array
          currentKey = key
          currentArray = []
          result[key] = currentArray
        } else if (nextLine && nextLine.length - nextLine.trimStart().length > lineIndent) {
          // Starting a nested object
          currentKey = key
          currentObject = {}
          result[key] = currentObject
          indent = lineIndent
        }
        continue
      }

      // Remove quotes from value
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }

      // If we're in a nested object context and indented
      if (currentObject && lineIndent > indent) {
        currentObject[key] = value
      } else {
        // Top-level key-value or end of nesting
        result[key] = value
        currentObject = null
        currentArray = null
        currentKey = null
      }
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

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', '.secundo'])

function shouldIgnoreEntry(entryName: string): boolean {
  return IGNORED_DIRS.has(entryName)
}

async function processDirectoryEntries(
  dir: string,
  base: string,
  entries: Dirent[]
): Promise<string[]> {
  const files: string[] = []

  for (const entry of entries) {
    if (shouldIgnoreEntry(entry.name)) {
      continue
    }

    const fullPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      const subFiles = await listFilesRecursive(fullPath, base)
      files.push(...subFiles)
    } else {
      files.push(relative(base, fullPath))
    }
  }

  return files
}

export async function listFilesRecursive(dir: string, baseDir?: string): Promise<string[]> {
  const base = baseDir || dir

  try {
    const entries = await readdir(dir, { withFileTypes: true })
    return await processDirectoryEntries(dir, base, entries)
  } catch {
    return []
  }
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
