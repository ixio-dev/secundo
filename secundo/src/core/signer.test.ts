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
      const manifest: Omit<SecundoManifest, 'signature' | 'publicKey' | 'hash'> = {
        appId: 'com.example.app',
        version: '1.0.0',
        entry: 'index.js',
        interpreter: 'node',
        interpreterArgs: []
      }

      const payloadHash = 'abc123def456'

      const signedManifest = await createSignedManifest(manifest, payloadHash)

      expect(signedManifest.appId).toBe('com.example.app')
      expect(signedManifest.version).toBe('1.0.0')
      expect(signedManifest.hash).toBe(payloadHash)
      expect(signedManifest.signature).toBeTruthy()
      expect(signedManifest.publicKey).toBeTruthy()
    })

    it('should preserve all manifest fields', async () => {
      const manifest: Omit<SecundoManifest, 'signature' | 'publicKey' | 'hash'> = {
        appId: 'com.example.app',
        version: '2.0.0',
        entry: 'src/main.ts',
        interpreter: 'ts-node',
        interpreterArgs: ['--transpile-only'],
        name: 'My App',
        description: 'A test app',
        metadata: { custom: 'value' }
      }

      const signedManifest = await createSignedManifest(manifest, 'hash123')

      expect(signedManifest.appId).toBe('com.example.app')
      expect(signedManifest.version).toBe('2.0.0')
      expect(signedManifest.entry).toBe('src/main.ts')
      expect(signedManifest.interpreter).toBe('ts-node')
      expect(signedManifest.interpreterArgs).toEqual(['--transpile-only'])
      expect(signedManifest.name).toBe('My App')
      expect(signedManifest.description).toBe('A test app')
      expect(signedManifest.metadata).toEqual({ custom: 'value' })
    })

    it('should create verifiable signature', async () => {
      const manifest: Omit<SecundoManifest, 'signature' | 'publicKey' | 'hash'> = {
        appId: 'com.example.app',
        version: '1.0.0',
        entry: 'index.js',
        interpreter: 'node',
        interpreterArgs: []
      }

      const payloadHash = 'abc123'

      const signedManifest = await createSignedManifest(manifest, payloadHash)

      // Recreate the signing input
      const unsignedManifest = { ...manifest, hash: payloadHash }
      const manifestJson = JSON.stringify(unsignedManifest, null, 2)
      const manifestHash = sha256(manifestJson)
      const payloadHashBuffer = Buffer.from(payloadHash, 'hex')
      const combined = Buffer.concat([manifestHash, payloadHashBuffer])

      // Verify signature
      const signatureBytes = base64ToBytes(signedManifest.signature)
      const publicKeyBytes = base64ToBytes(signedManifest.publicKey)

      const isValid = await verify(signatureBytes, combined, publicKeyBytes)
      expect(isValid).toBe(true)
    })
  })
})
