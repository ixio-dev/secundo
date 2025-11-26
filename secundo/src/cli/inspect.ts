import { basename } from 'node:path'
import { parseSecFile, extractManifest, verifySignature, type SecundoMetadata } from '../core/sec-parser.js'
import type { SecundoManifest } from '../util/types.js'

function displayPackageInfo(metadata: SecundoMetadata, manifest: SecundoManifest): void {
  console.log('📦 Package Information')
  console.log('  App ID:      ', metadata.appId)
  console.log('  Version:     ', manifest.version)
  if (manifest.name) {
    console.log('  Name:        ', manifest.name)
  }
  if (manifest.description) {
    console.log('  Description: ', manifest.description)
  }
  console.log()
}

function displayExecutionInfo(metadata: SecundoMetadata): void {
  console.log('🔧 Execution')
  console.log('  Interpreter: ', metadata.interpreter)
  if (metadata.interpreterArgs.length > 0) {
    console.log('  Args:        ', metadata.interpreterArgs.join(' '))
  }
  console.log('  Entry:       ', metadata.entry)
  console.log()
}

function displaySecurityInfo(metadata: SecundoMetadata, isValid: boolean): void {
  console.log('🔐 Security')
  console.log('  Payload Hash:', metadata.payloadHash)
  console.log('  Public Key:  ', metadata.publicKey.substring(0, 40) + '...')
  console.log('  Signature:   ', metadata.signature.substring(0, 40) + '...')
  console.log()

  console.log('✓ Signature Verification')
  if (isValid) {
    console.log('  Status: ✅ VALID')
  } else {
    console.log('  Status: ❌ INVALID (signature verification failed)')
  }
}

function displayAdditionalMetadata(manifest: SecundoManifest): void {
  if (manifest.metadata && Object.keys(manifest.metadata).length > 0) {
    console.log()
    console.log('📋 Additional Metadata')
    for (const [key, value] of Object.entries(manifest.metadata)) {
      console.log(`  ${key}: ${JSON.stringify(value)}`)
    }
  }
}

export async function inspect(args: string[]): Promise<void> {
  if (args.length === 0) {
    console.error('Usage: secundo inspect <file.sec>')
    process.exit(1)
  }

  const file = args[0]

  try {
    console.log(`Inspecting: ${basename(file)}`)
    console.log()

    const { metadata, payload } = await parseSecFile(file)
    const manifest = await extractManifest(payload)
    const isValid = await verifySignature(metadata, manifest)

    displayPackageInfo(metadata, manifest)
    displayExecutionInfo(metadata)
    displaySecurityInfo(metadata, isValid)
    displayAdditionalMetadata(manifest)

  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`)
    } else {
      console.error('Unknown error occurred')
    }
    process.exit(1)
  }
}
