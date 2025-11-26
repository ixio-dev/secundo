import { readFile, writeFile, chmod } from 'node:fs/promises'
import { join } from 'node:path'
import type { SecundoManifest } from '../util/types.js'

export async function embedPayload(
  manifest: SecundoManifest,
  payload: string,
  outputPath: string
): Promise<void> {
  // Load stub template from docs
  const stubPath = join(process.cwd(), '..', 'docs', 'posix-extractor.sh')
  let stub = await readFile(stubPath, 'utf-8')

  // Replace placeholders (use replaceAll for all occurrences)
  stub = stub.replaceAll('__SECUNDO_APP_ID__', manifest.appId)
  stub = stub.replaceAll('__SECUNDO_PAYLOAD_HASH__', manifest.hash)
  stub = stub.replaceAll('__SECUNDO_PUBKEY_B64__', manifest.publicKey)
  stub = stub.replaceAll('__SECUNDO_SIGNATURE_B64__', manifest.signature)
  stub = stub.replaceAll('__SECUNDO_ENTRY__', manifest.entry)
  stub = stub.replaceAll('__SECUNDO_INTERPRETER__', manifest.interpreter)
  stub = stub.replaceAll(
    '__SECUNDO_INTERPRETER_ARGS__',
    JSON.stringify(manifest.interpreterArgs)
  )

  // Find the payload marker and append payload after it
  const markerLine = '__SECUNDO_PAYLOAD__'
  const lines = stub.split('\n')
  const markerIndex = lines.findIndex(line => line.trim() === markerLine)

  if (markerIndex === -1) {
    throw new Error('Payload marker not found in stub template')
  }

  // Build final content: stub up to and including marker, then payload
  const stubLines = lines.slice(0, markerIndex + 1)
  const finalContent = stubLines.join('\n') + '\n' + payload

  // Write to output file
  await writeFile(outputPath, finalContent, 'utf-8')

  // Make executable
  await chmod(outputPath, 0o755)
}
