import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { fileExists } from '../util/fs.js'

export async function uninstall(args: string[]): Promise<void> {
  if (args.length === 0) {
    console.error('Usage: secundo uninstall <appId>')
    process.exit(1)
  }

  const appId = args[0]
  const appDir = join(homedir(), '.secundo', 'lib', appId)

  try {
    if (!await fileExists(appDir)) {
      console.error(`Error: Application '${appId}' is not installed`)
      process.exit(1)
    }

    await rm(appDir, { recursive: true, force: true })
    console.log(`Successfully uninstalled: ${appId}`)

  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`)
    } else {
      console.error('Failed to uninstall application')
    }
    process.exit(1)
  }
}
