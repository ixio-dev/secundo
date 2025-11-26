import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { createGunzip } from 'node:zlib'
import { pipeline } from 'node:stream/promises'
import { spawn } from 'node:child_process'
import { Readable } from 'node:stream'
import { parseSecFile } from '../core/sec-parser.js'

async function decompressToTar(payload: string, tarPath: string): Promise<void> {
  const decoded = Buffer.from(payload, 'base64')
  const readable = Readable.from(decoded)
  const gunzip = createGunzip()
  const writable = createWriteStream(tarPath)
  await pipeline(readable, gunzip, writable)
}

async function extractTarToDirectory(tarPath: string, extractDir: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tar = spawn('tar', ['-xf', tarPath], {
      cwd: extractDir,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stderr = ''
    tar.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    tar.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`tar extraction failed: ${stderr}`))
      } else {
        resolve()
      }
    })

    tar.on('error', reject)
  })
}

async function extractPayloadToTemp(payload: string): Promise<string> {
  const tempDir = join(tmpdir(), `secundo-run-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  await mkdir(tempDir, { recursive: true })

  const tarPath = join(tempDir, 'payload.tar')
  await decompressToTar(payload, tarPath)

  const extractDir = join(tempDir, 'extracted')
  await mkdir(extractDir, { recursive: true })
  await extractTarToDirectory(tarPath, extractDir)

  return extractDir
}

async function executeInDirectory(
  extractDir: string,
  interpreter: string,
  interpreterArgs: string[],
  entry: string,
  userArgs: string[]
): Promise<number> {
  return new Promise((resolve) => {
    const allArgs = [...interpreterArgs, entry, ...userArgs]

    const proc = spawn(interpreter, allArgs, {
      cwd: extractDir,
      stdio: 'inherit',
      env: process.env
    })

    proc.on('close', (code) => {
      resolve(code ?? 0)
    })

    proc.on('error', (error) => {
      console.error(`Failed to execute: ${error.message}`)
      resolve(1)
    })
  })
}

async function cleanupAndExit(extractDir: string | null, exitCode: number): Promise<void> {
  if (extractDir) {
    await rm(extractDir, { recursive: true, force: true }).catch(() => {})
  }
  process.exit(exitCode)
}

export async function run(args: string[]): Promise<void> {
  if (args.length === 0) {
    console.error('Usage: secundo run <file.sec> [args]')
    process.exit(1)
  }

  const file = args[0]
  const userArgs = args.slice(1)
  let extractDir: string | null = null

  try {
    const { metadata, payload } = await parseSecFile(file)
    extractDir = await extractPayloadToTemp(payload)

    const exitCode = await executeInDirectory(
      extractDir,
      metadata.interpreter,
      metadata.interpreterArgs,
      metadata.entry,
      userArgs
    )

    await cleanupAndExit(extractDir, exitCode)

  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`)
    } else {
      console.error('Unknown error occurred')
    }
    await cleanupAndExit(extractDir, 1)
  }
}
