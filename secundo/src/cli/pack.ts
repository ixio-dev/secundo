import { parseArgs } from 'node:util'
import { resolve, basename, join } from 'node:path'
import { rm } from 'node:fs/promises'
import { detect } from '../core/detect.js'
import { buildManifest } from '../core/manifest.js'
import { createSignedManifest } from '../core/signer.js'
import { embedPayload } from '../core/embed.js'
import {
  createProjectTarball,
  addManifestToTarball,
  gzipAndEncode
} from '../core/payload-helper.js'

export async function pack(args: string[]): Promise<void> {
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

  if (values.help || positionals.length === 0) {
    console.log('Usage: secundo pack <projectDir> [options]')
    process.exit(0)
  }

  const projectDir = resolve(positionals[0])

  try {
    // Run detection
    const detected = await detect(projectDir)

    // Apply CLI overrides
    const config = {
      appId: (values.id as string) || detected.appId,
      entry: (values.entry as string) || detected.entry,
      interpreter: (values.interpreter as string) || detected.interpreter,
      interpreterArgs: (values.args as string[]) || detected.interpreterArgs,
      version: detected.version,
      name: detected.name,
      metadata: detected.metadata
    }

    // Output format
    if (values.json) {
      console.log(JSON.stringify(config, null, 2))
    } else {
      console.log(`Detected: ${detected.name} v${detected.version}`)
      console.log(`App ID:      ${config.appId}`)
      console.log(`Interpreter: ${config.interpreter}`)
      console.log(`Entry:       ${config.entry}`)
      if (config.interpreterArgs.length > 0) {
        console.log(`Args:        ${config.interpreterArgs.join(' ')}`)
      }
      if (values.output) {
        console.log(`Output:      ${values.output}`)
      }
    }

    if (values['dry-run']) {
      process.exit(0)
    }

    // Determine output file
    const outputFile = (values.output as string) || join(
      process.cwd(),
      `${basename(projectDir)}.sec`
    )

    console.log('\nPacking...')

    // Step 1: Create project tarball (without manifest) and get hash
    console.log('  Creating project tarball...')
    const { tarPath, hash, tempDir } = await createProjectTarball(projectDir)
    console.log(`  ✓ Project hash: ${hash}`)

    let finalPayload: string
    try {
      // Step 2: Create signed manifest with project hash
      console.log('  Signing manifest...')
      const manifest = await createSignedManifest(
        {
          ...config,
          name: config.name,
          description: config.metadata.description as string | undefined,
          metadata: config.metadata
        },
        hash
      )
      console.log('  ✓ Manifest signed')

      // Step 3: Add manifest to tarball
      console.log('  Adding manifest to tarball...')
      await addManifestToTarball(tarPath, JSON.stringify(manifest, null, 2))

      // Step 4: Gzip and encode
      console.log('  Compressing and encoding...')
      finalPayload = await gzipAndEncode(tarPath)

      // Step 5: Embed in stub
      console.log('  Embedding in POSIX stub...')
      await embedPayload(manifest, finalPayload, outputFile)
    } finally {
      // Cleanup temp directory
      await rm(tempDir, { recursive: true, force: true })
    }

    console.log(`\n✅ Created: ${outputFile}`)
    console.log(`   Size: ${(finalPayload!.length / 1024).toFixed(1)} KB (base64)`)
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
