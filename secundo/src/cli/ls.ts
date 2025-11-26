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

async function readManifestForHash(appDir: string, hash: string): Promise<InstalledApp | null> {
  if (hash === 'current') return null

  const manifestPath = join(appDir, hash, '.secundo', 'manifest.json')

  if (!await fileExists(manifestPath)) {
    return null
  }

  try {
    const manifestContent = await readFile(manifestPath, 'utf-8')
    const manifest: SecundoManifest = JSON.parse(manifestContent)

    return {
      appId: manifest.appId,
      version: manifest.version,
      hash: hash
    }
  } catch {
    return null
  }
}

async function scanAppDirectory(libDir: string, appId: string): Promise<InstalledApp[]> {
  const appDir = join(libDir, appId)
  const apps: InstalledApp[] = []

  try {
    const hashes = await readdir(appDir)

    for (const hash of hashes) {
      const app = await readManifestForHash(appDir, hash)
      if (app) {
        apps.push(app)
      }
    }
  } catch {
    // Skip directories we can't read
  }

  return apps
}

async function getInstalledApps(): Promise<InstalledApp[]> {
  const libDir = join(homedir(), '.secundo', 'lib')

  if (!await fileExists(libDir)) {
    return []
  }

  try {
    const appIds = await readdir(libDir)
    const allApps: InstalledApp[] = []

    for (const appId of appIds) {
      const apps = await scanAppDirectory(libDir, appId)
      allApps.push(...apps)
    }

    return allApps
  } catch {
    return []
  }
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

const HELP = `
secundo ls - List installed applications

USAGE:
  secundo ls

DESCRIPTION:
  Shows all applications installed in ~/.secundo/lib
  with their app ID, version, and payload hash.
`

export async function ls(args: string[]): Promise<void> {
  if (args[0] === '--help' || args[0] === '-h') {
    console.log(HELP)
    process.exit(0)
  }

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
