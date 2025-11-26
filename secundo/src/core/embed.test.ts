import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, readFile, rm, access } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { constants } from 'node:fs'
import { embedPayload } from './embed.js'
import type { SecundoManifest } from '../util/types.js'

describe('embedPayload', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `secundo-embed-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  it('should create executable with embedded payload', async () => {
    const manifest: SecundoManifest = {
      appId: 'com.example.test',
      version: '1.0.0',
      entry: 'index.js',
      interpreter: 'node',
      interpreterArgs: [],
      hash: 'abc123def456',
      publicKey: 'pubkey-base64',
      signature: 'signature-base64',
      metadata: {}
    }

    const payload = Buffer.from('test payload data').toString('base64')
    const outputPath = join(testDir, 'test.sec')

    await embedPayload(manifest, payload, outputPath)

    const content = await readFile(outputPath, 'utf-8')
    expect(content).toBeTruthy()
    expect(content).toContain('__SECUNDO_PAYLOAD__')
    expect(content).toContain(payload)
  })

  it('should replace all manifest placeholders', async () => {
    const manifest: SecundoManifest = {
      appId: 'com.test.app',
      version: '2.0.0',
      entry: 'src/cli.js',
      interpreter: 'node',
      interpreterArgs: ['--experimental-modules'],
      hash: 'hash123',
      publicKey: 'pubkey123',
      signature: 'sig123',
      metadata: {}
    }

    const payload = 'base64payload'
    const outputPath = join(testDir, 'output.sec')

    await embedPayload(manifest, payload, outputPath)

    const content = await readFile(outputPath, 'utf-8')
    expect(content).toContain('com.test.app')
    expect(content).toContain('hash123')
    expect(content).toContain('pubkey123')
    expect(content).toContain('sig123')
    expect(content).toContain('src/cli.js')
    expect(content).toContain('node')
    expect(content).toContain('--experimental-modules')
  })

  it('should make output file executable', async () => {
    const manifest: SecundoManifest = {
      appId: 'com.example.exec-test',
      version: '1.0.0',
      entry: 'main.py',
      interpreter: 'python3',
      interpreterArgs: [],
      hash: 'hash',
      publicKey: 'key',
      signature: 'sig',
      metadata: {}
    }

    const outputPath = join(testDir, 'executable.sec')
    await embedPayload(manifest, 'payload', outputPath)

    // Check if file is executable
    await expect(
      access(outputPath, constants.X_OK)
    ).resolves.toBeUndefined()
  })

  it('should place payload after marker line', async () => {
    const manifest: SecundoManifest = {
      appId: 'com.example.marker-test',
      version: '1.0.0',
      entry: 'app.js',
      interpreter: 'node',
      interpreterArgs: [],
      hash: 'h',
      publicKey: 'k',
      signature: 's',
      metadata: {}
    }

    const payload = 'my-test-payload-data'
    const outputPath = join(testDir, 'marker.sec')

    await embedPayload(manifest, payload, outputPath)

    const content = await readFile(outputPath, 'utf-8')
    const lines = content.split('\n')
    const markerIndex = lines.findIndex(line => line.trim() === '__SECUNDO_PAYLOAD__')

    expect(markerIndex).toBeGreaterThan(-1)

    // Payload should be after the marker
    const afterMarker = lines.slice(markerIndex + 1).join('\n')
    expect(afterMarker).toContain(payload)
  })

  it('should handle interpreter args as JSON array', async () => {
    const manifest: SecundoManifest = {
      appId: 'com.example.args-test',
      version: '1.0.0',
      entry: 'cli.ts',
      interpreter: 'tsx',
      interpreterArgs: ['--tsconfig', 'tsconfig.json', '--experimental'],
      hash: 'h',
      publicKey: 'k',
      signature: 's',
      metadata: {}
    }

    const outputPath = join(testDir, 'args.sec')
    await embedPayload(manifest, 'payload', outputPath)

    const content = await readFile(outputPath, 'utf-8')
    const argsJson = JSON.stringify(manifest.interpreterArgs)
    expect(content).toContain(argsJson)
  })

  it('should handle empty interpreter args', async () => {
    const manifest: SecundoManifest = {
      appId: 'com.example.no-args',
      version: '1.0.0',
      entry: 'index.js',
      interpreter: 'node',
      interpreterArgs: [],
      hash: 'h',
      publicKey: 'k',
      signature: 's',
      metadata: {}
    }

    const outputPath = join(testDir, 'no-args.sec')
    await embedPayload(manifest, 'payload', outputPath)

    const content = await readFile(outputPath, 'utf-8')
    expect(content).toContain('[]')
  })

  it('should not contain placeholder strings in output', async () => {
    const manifest: SecundoManifest = {
      appId: 'com.example.placeholder-test',
      version: '1.0.0',
      entry: 'main.js',
      interpreter: 'node',
      interpreterArgs: [],
      hash: 'actual-hash',
      publicKey: 'actual-key',
      signature: 'actual-sig',
      metadata: {}
    }

    const outputPath = join(testDir, 'placeholders.sec')
    await embedPayload(manifest, 'payload', outputPath)

    const content = await readFile(outputPath, 'utf-8')
    expect(content).not.toContain('__SECUNDO_APP_ID__')
    expect(content).not.toContain('__SECUNDO_PAYLOAD_HASH__')
    expect(content).not.toContain('__SECUNDO_PUBKEY_B64__')
    expect(content).not.toContain('__SECUNDO_SIGNATURE_B64__')
    expect(content).not.toContain('__SECUNDO_ENTRY__')
    expect(content).not.toContain('__SECUNDO_INTERPRETER__')
    expect(content).not.toContain('__SECUNDO_INTERPRETER_ARGS__')
  })

  it('should preserve shell script structure', async () => {
    const manifest: SecundoManifest = {
      appId: 'com.example.shell-test',
      version: '1.0.0',
      entry: 'run.sh',
      interpreter: 'bash',
      interpreterArgs: [],
      hash: 'h',
      publicKey: 'k',
      signature: 's',
      metadata: {}
    }

    const outputPath = join(testDir, 'shell.sec')
    await embedPayload(manifest, 'payload', outputPath)

    const content = await readFile(outputPath, 'utf-8')

    // Should start with shebang
    expect(content.startsWith('#!/')).toBe(true)

    // Should have shell variable assignments
    expect(content).toMatch(/APP_ID=/)
    expect(content).toMatch(/APP_PAYLOAD_HASH=/)
  })
})
