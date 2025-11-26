import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn } from 'node:child_process'
import { rm, access } from 'node:fs/promises'
import { join } from 'node:path'

const SECUNDO_BIN = join(process.cwd(), 'dist', 'secundo.js')
const TEST_OUTPUT = join(process.cwd(), 'test-output.sec')
const PROJECT_DIR = process.cwd() // Pack the secundo directory itself

function execCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, { cwd: process.cwd() })
    let stdout = ''
    let stderr = ''

    proc.stdout?.on('data', (data) => { stdout += data.toString() })
    proc.stderr?.on('data', (data) => { stderr += data.toString() })

    proc.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 0 })
    })
  })
}

describe('Self-hosting Integration Tests', () => {
  beforeAll(async () => {
    // Clean up any existing test output
    try {
      await rm(TEST_OUTPUT)
    } catch {
      // File doesn't exist, that's fine
    }
  })

  afterAll(async () => {
    // Clean up test output
    try {
      await rm(TEST_OUTPUT)
    } catch {
      // Ignore cleanup errors
    }
  })

  it('should be able to pack itself into a .sec file', async () => {
    // Run: node dist/secundo.js pack . -o test-output.sec
    const result = await execCommand('node', [
      SECUNDO_BIN,
      'pack',
      PROJECT_DIR,
      '-o',
      TEST_OUTPUT
    ])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Created:')

    // Verify the .sec file was created
    await expect(access(TEST_OUTPUT)).resolves.toBeUndefined()
  }, 30000) // 30 second timeout for packing

  it('packed .sec file should be executable', async () => {
    // Check if file exists from previous test
    await expect(access(TEST_OUTPUT)).resolves.toBeUndefined()

    // Run: sh test-output.sec --help
    const result = await execCommand('sh', [TEST_OUTPUT, '--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('secundo')
    expect(result.stdout).toContain('pack')
  }, 10000)

  it('packed .sec file should show correct version', async () => {
    const result = await execCommand('sh', [TEST_OUTPUT, '--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('v0.1.0')
  }, 10000)

  it('should have POSIX stub with all required components', async () => {
    const { stdout } = await execCommand('head', ['-100', TEST_OUTPUT])

    // Check for all required placeholder replacements
    expect(stdout).toContain('APP_ID=')
    expect(stdout).toContain('APP_PAYLOAD_HASH=')
    expect(stdout).toContain('PUBKEY_B64=')
    expect(stdout).toContain('SIGNATURE_B64=')
    expect(stdout).toContain('ENTRY=')
    expect(stdout).toContain('INTERPRETER=')
    expect(stdout).toContain('__SECUNDO_PAYLOAD__')

    // Ensure placeholders were replaced (no double underscores)
    expect(stdout).not.toContain('__SECUNDO_APP_ID__')
    expect(stdout).not.toContain('__SECUNDO_ENTRY__')
  }, 10000)
})
