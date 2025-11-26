import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawn } from 'node:child_process'
import { createGunzip } from 'node:zlib'
import { createReadStream, createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import {
  createProjectTarball,
  addManifestToTarball,
  gzipAndEncode
} from './payload-helper.js'

describe('payload-helper', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `secundo-payload-helper-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  async function extractTarball(tarPath: string, extractDir: string): Promise<void> {
    await mkdir(extractDir, { recursive: true })

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

  async function listTarballContents(tarPath: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const tar = spawn('tar', ['-tf', tarPath], {
        stdio: ['ignore', 'pipe', 'pipe']
      })

      let stdout = ''
      let stderr = ''

      tar.stdout?.on('data', (data) => {
        stdout += data.toString()
      })

      tar.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      tar.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`tar list failed: ${stderr}`))
        } else {
          const files = stdout.trim().split('\n').filter(f => f.length > 0)
          resolve(files)
        }
      })

      tar.on('error', reject)
    })
  }

  describe('createProjectTarball', () => {
    it('should create tarball of project files', async () => {
      const projectDir = join(testDir, 'project')
      await mkdir(projectDir)
      await writeFile(join(projectDir, 'index.js'), 'console.log("hello")')
      await writeFile(join(projectDir, 'package.json'), '{"name":"test"}')

      const result = await createProjectTarball(projectDir)

      expect(result.tarPath).toBeTruthy()
      expect(result.hash).toBeTruthy()
      expect(result.tempDir).toBeTruthy()
      expect(result.hash).toMatch(/^[a-f0-9]{64}$/)

      // Verify tarball exists and contains files
      const contents = await listTarballContents(result.tarPath)
      expect(contents).toContain('./index.js')
      expect(contents).toContain('./package.json')

      await rm(result.tempDir, { recursive: true, force: true })
    })

    it('should exclude node_modules directory', async () => {
      const projectDir = join(testDir, 'project-with-modules')
      await mkdir(projectDir)
      const nodeModules = join(projectDir, 'node_modules')
      await mkdir(nodeModules)
      await writeFile(join(nodeModules, 'package.json'), '{}')
      await writeFile(join(projectDir, 'src.js'), 'code')

      const result = await createProjectTarball(projectDir)

      const contents = await listTarballContents(result.tarPath)
      expect(contents).not.toContain('./node_modules/package.json')
      expect(contents).toContain('./src.js')

      await rm(result.tempDir, { recursive: true, force: true })
    })

    it('should exclude .git directory', async () => {
      const projectDir = join(testDir, 'project-with-git')
      await mkdir(projectDir)
      const gitDir = join(projectDir, '.git')
      await mkdir(gitDir)
      await writeFile(join(gitDir, 'config'), 'git config')
      await writeFile(join(projectDir, 'index.js'), 'code')

      const result = await createProjectTarball(projectDir)

      const contents = await listTarballContents(result.tarPath)
      expect(contents).not.toContain('./.git/config')
      expect(contents).toContain('./index.js')

      await rm(result.tempDir, { recursive: true, force: true })
    })

    it('should exclude .secundo directory', async () => {
      const projectDir = join(testDir, 'project-with-secundo')
      await mkdir(projectDir)
      const secundoDir = join(projectDir, '.secundo')
      await mkdir(secundoDir)
      await writeFile(join(secundoDir, 'manifest.json'), '{}')
      await writeFile(join(projectDir, 'main.js'), 'code')

      const result = await createProjectTarball(projectDir)

      const contents = await listTarballContents(result.tarPath)
      expect(contents).not.toContain('./.secundo/manifest.json')
      expect(contents).toContain('./main.js')

      await rm(result.tempDir, { recursive: true, force: true })
    })

    it('should exclude .sec files', async () => {
      const projectDir = join(testDir, 'project-with-sec')
      await mkdir(projectDir)
      await writeFile(join(projectDir, 'app.sec'), 'executable')
      await writeFile(join(projectDir, 'src.js'), 'source')

      const result = await createProjectTarball(projectDir)

      const contents = await listTarballContents(result.tarPath)
      expect(contents).not.toContain('./app.sec')
      expect(contents).toContain('./src.js')

      await rm(result.tempDir, { recursive: true, force: true })
    })

    it('should include nested directories', async () => {
      const projectDir = join(testDir, 'project-nested')
      await mkdir(projectDir)
      const srcDir = join(projectDir, 'src')
      const libDir = join(srcDir, 'lib')
      await mkdir(libDir, { recursive: true })
      await writeFile(join(srcDir, 'index.js'), 'entry')
      await writeFile(join(libDir, 'helper.js'), 'helper')

      const result = await createProjectTarball(projectDir)

      const contents = await listTarballContents(result.tarPath)
      expect(contents).toContain('./src/index.js')
      expect(contents).toContain('./src/lib/helper.js')

      await rm(result.tempDir, { recursive: true, force: true })
    })

    it('should return consistent hash for same content', async () => {
      const projectDir = join(testDir, 'project-consistent')
      await mkdir(projectDir)
      await writeFile(join(projectDir, 'test.js'), 'content')

      const result1 = await createProjectTarball(projectDir)
      await rm(result1.tempDir, { recursive: true, force: true })

      const result2 = await createProjectTarball(projectDir)
      await rm(result2.tempDir, { recursive: true, force: true })

      // Hashes should be the same for identical content
      expect(result1.hash).toBe(result2.hash)
    })
  })

  describe('addManifestToTarball', () => {
    it('should add manifest to existing tarball', async () => {
      const projectDir = join(testDir, 'project-manifest')
      await mkdir(projectDir)
      await writeFile(join(projectDir, 'index.js'), 'code')

      const result = await createProjectTarball(projectDir)

      const manifest = {
        appId: 'com.example.test',
        version: '1.0.0'
      }

      await addManifestToTarball(result.tarPath, JSON.stringify(manifest, null, 2))

      const contents = await listTarballContents(result.tarPath)
      expect(contents).toContain('.secundo/manifest.json')
      expect(contents).toContain('./index.js')

      await rm(result.tempDir, { recursive: true, force: true })
    })

    it('should preserve manifest JSON structure', async () => {
      const projectDir = join(testDir, 'project-manifest-json')
      await mkdir(projectDir)
      await writeFile(join(projectDir, 'app.js'), 'app')

      const result = await createProjectTarball(projectDir)

      const manifest = {
        appId: 'com.example.structured',
        version: '2.0.0',
        metadata: {
          author: 'John Doe',
          license: 'MIT'
        }
      }

      await addManifestToTarball(result.tarPath, JSON.stringify(manifest, null, 2))

      // Extract and verify
      const extractDir = join(testDir, 'extracted')
      await extractTarball(result.tarPath, extractDir)

      const manifestPath = join(extractDir, '.secundo', 'manifest.json')
      const manifestContent = await readFile(manifestPath, 'utf-8')
      const parsed = JSON.parse(manifestContent)

      expect(parsed).toEqual(manifest)

      await rm(result.tempDir, { recursive: true, force: true })
    })
  })

  describe('gzipAndEncode', () => {
    it('should gzip and base64 encode tarball', async () => {
      const projectDir = join(testDir, 'project-encode')
      await mkdir(projectDir)
      await writeFile(join(projectDir, 'data.txt'), 'test data')

      const result = await createProjectTarball(projectDir)

      const encoded = await gzipAndEncode(result.tarPath)

      expect(encoded).toBeTruthy()
      expect(typeof encoded).toBe('string')
      // Base64 encoded string should only contain valid characters
      expect(encoded).toMatch(/^[A-Za-z0-9+/=]+$/)

      await rm(result.tempDir, { recursive: true, force: true })
    })

    it('should produce decodable and decompressible output', async () => {
      const projectDir = join(testDir, 'project-decode')
      await mkdir(projectDir)
      const originalContent = 'This is test content for compression'
      await writeFile(join(projectDir, 'file.txt'), originalContent)

      const result = await createProjectTarball(projectDir)
      const encoded = await gzipAndEncode(result.tarPath)

      // Decode and decompress
      const decoded = Buffer.from(encoded, 'base64')
      const decompressedPath = join(testDir, 'decompressed.tar')
      const { Readable } = await import('node:stream')
      const output = createWriteStream(decompressedPath)
      const gunzip = createGunzip()

      await pipeline(
        Readable.from([decoded]),
        gunzip,
        output
      )

      // Verify tarball can be read
      const contents = await listTarballContents(decompressedPath)
      expect(contents).toContain('./file.txt')

      await rm(result.tempDir, { recursive: true, force: true })
    })

    it('should compress data effectively', async () => {
      const projectDir = join(testDir, 'project-compress')
      await mkdir(projectDir)
      // Create file with repetitive content (should compress well)
      const repetitiveContent = 'a'.repeat(10000)
      await writeFile(join(projectDir, 'large.txt'), repetitiveContent)

      const result = await createProjectTarball(projectDir)
      const encoded = await gzipAndEncode(result.tarPath)

      // The encoded size should be significantly smaller than original
      const encodedSize = encoded.length
      const originalSize = repetitiveContent.length

      // With compression, this should be much smaller
      expect(encodedSize).toBeLessThan(originalSize)

      await rm(result.tempDir, { recursive: true, force: true })
    })
  })

  describe('integration: full payload creation flow', () => {
    it('should create complete payload with project and manifest', async () => {
      const projectDir = join(testDir, 'full-project')
      await mkdir(projectDir)
      await writeFile(join(projectDir, 'index.js'), 'console.log("app")')
      await writeFile(join(projectDir, 'package.json'), '{"name":"app"}')

      const srcDir = join(projectDir, 'src')
      await mkdir(srcDir)
      await writeFile(join(srcDir, 'lib.js'), 'module.exports = {}')

      // Create tarball
      const result = await createProjectTarball(projectDir)

      // Add manifest
      const manifest = {
        appId: 'com.example.full',
        version: '1.0.0',
        entry: 'index.js',
        interpreter: 'node'
      }
      await addManifestToTarball(result.tarPath, JSON.stringify(manifest, null, 2))

      // Encode
      const payload = await gzipAndEncode(result.tarPath)

      // Verify complete payload
      expect(payload).toBeTruthy()
      expect(payload).toMatch(/^[A-Za-z0-9+/=]+$/)

      // Decode and extract to verify contents
      const decoded = Buffer.from(payload, 'base64')
      const decompressedPath = join(testDir, 'final.tar')
      const { Readable } = await import('node:stream')
      const output = createWriteStream(decompressedPath)
      const gunzip = createGunzip()

      await pipeline(
        Readable.from([decoded]),
        gunzip,
        output
      )

      const contents = await listTarballContents(decompressedPath)
      expect(contents).toContain('./index.js')
      expect(contents).toContain('./package.json')
      expect(contents).toContain('./src/lib.js')
      expect(contents).toContain('.secundo/manifest.json')
      expect(contents).not.toContain('node_modules')

      await rm(result.tempDir, { recursive: true, force: true })
    })
  })
})
