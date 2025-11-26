import * as ed25519 from '@noble/ed25519'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { fileExists } from './fs.js'

const SIGN_DIR = join(homedir(), '.secundo', 'dev', 'sign')
const PRIVATE_KEY_FILE = join(SIGN_DIR, 'private.key')
const PUBLIC_KEY_FILE = join(SIGN_DIR, 'public.key')

export interface KeyPair {
  privateKey: Uint8Array
  publicKey: Uint8Array
}

export async function ensureKeyPair(): Promise<KeyPair> {
  // Check if keys already exist
  if (await fileExists(PRIVATE_KEY_FILE) && await fileExists(PUBLIC_KEY_FILE)) {
    return await loadKeyPair()
  }

  // Generate new key pair
  return await generateAndSaveKeyPair()
}

export async function loadKeyPair(): Promise<KeyPair> {
  const privateKeyHex = await readFile(PRIVATE_KEY_FILE, 'utf-8')
  const publicKeyHex = await readFile(PUBLIC_KEY_FILE, 'utf-8')

  return {
    privateKey: hexToBytes(privateKeyHex.trim()),
    publicKey: hexToBytes(publicKeyHex.trim())
  }
}

export async function generateAndSaveKeyPair(): Promise<KeyPair> {
  // Ensure directory exists
  await mkdir(SIGN_DIR, { recursive: true })

  // Generate key pair
  const privateKey = ed25519.utils.randomPrivateKey()
  const publicKey = await ed25519.getPublicKeyAsync(privateKey)

  // Save keys as hex
  await writeFile(PRIVATE_KEY_FILE, bytesToHex(privateKey), 'utf-8')
  await writeFile(PUBLIC_KEY_FILE, bytesToHex(publicKey), 'utf-8')

  console.log(`Generated new Ed25519 key pair in ${SIGN_DIR}`)

  return { privateKey, publicKey }
}

export async function sign(message: Uint8Array, privateKey: Uint8Array): Promise<Uint8Array> {
  return await ed25519.signAsync(message, privateKey)
}

export async function verify(
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array
): Promise<boolean> {
  try {
    return await ed25519.verifyAsync(signature, message, publicKey)
  } catch {
    return false
  }
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
  }
  return bytes
}

export function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64')
}

export function base64ToBytes(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, 'base64'))
}
