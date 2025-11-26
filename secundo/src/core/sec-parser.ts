import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdir, rm } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { createGunzip } from 'node:zlib'
import { pipeline } from 'node:stream/promises'
import { spawn } from 'node:child_process'
import { Readable } from 'node:stream'
import type { SecundoManifest } from '../util/types.js'
import { verify, base64ToBytes } from '../util/crypto.js'
import { sha256Hex } from '../util/hash.js'

export interface SecundoMetadata {
  appId: string
  payloadHash: string
  publicKey: string
  signature: string
  entry: string
  interpreter: string
  interpreterArgs: string[]
}

function findPayloadMarker(lines: string[]): number {
  const markerLine = '__SECUNDO_PAYLOAD__'
  const markerIndex = lines.findIndex(line => line.trim() === markerLine)

  if (markerIndex === -1) {
    throw new Error('Invalid .sec file: payload marker not found')
  }

  return markerIndex
}

function buildMetadataFromHeader(header: string): SecundoMetadata {
  const appId = extractShellVar(header, 'APP_ID')
  const payloadHash = extractShellVar(header, 'APP_PAYLOAD_HASH')
  const publicKey = extractShellVar(header, 'PUBKEY_B64')
  const signature = extractShellVar(header, 'SIGNATURE_B64')
  const entry = extractShellVar(header, 'ENTRY')
  const interpreter = extractShellVar(header, 'INTERPRETER')
  const interpreterArgsJson = extractShellVar(header, 'INTERPRETER_ARGS_JSON')

  let interpreterArgs: string[] = []
  try {
    interpreterArgs = JSON.parse(interpreterArgsJson)
  } catch {
    interpreterArgs = []
  }

  return {
    appId,
    payloadHash,
    publicKey,
    signature,
    entry,
    interpreter,
    interpreterArgs
  }
}

export async function parseSecFile(filePath: string): Promise<{ metadata: SecundoMetadata; payload: string }> {
  const content = await readFile(filePath, 'utf-8')
  const lines = content.split('\n')

  const markerIndex = findPayloadMarker(lines)
  const header = lines.slice(0, markerIndex).join('\n')
  const payload = lines.slice(markerIndex + 1).join('\n')

  return {
    metadata: buildMetadataFromHeader(header),
    payload
  }
}

function extractShellVar(content: string, varName: string): string {
  const regex = new RegExp(`^${varName}=["']?(.*)["']?$`, 'm')
  const match = content.match(regex)
  if (!match) {
    throw new Error(`Variable ${varName} not found in .sec file`)
  }
  return match[1].replace(/^["']|["']$/g, '')
}

export async function extractManifest(payload: string): Promise<SecundoManifest> {
  const tempDir = join(tmpdir(), `secundo-extract-${Date.now()}`)
  await mkdir(tempDir, { recursive: true })

  try {
    const decoded = Buffer.from(payload, 'base64')
    const tarPath = join(tempDir, 'payload.tar')
    const readable = Readable.from(decoded)
    const gunzip = createGunzip()
    const writable = createWriteStream(tarPath)
    await pipeline(readable, gunzip, writable)

    const extractDir = join(tempDir, 'extracted')
    await mkdir(extractDir, { recursive: true })

    await new Promise<void>((resolve, reject) => {
      const tar = spawn('tar', ['-xf', tarPath, '.secundo/manifest.json'], {
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

    const manifestPath = join(extractDir, '.secundo', 'manifest.json')
    const manifestContent = await readFile(manifestPath, 'utf-8')
    return JSON.parse(manifestContent)

  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

export async function verifySignature(
  metadata: SecundoMetadata,
  manifest: SecundoManifest
): Promise<boolean> {
  try {
    const publicKey = base64ToBytes(metadata.publicKey)
    const signature = base64ToBytes(metadata.signature)

    const manifestCopy = { ...manifest }
    delete (manifestCopy as any).signature
    delete (manifestCopy as any).publicKey

    const manifestJson = JSON.stringify(manifestCopy, null, 2)
    const manifestHash = Buffer.from(sha256Hex(Buffer.from(manifestJson, 'utf-8')), 'hex')
    const payloadHash = Buffer.from(metadata.payloadHash, 'hex')

    const combined = Buffer.concat([manifestHash, payloadHash])

    return await verify(signature, combined, publicKey)
  } catch {
    return false
  }
}
