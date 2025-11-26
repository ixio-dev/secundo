import { describe, it, expect } from 'vitest'
import { buildManifest } from './manifest.js'
import type { DetectionResult } from '../util/types.js'

describe('buildManifest', () => {
  it('should build manifest from detection result', () => {
    const detection: DetectionResult = {
      appId: 'com.example.app',
      version: '1.0.0',
      entry: 'src/index.js',
      interpreter: 'node',
      interpreterArgs: [],
      name: 'Test App',
      metadata: {
        description: 'A test application'
      }
    }

    const manifest = buildManifest(detection, 'abc123')

    expect(manifest.appId).toBe('com.example.app')
    expect(manifest.version).toBe('1.0.0')
    expect(manifest.entry).toBe('src/index.js')
    expect(manifest.interpreter).toBe('node')
    expect(manifest.interpreterArgs).toEqual([])
    expect(manifest.name).toBe('Test App')
    expect(manifest.description).toBe('A test application')
    expect(manifest.metadata).toEqual({ description: 'A test application' })
  })

  it('should handle missing optional fields', () => {
    const detection: DetectionResult = {
      appId: 'com.example.app',
      version: '1.0.0',
      entry: 'main.py',
      interpreter: 'python3',
      interpreterArgs: [],
      metadata: {}
    }

    const manifest = buildManifest(detection, 'xyz789')

    expect(manifest.appId).toBe('com.example.app')
    expect(manifest.name).toBeUndefined()
    expect(manifest.description).toBeUndefined()
    expect(manifest.metadata).toEqual({})
  })

  it('should include interpreter args', () => {
    const detection: DetectionResult = {
      appId: 'com.example.app',
      version: '1.0.0',
      entry: 'src/main.ts',
      interpreter: 'ts-node',
      interpreterArgs: ['--transpile-only', '--esm'],
      metadata: {}
    }

    const manifest = buildManifest(detection, 'hash123')

    expect(manifest.interpreterArgs).toEqual(['--transpile-only', '--esm'])
  })

  it('should preserve all metadata fields', () => {
    const detection: DetectionResult = {
      appId: 'com.example.app',
      version: '2.5.1',
      entry: 'cli.js',
      interpreter: 'node',
      interpreterArgs: [],
      metadata: {
        description: 'CLI tool',
        author: 'John Doe',
        license: 'MIT',
        custom: { nested: 'value' }
      }
    }

    const manifest = buildManifest(detection, 'hash456')

    expect(manifest.metadata).toEqual({
      description: 'CLI tool',
      author: 'John Doe',
      license: 'MIT',
      custom: { nested: 'value' }
    })
  })
})
