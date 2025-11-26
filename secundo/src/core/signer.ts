import type { SecundoManifest, SignedSecundoManifest } from '../util/types.js'
import { ensureKeyPair, sign, bytesToBase64 } from '../util/crypto.js'
import { sha256 } from '../util/hash.js'

export interface SigningResult {
  signature: string
  publicKey: string
  unsignedManifest: SecundoManifest
  signedManifest: SignedSecundoManifest
}

export async function signManifestAndPayload(
  manifestJson: string,
  payloadHash: Buffer
): Promise<{ signature: string; publicKey: string }> {
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
  manifest: Omit<SecundoManifest, 'hash'>,
  payloadHash: string
): Promise<SigningResult> {
  // Create unsigned manifest (stored in payload)
  const unsignedManifest: SecundoManifest = {
    ...manifest,
    hash: payloadHash
  }

  // Sign the unsigned manifest + payload hash
  const manifestJson = JSON.stringify(unsignedManifest, null, 2)
  const payloadHashBuffer = Buffer.from(payloadHash, 'hex')

  const { signature, publicKey } = await signManifestAndPayload(
    manifestJson,
    payloadHashBuffer
  )

  // Create signed manifest (stored in shell stub)
  const signedManifest: SignedSecundoManifest = {
    ...unsignedManifest,
    signature,
    publicKey
  }

  return {
    signature,
    publicKey,
    unsignedManifest,
    signedManifest
  }
}
