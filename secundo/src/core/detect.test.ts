import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { detect } from './detect.js'

describe('detect', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `detect-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  it('should detect Node.js project with package.json', async () => {
    await writeFile(
      join(testDir, 'package.json'),
      JSON.stringify({
        name: 'test-app',
        version: '1.2.3',
        main: 'index.js'
      })
    )
    await writeFile(join(testDir, 'index.js'), 'console.log("test")')

    const result = await detect(testDir)

    expect(result.appId).toContain('test-app')
    expect(result.version).toBe('1.2.3')
    expect(result.entry).toBe('index.js')
    expect(result.interpreter).toBe('node')
    expect(result.name).toBe('test-app')
  })

  it('should detect TypeScript project', async () => {
    await writeFile(
      join(testDir, 'package.json'),
      JSON.stringify({
        name: 'ts-app',
        version: '2.0.0'
      })
    )
    await writeFile(join(testDir, 'tsconfig.json'), '{}')
    await writeFile(join(testDir, 'index.ts'), 'console.log("test")')

    const result = await detect(testDir)

    expect(result.interpreter).toBe('ts-node')
    expect(result.entry).toBe('index.ts')
  })

  it('should use secundo.spec overrides', async () => {
    await writeFile(
      join(testDir, 'package.json'),
      JSON.stringify({ name: 'test', version: '1.0.0' })
    )
    await writeFile(join(testDir, 'index.js'), 'console.log("test")')
    await writeFile(
      join(testDir, 'secundo.spec'),
      `appId: com.custom.app
entry: custom.js
interpreter: node
version: 3.0.0
name: Custom App
description: Custom description`
    )

    const result = await detect(testDir)

    expect(result.appId).toBe('com.custom.app')
    expect(result.entry).toBe('custom.js')
    expect(result.version).toBe('3.0.0')
    expect(result.name).toBe('Custom App')
    expect(result.metadata.description).toBe('Custom description')
  })

  it('should handle interpreter args from spec', async () => {
    await writeFile(
      join(testDir, 'package.json'),
      JSON.stringify({ name: 'test', version: '1.0.0' })
    )
    await writeFile(join(testDir, 'index.ts'), 'console.log("test")')
    await writeFile(join(testDir, 'tsconfig.json'), '{}')
    await writeFile(
      join(testDir, 'secundo.spec'),
      `entry: index.ts
interpreter: ts-node
interpreterArgs:
  - --transpile-only
  - --esm`
    )

    const result = await detect(testDir)

    expect(result.interpreter).toBe('ts-node')
    expect(result.interpreterArgs).toEqual(['--transpile-only', '--esm'])
  })

  it('should detect Python project', async () => {
    await writeFile(join(testDir, 'requirements.txt'), 'requests==2.28.0')
    await writeFile(join(testDir, 'main.py'), 'print("test")')

    const result = await detect(testDir)

    expect(result.interpreter).toBe('python3')
    expect(result.entry).toBe('main.py')
  })

  it('should detect executable shell script', async () => {
    const scriptPath = join(testDir, 'script.sh')
    await writeFile(scriptPath, '#!/bin/bash\necho test')
    await import('node:fs/promises').then(fs => fs.chmod(scriptPath, 0o755))

    const result = await detect(testDir)

    expect(result.interpreter).toBe('sh')
    expect(result.entry).toBe('script.sh')
  })

  it('should include metadata from spec', async () => {
    await writeFile(
      join(testDir, 'package.json'),
      JSON.stringify({ name: 'test', version: '1.0.0' })
    )
    await writeFile(join(testDir, 'index.js'), 'console.log("test")')
    await writeFile(
      join(testDir, 'secundo.spec'),
      `entry: index.js
interpreter: node
metadata:
  author: John Doe
  license: MIT
  custom: value`
    )

    const result = await detect(testDir)

    expect(result.metadata).toEqual({
      description: '',
      author: 'John Doe',
      license: 'MIT',
      custom: 'value'
    })
  })

  it('should prefer spec description over package.json', async () => {
    await writeFile(
      join(testDir, 'package.json'),
      JSON.stringify({
        name: 'test',
        version: '1.0.0',
        description: 'Package description'
      })
    )
    await writeFile(join(testDir, 'index.js'), 'console.log("test")')
    await writeFile(
      join(testDir, 'secundo.spec'),
      `description: Spec description`
    )

    const result = await detect(testDir)

    expect(result.metadata.description).toBe('Spec description')
  })

  it('should use package.json description when spec has none', async () => {
    await writeFile(
      join(testDir, 'package.json'),
      JSON.stringify({
        name: 'test',
        version: '1.0.0',
        description: 'Package description'
      })
    )
    await writeFile(join(testDir, 'index.js'), 'console.log("test")')

    const result = await detect(testDir)

    expect(result.metadata.description).toBe('Package description')
  })

  it('should handle projects with no package.json or spec', async () => {
    await writeFile(join(testDir, 'main.py'), 'print("hello")')

    const result = await detect(testDir)

    expect(result.interpreter).toBe('python3')
    expect(result.entry).toBe('main.py')
    expect(result.version).toBe('0.1.0')
  })

  it('should detect Ruby project', async () => {
    await writeFile(join(testDir, 'main.rb'), 'puts "hello"')

    const result = await detect(testDir)

    expect(result.interpreter).toBe('ruby')
    expect(result.entry).toBe('main.rb')
  })

  it('should handle empty interpreterArgs', async () => {
    await writeFile(join(testDir, 'index.js'), 'console.log("test")')
    await writeFile(
      join(testDir, 'secundo.spec'),
      `entry: index.js
interpreter: node`
    )

    const result = await detect(testDir)

    expect(result.interpreterArgs).toEqual([])
  })
})
