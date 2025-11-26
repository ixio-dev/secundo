import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { parseSecFile, extractManifest, verifySignature } from './sec-parser.js'
import { sign, bytesToBase64 } from '../util/crypto.js'
import { sha256Hex } from '../util/hash.js'
import type { SecundoManifest } from '../util/types.js'
import { createGzip } from 'node:zlib'
import { createReadStream, createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { spawn } from 'node:child_process'
import * as ed25519 from '@noble/ed25519'

describe('sec-parser', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `secundo-parser-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  describe('parseSecFile', () => {
    it('should parse valid .sec file', async () => {
      const secContent = `#!/bin/bash
APP_ID="com.example.test"
APP_PAYLOAD_HASH="abc123"
PUBKEY_B64="pubkey"
SIGNATURE_B64="signature"
ENTRY="index.js"
INTERPRETER="node"
INTERPRETER_ARGS_JSON="[]"

__SECUNDO_PAYLOAD__
base64payloaddata`

      const secPath = join(testDir, 'test.sec')
      await writeFile(secPath, secContent)

      const result = await parseSecFile(secPath)

      expect(result.metadata.appId).toBe('com.example.test')
      expect(result.metadata.payloadHash).toBe('abc123')
      expect(result.metadata.publicKey).toBe('pubkey')
      expect(result.metadata.signature).toBe('signature')
      expect(result.metadata.entry).toBe('index.js')
      expect(result.metadata.interpreter).toBe('node')
      expect(result.metadata.interpreterArgs).toEqual([])
      expect(result.payload).toBe('base64payloaddata')
    })

    it('should parse interpreter args from JSON', async () => {
      const secContent = `#!/bin/bash
APP_ID="com.example.test"
APP_PAYLOAD_HASH="hash"
PUBKEY_B64="key"
SIGNATURE_B64="sig"
ENTRY="main.ts"
INTERPRETER="tsx"
INTERPRETER_ARGS_JSON='["--tsconfig","tsconfig.json"]'

__SECUNDO_PAYLOAD__
payload`

      const secPath = join(testDir, 'args.sec')
      await writeFile(secPath, secContent)

      const result = await parseSecFile(secPath)

      expect(result.metadata.interpreterArgs).toEqual(['--tsconfig', 'tsconfig.json'])
    })

    it('should handle invalid interpreter args JSON', async () => {
      const secContent = `#!/bin/bash
APP_ID="com.example.test"
APP_PAYLOAD_HASH="hash"
PUBKEY_B64="key"
SIGNATURE_B64="sig"
ENTRY="main.js"
INTERPRETER="node"
INTERPRETER_ARGS_JSON="{invalid json}"

__SECUNDO_PAYLOAD__
payload`

      const secPath = join(testDir, 'invalid-args.sec')
      await writeFile(secPath, secContent)

      const result = await parseSecFile(secPath)

      expect(result.metadata.interpreterArgs).toEqual([])
    })

    it('should throw error when payload marker not found', async () => {
      const secContent = `#!/bin/bash
APP_ID="com.example.test"
APP_PAYLOAD_HASH="hash"`

      const secPath = join(testDir, 'no-marker.sec')
      await writeFile(secPath, secContent)

      await expect(parseSecFile(secPath)).rejects.toThrow('payload marker not found')
    })

    it('should throw error when required variable missing', async () => {
      const secContent = `#!/bin/bash
APP_PAYLOAD_HASH="hash"

__SECUNDO_PAYLOAD__
payload`

      const secPath = join(testDir, 'missing-var.sec')
      await writeFile(secPath, secContent)

      await expect(parseSecFile(secPath)).rejects.toThrow('APP_ID not found')
    })

    it('should handle variables with quotes', async () => {
      const secContent = `#!/bin/bash
APP_ID="com.example.test"
APP_PAYLOAD_HASH="hash123"
PUBKEY_B64="key-value"
SIGNATURE_B64="sig-value"
ENTRY='main.py'
INTERPRETER='python3'
INTERPRETER_ARGS_JSON='[]'

__SECUNDO_PAYLOAD__
payload`

      const secPath = join(testDir, 'quotes.sec')
      await writeFile(secPath, secContent)

      const result = await parseSecFile(secPath)

      expect(result.metadata.appId).toBe('com.example.test')
      expect(result.metadata.entry).toBe('main.py')
      expect(result.metadata.interpreter).toBe('python3')
    })

    it('should preserve multi-line payload', async () => {
      const payload = `line1
line2
line3`
      const secContent = `#!/bin/bash
APP_ID="com.example.test"
APP_PAYLOAD_HASH="hash"
PUBKEY_B64="key"
SIGNATURE_B64="sig"
ENTRY="index.js"
INTERPRETER="node"
INTERPRETER_ARGS_JSON="[]"

__SECUNDO_PAYLOAD__
${payload}`

      const secPath = join(testDir, 'multiline.sec')
      await writeFile(secPath, secContent)

      const result = await parseSecFile(secPath)
      expect(result.payload).toBe(payload)
    })
  })

  describe('extractManifest', () => {
    async function createTestPayload(manifest: SecundoManifest): Promise<string> {
      const tempDir = join(testDir, `payload-${Date.now()}`)
      await mkdir(tempDir, { recursive: true })

      // Create .secundo/manifest.json
      const secundoDir = join(tempDir, '.secundo')
      await mkdir(secundoDir, { recursive: true })
      const manifestPath = join(secundoDir, 'manifest.json')
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2))

      // Create tarball
      const tarPath = join(tempDir, 'payload.tar')
      await new Promise<void>((resolve, reject) => {
        const tar = spawn('tar', ['-cf', tarPath, '.secundo'], {
          cwd: tempDir,
          stdio: ['ignore', 'pipe', 'pipe']
        })

        let stderr = ''
        tar.stderr?.on('data', (data) => {
          stderr += data.toString()
        })

        tar.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`tar failed: ${stderr}`))
          } else {
            resolve()
          }
        })

        tar.on('error', reject)
      })

      // Gzip tarball
      const gzipPath = join(tempDir, 'payload.tar.gz')
      const input = createReadStream(tarPath)
      const output = createWriteStream(gzipPath)
      const gzip = createGzip({ level: 9 })
      await pipeline(input, gzip, output)

      // Read and encode
      const gzipped = await readFile(gzipPath)
      const payload = gzipped.toString('base64')

      await rm(tempDir, { recursive: true, force: true })

      return payload
    }

    it('should extract manifest from payload', async () => {
      const manifest: SecundoManifest = {
        appId: 'com.example.extract',
        version: '1.0.0',
        entry: 'main.js',
        interpreter: 'node',
        interpreterArgs: [],
        hash: 'hash',
        publicKey: 'key',
        signature: 'sig',
        metadata: {
          description: 'Test app'
        }
      }

      const payload = await createTestPayload(manifest)
      const extracted = await extractManifest(payload)

      expect(extracted.appId).toBe(manifest.appId)
      expect(extracted.version).toBe(manifest.version)
      expect(extracted.entry).toBe(manifest.entry)
      expect(extracted.interpreter).toBe(manifest.interpreter)
      expect(extracted.metadata).toEqual(manifest.metadata)
    })

    it('should handle manifest with all fields', async () => {
      const manifest: SecundoManifest = {
        appId: 'com.example.full',
        version: '2.5.0',
        entry: 'cli.ts',
        interpreter: 'tsx',
        interpreterArgs: ['--experimental'],
        name: 'Test CLI',
        description: 'A test CLI tool',
        hash: 'hash123',
        publicKey: 'key123',
        signature: 'sig123',
        metadata: {
          author: 'John Doe',
          license: 'MIT'
        }
      }

      const payload = await createTestPayload(manifest)
      const extracted = await extractManifest(payload)

      expect(extracted.name).toBe('Test CLI')
      expect(extracted.description).toBe('A test CLI tool')
      expect(extracted.interpreterArgs).toEqual(['--experimental'])
      expect(extracted.metadata?.author).toBe('John Doe')
      expect(extracted.metadata?.license).toBe('MIT')
    })
  })

  describe('verifySignature', () => {
    it('should verify valid signature', async () => {
      const privateKey = ed25519.utils.randomPrivateKey()
      const publicKey = await ed25519.getPublicKeyAsync(privateKey)

      const manifest: SecundoManifest = {
        appId: 'com.example.verify',
        version: '1.0.0',
        entry: 'index.js',
        interpreter: 'node',
        interpreterArgs: [],
        hash: 'payload-hash',
        publicKey: bytesToBase64(publicKey),
        signature: '',
        metadata: {}
      }

      // Calculate signature
      const manifestCopy = { ...manifest }
      delete (manifestCopy as any).signature
      delete (manifestCopy as any).publicKey

      const manifestJson = JSON.stringify(manifestCopy, null, 2)
      const manifestHash = Buffer.from(sha256Hex(Buffer.from(manifestJson, 'utf-8')), 'hex')
      const payloadHash = Buffer.from('payload-hash', 'hex')
      const combined = Buffer.concat([manifestHash, payloadHash])

      const signature = await sign(combined, privateKey)
      manifest.signature = bytesToBase64(signature)

      const metadata = {
        appId: manifest.appId,
        payloadHash: manifest.hash,
        publicKey: manifest.publicKey,
        signature: manifest.signature,
        entry: manifest.entry,
        interpreter: manifest.interpreter,
        interpreterArgs: manifest.interpreterArgs
      }

      const isValid = await verifySignature(metadata, manifest)
      expect(isValid).toBe(true)
    })

    it('should reject invalid signature', async () => {
      const privateKey = ed25519.utils.randomPrivateKey()
      const publicKey = await ed25519.getPublicKeyAsync(privateKey)
      const wrongPrivateKey = ed25519.utils.randomPrivateKey()

      const manifest: SecundoManifest = {
        appId: 'com.example.invalid',
        version: '1.0.0',
        entry: 'index.js',
        interpreter: 'node',
        interpreterArgs: [],
        hash: 'payload-hash',
        publicKey: bytesToBase64(publicKey),
        signature: '',
        metadata: {}
      }

      // Sign with wrong key
      const manifestCopy = { ...manifest }
      delete (manifestCopy as any).signature
      delete (manifestCopy as any).publicKey

      const manifestJson = JSON.stringify(manifestCopy, null, 2)
      const manifestHash = Buffer.from(sha256Hex(Buffer.from(manifestJson, 'utf-8')), 'hex')
      const payloadHash = Buffer.from('payload-hash', 'hex')
      const combined = Buffer.concat([manifestHash, payloadHash])

      const signature = await sign(combined, wrongPrivateKey)
      manifest.signature = bytesToBase64(signature)

      const metadata = {
        appId: manifest.appId,
        payloadHash: manifest.hash,
        publicKey: manifest.publicKey,
        signature: manifest.signature,
        entry: manifest.entry,
        interpreter: manifest.interpreter,
        interpreterArgs: manifest.interpreterArgs
      }

      const isValid = await verifySignature(metadata, manifest)
      expect(isValid).toBe(false)
    })

    it('should handle corrupted signature gracefully', async () => {
      const manifest: SecundoManifest = {
        appId: 'com.example.corrupt',
        version: '1.0.0',
        entry: 'index.js',
        interpreter: 'node',
        interpreterArgs: [],
        hash: 'hash',
        publicKey: 'invalid-base64',
        signature: 'invalid-signature',
        metadata: {}
      }

      const metadata = {
        appId: manifest.appId,
        payloadHash: manifest.hash,
        publicKey: manifest.publicKey,
        signature: manifest.signature,
        entry: manifest.entry,
        interpreter: manifest.interpreter,
        interpreterArgs: manifest.interpreterArgs
      }

      const isValid = await verifySignature(metadata, manifest)
      expect(isValid).toBe(false)
    })
  })
})
