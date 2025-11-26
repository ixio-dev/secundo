import { spawn } from 'node:child_process'
import { join } from 'node:path'

interface TestResult {
  success: boolean
  originalOutput: { stdout: string; stderr: string; exitCode: number | null }
  packedOutput: { stdout: string; stderr: string; exitCode: number | null }
  message?: string
}

async function runCommand(
  command: string,
  args: string[],
  cwd: string
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', (exitCode) => {
      resolve({ stdout, stderr, exitCode })
    })

    child.on('error', (error) => {
      resolve({
        stdout,
        stderr: stderr + error.message,
        exitCode: null
      })
    })
  })
}

export async function testPackedApp(
  projectDir: string,
  interpreter: string,
  interpreterArgs: string[],
  entry: string,
  packedAppPath: string,
  testArgs: string[],
  packFolder?: string
): Promise<TestResult> {
  // Determine the actual entry path
  const sourceDir = packFolder ? join(projectDir, packFolder) : projectDir
  const entryPath = join(sourceDir, entry)

  // Run original app
  const originalOutput = await runCommand(
    interpreter,
    [...interpreterArgs, entryPath, ...testArgs],
    sourceDir
  )

  // Run packed app
  const packedOutput = await runCommand(packedAppPath, testArgs, projectDir)

  // Compare outputs
  const stdoutMatch = originalOutput.stdout === packedOutput.stdout
  const stderrMatch = originalOutput.stderr === packedOutput.stderr
  const exitCodeMatch = originalOutput.exitCode === packedOutput.exitCode

  const success = stdoutMatch && stderrMatch && exitCodeMatch

  let message: string | undefined
  if (!success) {
    const differences: string[] = []
    if (!stdoutMatch) {
      differences.push(`stdout differs`)
    }
    if (!stderrMatch) {
      differences.push(`stderr differs`)
    }
    if (!exitCodeMatch) {
      differences.push(
        `exit code differs (original: ${originalOutput.exitCode}, packed: ${packedOutput.exitCode})`
      )
    }
    message = differences.join(', ')
  }

  return {
    success,
    originalOutput,
    packedOutput,
    message
  }
}
