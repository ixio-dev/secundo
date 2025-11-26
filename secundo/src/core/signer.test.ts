import { describe, it, expect } from 'vitest'
import { signManifestAndPayload, createSignedManifest } from './signer.js'
import { verify, base64ToBytes } from '../util/crypto.js'
import { sha256 } from '../util/hash.js'
import type { SecundoManifest } from '../util/types.js'

describe('signer', () => {
  describe('signManifestAndPayload', () => {
    it('should create valid signature', async () => {
      const manifestJson = JSON.stringify({ test: 'data' })
      const payloadHash = Buffer.from('abc123', 'hex')

      const { signature, publicKey } = await signManifestAndPayload(
        manifestJson,
        payloadHash
      )

      expect(signature).toBeTruthy()
      expect(publicKey).toBeTruthy()
      expect(typeof signature).toBe('string')
      expect(typeof publicKey).toBe('string')

      // Verify signature is valid
      const manifestHash = sha256(manifestJson)
      const combined = Buffer.concat([manifestHash, payloadHash])
      const signatureBytes = base64ToBytes(signature)
      const publicKeyBytes = base64ToBytes(publicKey)

      const isValid = await verify(signatureBytes, combined, publicKeyBytes)
      expect(isValid).toBe(true)
    })

    it('should produce different signatures for different manifests', async () => {
      const payloadHash = Buffer.from('abc123', 'hex')

      const result1 = await signManifestAndPayload(
        JSON.stringify({ test: 'data1' }),
        payloadHash
      )

      const result2 = await signManifestAndPayload(
        JSON.stringify({ test: 'data2' }),
        payloadHash
      )

      expect(result1.signature).not.toBe(result2.signature)
    })

    it('should produce different signatures for different payloads', async () => {
      const manifestJson = JSON.stringify({ test: 'data' })

      const result1 = await signManifestAndPayload(
        manifestJson,
        Buffer.from('abc123', 'hex')
      )

      const result2 = await signManifestAndPayload(
        manifestJson,
        Buffer.from('def456', 'hex')
      )

      expect(result1.signature).not.toBe(result2.signature)
    })
  })

  describe('createSignedManifest', () => {
    it('should create complete signed manifest', async () => {
      const manifest: Omit<SecundoManifest, 'hash'> = {
        appId: 'com.example.app',
        version: '1.0.0',
        entry: 'index.js',
        interpreter: 'node',
        interpreterArgs: []
      }

      const payloadHash = 'abc123def456'

      const result = await createSignedManifest(manifest, payloadHash)

      // Check unsigned manifest (embedded in payload)
      expect(result.unsignedManifest.appId).toBe('com.example.app')
      expect(result.unsignedManifest.version).toBe('1.0.0')
      expect(result.unsignedManifest.hash).toBe(payloadHash)
      expect(result.unsignedManifest).not.toHaveProperty('signature')
      expect(result.unsignedManifest).not.toHaveProperty('publicKey')

      // Check signed manifest (embedded in shell stub)
      expect(result.signedManifest.appId).toBe('com.example.app')
      expect(result.signedManifest.version).toBe('1.0.0')
      expect(result.signedManifest.hash).toBe(payloadHash)
      expect(result.signedManifest.signature).toBeTruthy()
      expect(result.signedManifest.publicKey).toBeTruthy()

      // Check signature components
      expect(result.signature).toBeTruthy()
      expect(result.publicKey).toBeTruthy()
    })

    it('should preserve all manifest fields', async () => {
      const manifest: Omit<SecundoManifest, 'hash'> = {
        appId: 'com.example.app',
        version: '2.0.0',
        entry: 'src/main.ts',
        interpreter: 'ts-node',
        interpreterArgs: ['--transpile-only'],
        name: 'My App',
        description: 'A test app',
        metadata: { custom: 'value' }
      }

      const result = await createSignedManifest(manifest, 'hash123')

      // Check all fields are preserved in both manifests
      expect(result.unsignedManifest.appId).toBe('com.example.app')
      expect(result.unsignedManifest.version).toBe('2.0.0')
      expect(result.unsignedManifest.entry).toBe('src/main.ts')
      expect(result.unsignedManifest.interpreter).toBe('ts-node')
      expect(result.unsignedManifest.interpreterArgs).toEqual(['--transpile-only'])
      expect(result.unsignedManifest.name).toBe('My App')
      expect(result.unsignedManifest.description).toBe('A test app')
      expect(result.unsignedManifest.metadata).toEqual({ custom: 'value' })

      expect(result.signedManifest.appId).toBe('com.example.app')
      expect(result.signedManifest.version).toBe('2.0.0')
      expect(result.signedManifest.entry).toBe('src/main.ts')
      expect(result.signedManifest.interpreter).toBe('ts-node')
      expect(result.signedManifest.interpreterArgs).toEqual(['--transpile-only'])
      expect(result.signedManifest.name).toBe('My App')
      expect(result.signedManifest.description).toBe('A test app')
      expect(result.signedManifest.metadata).toEqual({ custom: 'value' })
    })

    it('should create verifiable signature', async () => {
      const manifest: Omit<SecundoManifest, 'hash'> = {
        appId: 'com.example.app',
        version: '1.0.0',
        entry: 'index.js',
        interpreter: 'node',
        interpreterArgs: []
      }

      const payloadHash = 'abc123'

      const result = await createSignedManifest(manifest, payloadHash)

      // Recreate the signing input from unsigned manifest
      const manifestJson = JSON.stringify(result.unsignedManifest, null, 2)
      const manifestHash = sha256(manifestJson)
      const payloadHashBuffer = Buffer.from(payloadHash, 'hex')
      const combined = Buffer.concat([manifestHash, payloadHashBuffer])

      // Verify signature using signature from result
      const signatureBytes = base64ToBytes(result.signature)
      const publicKeyBytes = base64ToBytes(result.publicKey)

      const isValid = await verify(signatureBytes, combined, publicKeyBytes)
      expect(isValid).toBe(true)
    })
  })
})
