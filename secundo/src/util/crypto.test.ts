import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { bytesToHex, hexToBytes, bytesToBase64, base64ToBytes, sign } from './crypto.js'
import * as ed25519 from '@noble/ed25519'

describe('crypto utilities', () => {
  describe('bytesToHex / hexToBytes', () => {
    it('should convert bytes to hex', () => {
      const bytes = new Uint8Array([0, 15, 255, 170])
      const hex = bytesToHex(bytes)
      expect(hex).toBe('000fffaa')
    })

    it('should convert hex to bytes', () => {
      const hex = '000fffaa'
      const bytes = hexToBytes(hex)
      expect(bytes).toEqual(new Uint8Array([0, 15, 255, 170]))
    })

    it('should roundtrip correctly', () => {
      const original = new Uint8Array([1, 2, 3, 255, 254, 253])
      const hex = bytesToHex(original)
      const recovered = hexToBytes(hex)
      expect(recovered).toEqual(original)
    })
  })

  describe('bytesToBase64 / base64ToBytes', () => {
    it('should convert bytes to base64', () => {
      const bytes = new Uint8Array([72, 101, 108, 108, 111])
      const base64 = bytesToBase64(bytes)
      expect(base64).toBe('SGVsbG8=')
    })

    it('should convert base64 to bytes', () => {
      const base64 = 'SGVsbG8='
      const bytes = base64ToBytes(base64)
      expect(bytes).toEqual(new Uint8Array([72, 101, 108, 108, 111]))
    })

    it('should roundtrip correctly', () => {
      const original = new Uint8Array([1, 2, 3, 255, 254, 253])
      const base64 = bytesToBase64(original)
      const recovered = base64ToBytes(base64)
      expect(recovered).toEqual(original)
    })
  })

  describe('sign', () => {
    it('should produce valid Ed25519 signature', async () => {
      const privateKey = ed25519.utils.randomPrivateKey()
      const publicKey = await ed25519.getPublicKeyAsync(privateKey)
      const message = new TextEncoder().encode('test message')

      const signature = await sign(message, privateKey)

      expect(signature).toBeInstanceOf(Uint8Array)
      expect(signature.length).toBe(64)

      const isValid = await ed25519.verifyAsync(signature, message, publicKey)
      expect(isValid).toBe(true)
    })
  })
})
