import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { scanProject } from './scan.js'

describe('scanProject', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `scan-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  it('should scan an empty directory', async () => {
    const meta = await scanProject(testDir)

    expect(meta.files).toEqual([])
    expect(meta.tsFiles).toEqual([])
    expect(meta.jsFiles).toEqual([])
    expect(meta.pyFiles).toEqual([])
    expect(meta.rbFiles).toEqual([])
    expect(meta.shFiles).toEqual([])
    expect(meta.executableScripts).toEqual([])
    expect(meta.packageJson).toBeUndefined()
    expect(meta.pyproject).toBeUndefined()
    expect(meta.requirementsTxt).toBe(false)
    expect(meta.tsconfig).toBe(false)
  })

  it('should detect package.json', async () => {
    await writeFile(
      join(testDir, 'package.json'),
      JSON.stringify({ name: 'test', version: '1.0.0' })
    )

    const meta = await scanProject(testDir)

    expect(meta.packageJson).toBeDefined()
    expect(meta.packageJson?.name).toBe('test')
    expect(meta.packageJson?.version).toBe('1.0.0')
  })

  it('should detect TypeScript files', async () => {
    await writeFile(join(testDir, 'index.ts'), 'console.log("test")')
    await writeFile(join(testDir, 'app.ts'), 'console.log("app")')

    const meta = await scanProject(testDir)

    expect(meta.tsFiles).toHaveLength(2)
    expect(meta.tsFiles).toContain('index.ts')
    expect(meta.tsFiles).toContain('app.ts')
  })

  it('should detect JavaScript files', async () => {
    await writeFile(join(testDir, 'index.js'), 'console.log("test")')
    await writeFile(join(testDir, 'app.js'), 'console.log("app")')

    const meta = await scanProject(testDir)

    expect(meta.jsFiles).toHaveLength(2)
    expect(meta.jsFiles).toContain('index.js')
    expect(meta.jsFiles).toContain('app.js')
  })

  it('should detect Python files', async () => {
    await writeFile(join(testDir, 'main.py'), 'print("test")')
    await writeFile(join(testDir, 'app.py'), 'print("app")')

    const meta = await scanProject(testDir)

    expect(meta.pyFiles).toHaveLength(2)
    expect(meta.pyFiles).toContain('main.py')
    expect(meta.pyFiles).toContain('app.py')
  })

  it('should detect Ruby files', async () => {
    await writeFile(join(testDir, 'main.rb'), 'puts "test"')

    const meta = await scanProject(testDir)

    expect(meta.rbFiles).toHaveLength(1)
    expect(meta.rbFiles).toContain('main.rb')
  })

  it('should detect shell scripts', async () => {
    await writeFile(join(testDir, 'script.sh'), '#!/bin/bash\necho test')

    const meta = await scanProject(testDir)

    expect(meta.shFiles).toHaveLength(1)
    expect(meta.shFiles).toContain('script.sh')
  })

  it('should detect tsconfig.json', async () => {
    await writeFile(join(testDir, 'tsconfig.json'), '{}')

    const meta = await scanProject(testDir)

    expect(meta.tsconfig).toBe(true)
  })

  it('should detect requirements.txt', async () => {
    await writeFile(join(testDir, 'requirements.txt'), 'requests==2.28.0')

    const meta = await scanProject(testDir)

    expect(meta.requirementsTxt).toBe(true)
  })

  it('should categorize mixed file types correctly', async () => {
    await writeFile(join(testDir, 'index.ts'), 'export {}')
    await writeFile(join(testDir, 'app.js'), 'module.exports = {}')
    await writeFile(join(testDir, 'main.py'), 'import sys')
    await writeFile(join(testDir, 'script.sh'), '#!/bin/bash')

    const meta = await scanProject(testDir)

    expect(meta.files).toHaveLength(4)
    expect(meta.tsFiles).toHaveLength(1)
    expect(meta.jsFiles).toHaveLength(1)
    expect(meta.pyFiles).toHaveLength(1)
    expect(meta.shFiles).toHaveLength(1)
  })
})
