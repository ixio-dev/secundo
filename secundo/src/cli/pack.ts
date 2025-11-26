import { parseArgs } from 'node:util'
import { resolve, basename, join } from 'node:path'
import { rm } from 'node:fs/promises'
import { detect } from '../core/detect.js'
import type { DetectionResult } from '../util/types.js'
import { createSignedManifest } from '../core/signer.js'
import { embedPayload } from '../core/embed.js'
import {
  createProjectTarball,
  addManifestToTarball,
  gzipAndEncode
} from '../core/payload-helper.js'
import { isVerbose } from '../util/config.js'
import { progress, verbose, success, info, dim, bold } from '../util/output.js'

interface PackArgs {
  id?: string
  entry?: string
  interpreter?: string
  args?: string[]
  output?: string
  'no-detect'?: boolean
  spec?: string
  'dry-run'?: boolean
  json?: boolean
  help?: boolean
}

interface PackConfig {
  appId: string
  entry: string
  interpreter: string
  interpreterArgs: string[]
  version: string
  name?: string
  metadata: Record<string, any>
}

function parsePackArgs(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      id: { type: 'string' },
      entry: { type: 'string' },
      interpreter: { type: 'string' },
      args: { type: 'string', multiple: true },
      output: { type: 'string', short: 'o' },
      'no-detect': { type: 'boolean' },
      spec: { type: 'string' },
      'dry-run': { type: 'boolean' },
      json: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' }
    },
    allowPositionals: true
  })

  return { values: values as PackArgs, positionals }
}

function buildPackConfig(detected: DetectionResult, values: PackArgs): PackConfig {
  return {
    appId: values.id || detected.appId,
    entry: values.entry || detected.entry,
    interpreter: values.interpreter || detected.interpreter,
    interpreterArgs: values.args || detected.interpreterArgs,
    version: detected.version,
    name: detected.name,
    metadata: detected.metadata
  }
}

function printPackConfig(config: PackConfig, detected: DetectionResult, outputFile?: string) {
  console.log(bold(`Detected: ${detected.name} v${detected.version}`))
  console.log(`App ID:      ${config.appId}`)
  console.log(`Interpreter: ${config.interpreter}`)
  console.log(`Entry:       ${config.entry}`)
  if (config.interpreterArgs.length > 0) {
    console.log(`Args:        ${config.interpreterArgs.join(' ')}`)
  }
  if (outputFile) {
    console.log(`Output:      ${dim(outputFile)}`)
  }
}

function determineOutputFile(projectDir: string, outputArg?: string): string {
  return outputArg || join(process.cwd(), `${basename(projectDir)}.sec`)
}

async function packProject(
  projectDir: string,
  config: PackConfig,
  outputFile: string
): Promise<string> {
  console.log()
  const verboseEnabled = isVerbose()

  const scanProgress = progress('Scanning project files')
  scanProgress.start()
  verbose(`Scanning directory: ${projectDir}`, verboseEnabled)
  const { tarPath, hash, tempDir } = await createProjectTarball(projectDir)
  scanProgress.succeed('Project scanned')
  verbose(`Tarball created: ${tarPath}`, verboseEnabled)
  info(`Project hash: ${dim(hash.substring(0, 12) + '...')}`)

  let finalPayload: string
  try {
    const signProgress = progress('Signing manifest')
    signProgress.start()
    verbose('Generating Ed25519 signature', verboseEnabled)
    const manifest = await createSignedManifest(
      {
        ...config,
        name: config.name,
        description: config.metadata.description as string | undefined,
        metadata: config.metadata
      },
      hash
    )
    signProgress.succeed('Manifest signed')
    verbose(`Signature: ${manifest.signature.substring(0, 16)}...`, verboseEnabled)

    const buildProgress = progress('Building payload')
    buildProgress.start()
    verbose('Adding manifest to tarball', verboseEnabled)
    await addManifestToTarball(tarPath, JSON.stringify(manifest, null, 2))

    buildProgress.update('Compressing payload')
    verbose('Compressing with gzip level 9', verboseEnabled)
    finalPayload = await gzipAndEncode(tarPath)
    verbose(`Compressed size: ${Math.round(finalPayload.length / 1024)} KB`, verboseEnabled)

    buildProgress.update('Embedding payload')
    verbose('Embedding in POSIX shell stub', verboseEnabled)
    await embedPayload(manifest, finalPayload, outputFile)
    buildProgress.succeed('Payload embedded')
  } finally {
    verbose('Cleaning up temporary files', verboseEnabled)
    await rm(tempDir, { recursive: true, force: true })
  }

  return finalPayload
}

export async function pack(args: string[]): Promise<void> {
  const { values, positionals } = parsePackArgs(args)

  if (values.help || positionals.length === 0) {
    console.log('Usage: secundo pack <projectDir> [options]')
    process.exit(0)
  }

  const projectDir = resolve(positionals[0])

  try {
    const detected = await detect(projectDir)
    const config = buildPackConfig(detected, values)

    if (values.json) {
      console.log(JSON.stringify(config, null, 2))
    } else {
      printPackConfig(config, detected, values.output)
    }

    if (values['dry-run']) {
      process.exit(0)
    }

    const outputFile = determineOutputFile(projectDir, values.output)
    const finalPayload = await packProject(projectDir, config, outputFile)

    console.log()
    success(`Created ${bold(outputFile)}`)
    info(`Size: ${dim((finalPayload.length / 1024).toFixed(1) + ' KB (base64)')}`)
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
