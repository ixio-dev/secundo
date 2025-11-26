import type { SecundoManifest } from '../util/types.js'
import { ensureKeyPair, sign, bytesToBase64 } from '../util/crypto.js'
import { sha256 } from '../util/hash.js'

export interface SigningResult {
  signature: string
  publicKey: string
}

export async function signManifestAndPayload(
  manifestJson: string,
  payloadHash: Buffer
): Promise<SigningResult> {
  const keyPair = await ensureKeyPair()

  // Create combined hash: SHA256(manifest) || SHA256(payload)
  const manifestHash = sha256(manifestJson)
  const combined = Buffer.concat([manifestHash, payloadHash])

  const signatureBytes = await sign(new Uint8Array(combined), keyPair.privateKey)

  return {
    signature: bytesToBase64(signatureBytes),
    publicKey: bytesToBase64(keyPair.publicKey)
  }
}

export async function createSignedManifest(
  manifest: Omit<SecundoManifest, 'signature' | 'publicKey' | 'hash'>,
  payloadHash: string
): Promise<SecundoManifest> {
  const unsignedManifest: Omit<SecundoManifest, 'signature' | 'publicKey'> = {
    ...manifest,
    hash: payloadHash
  }

  const manifestJson = JSON.stringify(unsignedManifest, null, 2)
  const payloadHashBuffer = Buffer.from(payloadHash, 'hex')

  const { signature, publicKey } = await signManifestAndPayload(
    manifestJson,
    payloadHashBuffer
  )

  return {
    ...unsignedManifest,
    signature,
    publicKey
  }
}
