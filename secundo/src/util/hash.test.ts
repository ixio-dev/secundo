import { describe, it, expect } from 'vitest'
import { sha256, sha256Hex } from './hash.js'

describe('hash utilities', () => {
  describe('sha256', () => {
    it('should hash string input', () => {
      const result = sha256('hello world')
      expect(result).toBeInstanceOf(Buffer)
      expect(result.length).toBe(32)
    })

    it('should hash buffer input', () => {
      const input = Buffer.from('hello world')
      const result = sha256(input)
      expect(result).toBeInstanceOf(Buffer)
      expect(result.length).toBe(32)
    })

    it('should produce consistent hashes', () => {
      const hash1 = sha256('test')
      const hash2 = sha256('test')
      expect(hash1.equals(hash2)).toBe(true)
    })

    it('should produce different hashes for different inputs', () => {
      const hash1 = sha256('test1')
      const hash2 = sha256('test2')
      expect(hash1.equals(hash2)).toBe(false)
    })
  })

  describe('sha256Hex', () => {
    it('should return hex string', () => {
      const result = sha256Hex('hello world')
      expect(typeof result).toBe('string')
      expect(result).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should produce known hash for known input', () => {
      const result = sha256Hex('hello world')
      expect(result).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9')
    })
  })
})
