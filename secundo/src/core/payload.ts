import { createGzip } from 'node:zlib'
import { createReadStream, createWriteStream } from 'node:fs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import type { SecundoManifest } from '../util/types.js'
import { sha256Hex } from '../util/hash.js'

export async function createPayload(
  projectDir: string,
  manifest: SecundoManifest
): Promise<{ payload: string; hash: string }> {
  // Create temp directory for building
  const tempDir = join(tmpdir(), `secundo-pack-${Date.now()}`)
  await mkdir(tempDir, { recursive: true })

  const tarPath = join(tempDir, 'payload.tar')
  const gzipPath = join(tempDir, 'payload.tar.gz')
  const manifestPath = join(tempDir, 'manifest.json')

  try {
    // Write manifest to temp location
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2))

    // Create tarball with manifest
    await createTarball(projectDir, tarPath, manifestPath)

    // Gzip the tarball
    await gzipFile(tarPath, gzipPath)

    // Read and base64 encode
    const gzipped = await readFile(gzipPath)
    const payload = gzipped.toString('base64')
    const hash = sha256Hex(gzipped)

    return { payload, hash }
  } finally {
    // Cleanup temp files
    try {
      await import('node:fs/promises').then(fs => fs.rm(tempDir, { recursive: true, force: true }))
    } catch {
      // Ignore cleanup errors
    }
  }
}

async function createTarball(
  projectDir: string,
  tarPath: string,
  manifestPath: string
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    // Create temp staging directory for manifest
    const stagingDir = join(tmpdir(), `secundo-staging-${Date.now()}`)
    const secundoDir = join(stagingDir, '.secundo')
    await mkdir(secundoDir, { recursive: true })

    // Copy manifest to staging
    const stagedManifest = join(secundoDir, 'manifest.json')
    const manifestContent = await readFile(manifestPath)
    await writeFile(stagedManifest, manifestContent)

    // Create tarball from project
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

    tar.on('close', async (code) => {
      if (code !== 0) {
        reject(new Error(`tar failed with code ${code}: ${stderr}`))
        return
      }

      // Add manifest directory to tarball
      const tarAdd = spawn('tar', [
        '-rf',
        tarPath,
        '.secundo'
      ], {
        cwd: stagingDir,
        stdio: ['ignore', 'pipe', 'pipe']
      })

      let addStderr = ''
      tarAdd.stderr?.on('data', (data) => {
        addStderr += data.toString()
      })

      tarAdd.on('close', async (addCode) => {
        // Cleanup staging
        try {
          await import('node:fs/promises').then(fs => fs.rm(stagingDir, { recursive: true, force: true }))
        } catch {
          // Ignore cleanup errors
        }

        if (addCode !== 0) {
          reject(new Error(`tar add manifest failed with code ${addCode}: ${addStderr}`))
        } else {
          resolve()
        }
      })
    })

    tar.on('error', reject)
  })
}

async function gzipFile(inputPath: string, outputPath: string): Promise<void> {
  const input = createReadStream(inputPath)
  const output = createWriteStream(outputPath)
  const gzip = createGzip({ level: 9 })

  await pipeline(input, gzip, output)
}
