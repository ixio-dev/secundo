import { createGzip } from 'node:zlib'
import { createReadStream, createWriteStream } from 'node:fs'
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { sha256Hex } from '../util/hash.js'

// Create tarball of project files WITHOUT manifest
export async function createProjectTarball(projectDir: string): Promise<{ tarPath: string; hash: string; tempDir: string }> {
  const tempDir = join(tmpdir(), `secundo-pack-${Date.now()}`)
  await mkdir(tempDir, { recursive: true })

  const tarPath = join(tempDir, 'project.tar')

  await new Promise<void>((resolve, reject) => {
    const tar = spawn('tar', [
      '-cf',
      tarPath,
      '--exclude', 'node_modules',
      '--exclude', '.git',
      '--exclude', '.secundo',
      '--exclude', '*.sec',
      '.'
    ], {
      cwd: projectDir,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stderr = ''
    tar.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    tar.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`tar failed with code ${code}: ${stderr}`))
      } else {
        resolve()
      }
    })

    tar.on('error', reject)
  })

  const gzipPath = `${tarPath}.gz`
  const input = createReadStream(tarPath)
  const output = createWriteStream(gzipPath)
  const gzip = createGzip({ level: 9 })
  await pipeline(input, gzip, output)

  const gzipped = await readFile(gzipPath)
  const hash = sha256Hex(gzipped)

  // Remove the gzipped version - we'll recreate it after adding manifest
  await rm(gzipPath)

  return { tarPath, hash, tempDir }
}

// Add manifest to existing tarball
export async function addManifestToTarball(
  tarPath: string,
  manifestJson: string
): Promise<void> {
  const tempDir = join(tmpdir(), `secundo-manifest-${Date.now()}`)
  await mkdir(tempDir, { recursive: true })

  try {
    const secundoDir = join(tempDir, '.secundo')
    await mkdir(secundoDir, { recursive: true })
    const manifestPath = join(secundoDir, 'manifest.json')
    await writeFile(manifestPath, manifestJson)

    await new Promise<void>((resolve, reject) => {
      const tar = spawn('tar', [
        '-rf',
        tarPath,
        '.secundo'
      ], {
        cwd: tempDir,
        stdio: ['ignore', 'pipe', 'pipe']
      })

      let stderr = ''
      tar.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      tar.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`tar failed with code ${code}: ${stderr}`))
        } else {
          resolve()
        }
      })

      tar.on('error', reject)
    })
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

// Gzip and base64 encode a tarball
export async function gzipAndEncode(tarPath: string): Promise<string> {
  const gzipPath = `${tarPath}.gz`

  const input = createReadStream(tarPath)
  const output = createWriteStream(gzipPath)
  const gzip = createGzip({ level: 9 })
  await pipeline(input, gzip, output)

  const gzipped = await readFile(gzipPath)
  return gzipped.toString('base64')
}
