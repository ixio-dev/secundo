import { writeFile, chmod } from 'node:fs/promises'
import type { SecundoManifest } from '../util/types.js'
import stubTemplate from '../stub/posix-extractor.sh'

export async function embedPayload(
  manifest: SecundoManifest,
  payload: string,
  outputPath: string
): Promise<void> {
  let stub = stubTemplate

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

  const markerLine = '__SECUNDO_PAYLOAD__'
  const lines = stub.split('\n')
  const markerIndex = lines.findIndex((line: string) => line.trim() === markerLine)

  if (markerIndex === -1) {
    throw new Error('Payload marker not found in stub template')
  }

  const stubLines = lines.slice(0, markerIndex + 1)
  const finalContent = stubLines.join('\n') + '\n' + payload

  await writeFile(outputPath, finalContent, 'utf-8')
  await chmod(outputPath, 0o755)
}
