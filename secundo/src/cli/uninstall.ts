import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { fileExists } from '../util/fs.js'

const HELP = `
secundo uninstall - Remove installed application

USAGE:
  secundo uninstall <appId>

DESCRIPTION:
  Removes an installed application from ~/.secundo/lib.
  Use 'secundo ls' to see installed app IDs.

EXAMPLES:
  secundo uninstall com.example.myapp
  secundo uninstall local.myproject
`

export async function uninstall(args: string[]): Promise<void> {
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(HELP)
    process.exit(args.length === 0 ? 1 : 0)
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
