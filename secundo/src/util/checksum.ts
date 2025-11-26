import { readFile, readdir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { sha256Hex } from './hash.js'

export interface FileChecksum {
  path: string
  checksum: string
  size: number
}

export async function calculateFileChecksum(filePath: string): Promise<string> {
  const content = await readFile(filePath)
  return sha256Hex(content)
}

export async function generateChecksums(
  directory: string,
  baseDir?: string
): Promise<Map<string, FileChecksum>> {
  const base = baseDir || directory
  const checksums = new Map<string, FileChecksum>()

  async function processDirectory(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      const relativePath = relative(base, fullPath)

      if (entry.isDirectory()) {
        await processDirectory(fullPath)
      } else if (entry.isFile()) {
        const checksum = await calculateFileChecksum(fullPath)
        const stats = await stat(fullPath)
        checksums.set(relativePath, {
          path: relativePath,
          checksum,
          size: stats.size
        })
      }
    }
  }

  await processDirectory(directory)
  return checksums
}

export async function verifyChecksums(
  directory: string,
  expectedChecksums: Map<string, FileChecksum>
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = []
  const actualChecksums = await generateChecksums(directory)

  // Check all expected files exist with correct checksums
  for (const [path, expected] of expectedChecksums) {
    const actual = actualChecksums.get(path)

    if (!actual) {
      errors.push(`Missing file: ${path}`)
      continue
    }

    if (actual.checksum !== expected.checksum) {
      errors.push(`Checksum mismatch: ${path}`)
      continue
    }

    if (actual.size !== expected.size) {
      errors.push(`Size mismatch: ${path} (expected ${expected.size}, got ${actual.size})`)
    }
  }

  // Check for unexpected files
  for (const path of actualChecksums.keys()) {
    if (!expectedChecksums.has(path)) {
      errors.push(`Unexpected file: ${path}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

export function serializeChecksums(checksums: Map<string, FileChecksum>): Record<string, FileChecksum> {
  const result: Record<string, FileChecksum> = {}
  for (const [path, checksum] of checksums) {
    result[path] = checksum
  }
  return result
}

export function deserializeChecksums(data: Record<string, FileChecksum>): Map<string, FileChecksum> {
  const map = new Map<string, FileChecksum>()
  for (const [path, checksum] of Object.entries(data)) {
    map.set(path, checksum)
  }
  return map
}
