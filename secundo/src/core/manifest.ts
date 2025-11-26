import type { SecundoManifest, DetectionResult } from '../util/types.js'

export function buildManifest(
  detection: DetectionResult,
  payloadHash: string
): Omit<SecundoManifest, 'signature' | 'publicKey' | 'hash'> {
  return {
    appId: detection.appId,
    version: detection.version,
    entry: detection.entry,
    interpreter: detection.interpreter,
    interpreterArgs: detection.interpreterArgs,
    name: detection.name,
    description: detection.metadata.description as string | undefined,
    metadata: detection.metadata
  }
}
