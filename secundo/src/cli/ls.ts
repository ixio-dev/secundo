import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { fileExists } from '../util/fs.js'
import type { SecundoManifest } from '../util/types.js'

interface InstalledApp {
  appId: string
  version: string
  hash: string
}

async function getInstalledApps(): Promise<InstalledApp[]> {
  const libDir = join(homedir(), '.secundo', 'lib')

  if (!await fileExists(libDir)) {
    return []
  }

  const apps: InstalledApp[] = []

  try {
    const appIds = await readdir(libDir)

    for (const appId of appIds) {
      const appDir = join(libDir, appId)

      try {
        const hashes = await readdir(appDir)

        for (const hash of hashes) {
          if (hash === 'current') continue

          const manifestPath = join(appDir, hash, '.secundo', 'manifest.json')

          if (await fileExists(manifestPath)) {
            try {
              const manifestContent = await readFile(manifestPath, 'utf-8')
              const manifest: SecundoManifest = JSON.parse(manifestContent)

              apps.push({
                appId: manifest.appId,
                version: manifest.version,
                hash: hash
              })
            } catch {
              // Skip invalid manifests
            }
          }
        }
      } catch {
        // Skip directories we can't read
      }
    }
  } catch {
    return []
  }

  return apps
}

function formatAsTable(apps: InstalledApp[]): void {
  if (apps.length === 0) {
    console.log('No installed applications found.')
    return
  }

  const maxAppIdLen = Math.max(...apps.map(a => a.appId.length), 'APP ID'.length)
  const maxVersionLen = Math.max(...apps.map(a => a.version.length), 'VERSION'.length)

  const appIdCol = 'APP ID'.padEnd(maxAppIdLen)
  const versionCol = 'VERSION'.padEnd(maxVersionLen)
  const hashCol = 'HASH'

  console.log(`${appIdCol}  ${versionCol}  ${hashCol}`)
  console.log('─'.repeat(maxAppIdLen + maxVersionLen + 70))

  for (const app of apps) {
    const appIdField = app.appId.padEnd(maxAppIdLen)
    const versionField = app.version.padEnd(maxVersionLen)
    console.log(`${appIdField}  ${versionField}  ${app.hash}`)
  }
}

export async function ls(args: string[]): Promise<void> {
  try {
    const apps = await getInstalledApps()
    formatAsTable(apps)
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`)
    } else {
      console.error('Unknown error occurred')
    }
    process.exit(1)
  }
}
