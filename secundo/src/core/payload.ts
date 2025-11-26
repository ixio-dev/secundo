import { createGzip } from 'node:zlib'
import { createReadStream, createWriteStream } from 'node:fs'
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import type { SecundoManifest } from '../util/types.js'
import { sha256Hex } from '../util/hash.js'

async function prepareManifestStaging(manifestPath: string): Promise<string> {
  const stagingDir = join(tmpdir(), `secundo-staging-${Date.now()}`)
  const secundoDir = join(stagingDir, '.secundo')
  await mkdir(secundoDir, { recursive: true })

  const stagedManifest = join(secundoDir, 'manifest.json')
  const manifestContent = await readFile(manifestPath)
  await writeFile(stagedManifest, manifestContent)

  return stagingDir
}

function executeTarCommand(args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tar = spawn('tar', args, {
      cwd,
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
}

async function createProjectTar(projectDir: string, tarPath: string): Promise<void> {
  await executeTarCommand(
    [
      '-cf',
      tarPath,
      '--exclude', 'node_modules',
      '--exclude', '.git',
      '--exclude', '.secundo',
      '--exclude', '*.sec',
      '.'
    ],
    projectDir
  )
}

async function addManifestToTar(tarPath: string, stagingDir: string): Promise<void> {
  await executeTarCommand(['-rf', tarPath, '.secundo'], stagingDir)
}

async function createTarball(
  projectDir: string,
  tarPath: string,
  manifestPath: string
): Promise<void> {
  const stagingDir = await prepareManifestStaging(manifestPath)

  try {
    await createProjectTar(projectDir, tarPath)
    await addManifestToTar(tarPath, stagingDir)
  } finally {
    await rm(stagingDir, { recursive: true, force: true })
  }
}

async function gzipFile(inputPath: string, outputPath: string): Promise<void> {
  const input = createReadStream(inputPath)
  const output = createWriteStream(outputPath)
  const gzip = createGzip({ level: 9 })

  await pipeline(input, gzip, output)
}

export async function createPayload(
  projectDir: string,
  manifest: SecundoManifest
): Promise<{ payload: string; hash: string }> {
  const tempDir = join(tmpdir(), `secundo-pack-${Date.now()}`)
  await mkdir(tempDir, { recursive: true })

  const tarPath = join(tempDir, 'payload.tar')
  const gzipPath = join(tempDir, 'payload.tar.gz')
  const manifestPath = join(tempDir, 'manifest.json')

  try {
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2))
    await createTarball(projectDir, tarPath, manifestPath)
    await gzipFile(tarPath, gzipPath)

    const gzipped = await readFile(gzipPath)
    const payload = gzipped.toString('base64')
    const hash = sha256Hex(gzipped)

    return { payload, hash }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}
