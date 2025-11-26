import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, writeFile, rm, chmod } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { constants } from 'node:fs'
import {
  fileExists,
  readJSON,
  readYAML,
  isExecutable,
  listFilesRecursive,
  findExecutableScripts,
  readGitRemote
} from './fs.js'

describe('fs utilities', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `secundo-fs-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      const filePath = join(testDir, 'test.txt')
      await writeFile(filePath, 'content')
      expect(await fileExists(filePath)).toBe(true)
    })

    it('should return false for non-existing file', async () => {
      const filePath = join(testDir, 'nonexistent.txt')
      expect(await fileExists(filePath)).toBe(false)
    })

    it('should return true for existing directory', async () => {
      const dirPath = join(testDir, 'subdir')
      await mkdir(dirPath)
      expect(await fileExists(dirPath)).toBe(true)
    })
  })

  describe('readJSON', () => {
    it('should read and parse valid JSON file', async () => {
      const jsonPath = join(testDir, 'test.json')
      const data = { name: 'test', version: '1.0.0' }
      await writeFile(jsonPath, JSON.stringify(data))

      const result = await readJSON(jsonPath)
      expect(result).toEqual(data)
    })

    it('should return null for non-existing file', async () => {
      const jsonPath = join(testDir, 'nonexistent.json')
      const result = await readJSON(jsonPath)
      expect(result).toBeNull()
    })

    it('should return null for invalid JSON', async () => {
      const jsonPath = join(testDir, 'invalid.json')
      await writeFile(jsonPath, '{invalid json}')

      const result = await readJSON(jsonPath)
      expect(result).toBeNull()
    })
  })

  describe('readYAML', () => {
    it('should parse simple YAML with key-value pairs', async () => {
      const yamlPath = join(testDir, 'test.yaml')
      const content = `name: test-app
version: 1.0.0
description: A test application`
      await writeFile(yamlPath, content)

      const result = await readYAML(yamlPath)
      expect(result).toEqual({
        name: 'test-app',
        version: '1.0.0',
        description: 'A test application'
      })
    })

    it('should handle quoted values', async () => {
      const yamlPath = join(testDir, 'test.yaml')
      const content = `name: "test app"
description: 'with quotes'`
      await writeFile(yamlPath, content)

      const result = await readYAML(yamlPath)
      expect(result).toEqual({
        name: 'test app',
        description: 'with quotes'
      })
    })

    it('should ignore comments and empty lines', async () => {
      const yamlPath = join(testDir, 'test.yaml')
      const content = `# This is a comment
name: test

# Another comment
version: 1.0.0`
      await writeFile(yamlPath, content)

      const result = await readYAML(yamlPath)
      expect(result).toEqual({
        name: 'test',
        version: '1.0.0'
      })
    })

    it('should return null for non-existing file', async () => {
      const yamlPath = join(testDir, 'nonexistent.yaml')
      const result = await readYAML(yamlPath)
      expect(result).toBeNull()
    })
  })

  describe('isExecutable', () => {
    it('should return true for executable file', async () => {
      const scriptPath = join(testDir, 'script.sh')
      await writeFile(scriptPath, '#!/bin/bash\necho "test"')
      await chmod(scriptPath, 0o755)

      expect(await isExecutable(scriptPath)).toBe(true)
    })

    it('should return false for non-executable file', async () => {
      const filePath = join(testDir, 'file.txt')
      await writeFile(filePath, 'content')
      await chmod(filePath, 0o644)

      expect(await isExecutable(filePath)).toBe(false)
    })

    it('should return false for non-existing file', async () => {
      const filePath = join(testDir, 'nonexistent.sh')
      expect(await isExecutable(filePath)).toBe(false)
    })
  })

  describe('listFilesRecursive', () => {
    it('should list all files in directory', async () => {
      await writeFile(join(testDir, 'file1.txt'), 'content1')
      await writeFile(join(testDir, 'file2.txt'), 'content2')

      const files = await listFilesRecursive(testDir)
      expect(files).toContain('file1.txt')
      expect(files).toContain('file2.txt')
      expect(files).toHaveLength(2)
    })

    it('should list files recursively', async () => {
      const subdir = join(testDir, 'subdir')
      await mkdir(subdir)
      await writeFile(join(testDir, 'root.txt'), 'root')
      await writeFile(join(subdir, 'nested.txt'), 'nested')

      const files = await listFilesRecursive(testDir)
      expect(files).toContain('root.txt')
      expect(files).toContain('subdir/nested.txt')
    })

    it('should ignore node_modules directory', async () => {
      const nodeModules = join(testDir, 'node_modules')
      await mkdir(nodeModules)
      await writeFile(join(nodeModules, 'package.json'), '{}')
      await writeFile(join(testDir, 'index.js'), 'code')

      const files = await listFilesRecursive(testDir)
      expect(files).not.toContain('node_modules/package.json')
      expect(files).toContain('index.js')
    })

    it('should ignore .git directory', async () => {
      const gitDir = join(testDir, '.git')
      await mkdir(gitDir)
      await writeFile(join(gitDir, 'config'), 'git config')
      await writeFile(join(testDir, 'README.md'), 'readme')

      const files = await listFilesRecursive(testDir)
      expect(files).not.toContain('.git/config')
      expect(files).toContain('README.md')
    })

    it('should ignore dist and .secundo directories', async () => {
      const distDir = join(testDir, 'dist')
      const secundoDir = join(testDir, '.secundo')
      await mkdir(distDir)
      await mkdir(secundoDir)
      await writeFile(join(distDir, 'bundle.js'), 'code')
      await writeFile(join(secundoDir, 'manifest.json'), '{}')
      await writeFile(join(testDir, 'src.js'), 'source')

      const files = await listFilesRecursive(testDir)
      expect(files).not.toContain('dist/bundle.js')
      expect(files).not.toContain('.secundo/manifest.json')
      expect(files).toContain('src.js')
    })

    it('should return empty array for non-existing directory', async () => {
      const files = await listFilesRecursive(join(testDir, 'nonexistent'))
      expect(files).toEqual([])
    })
  })

  describe('findExecutableScripts', () => {
    it('should find executable scripts', async () => {
      const script1 = join(testDir, 'script1.sh')
      const script2 = join(testDir, 'script2.sh')
      const nonExec = join(testDir, 'file.txt')

      await writeFile(script1, '#!/bin/bash')
      await writeFile(script2, '#!/bin/bash')
      await writeFile(nonExec, 'text')

      await chmod(script1, 0o755)
      await chmod(script2, 0o755)
      await chmod(nonExec, 0o644)

      const files = ['script1.sh', 'script2.sh', 'file.txt']
      const executables = await findExecutableScripts(files, testDir)

      expect(executables).toContain('script1.sh')
      expect(executables).toContain('script2.sh')
      expect(executables).not.toContain('file.txt')
      expect(executables).toHaveLength(2)
    })

    it('should return empty array when no executables found', async () => {
      const file = join(testDir, 'file.txt')
      await writeFile(file, 'content')
      await chmod(file, 0o644)

      const executables = await findExecutableScripts(['file.txt'], testDir)
      expect(executables).toEqual([])
    })
  })

  describe('readGitRemote', () => {
    it('should read git remote URL from config', async () => {
      const gitDir = join(testDir, '.git')
      await mkdir(gitDir)
      const configPath = join(gitDir, 'config')
      const config = `[core]
	repositoryformatversion = 0
[remote "origin"]
	url = https://github.com/user/repo.git
	fetch = +refs/heads/*:refs/remotes/origin/*`
      await writeFile(configPath, config)

      const remote = await readGitRemote(testDir)
      expect(remote).toBe('https://github.com/user/repo.git')
    })

    it('should return null when .git directory does not exist', async () => {
      const remote = await readGitRemote(testDir)
      expect(remote).toBeNull()
    })

    it('should return null when git config has no remote URL', async () => {
      const gitDir = join(testDir, '.git')
      await mkdir(gitDir)
      const configPath = join(gitDir, 'config')
      await writeFile(configPath, '[core]\n\trepositoryformatversion = 0')

      const remote = await readGitRemote(testDir)
      expect(remote).toBeNull()
    })

    it('should handle git config read errors', async () => {
      const gitDir = join(testDir, '.git')
      await mkdir(gitDir, { mode: 0o000 })

      const remote = await readGitRemote(testDir)
      expect(remote).toBeNull()

      // Restore permissions for cleanup
      await chmod(gitDir, 0o755)
    })
  })
})
