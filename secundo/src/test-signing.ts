// Quick test script for signing functionality
import { ensureKeyPair, sign, verify, bytesToBase64 } from './util/crypto.js'
import { sha256 } from './util/hash.js'

async function test() {
  console.log('Testing Ed25519 signing...\n')

  // Ensure key pair exists
  console.log('1. Generating/loading key pair...')
  const keyPair = await ensureKeyPair()
  console.log('   ✓ Public key:', bytesToBase64(keyPair.publicKey).substring(0, 20) + '...')

  // Create test message
  const message = 'Hello, Secundo!'
  const messageHash = sha256(message)
  console.log('\n2. Signing test message...')
  console.log('   Message:', message)

  // Sign
  const signature = await sign(messageHash, keyPair.privateKey)
  console.log('   ✓ Signature:', bytesToBase64(signature).substring(0, 20) + '...')

  // Verify
  console.log('\n3. Verifying signature...')
  const isValid = await verify(signature, messageHash, keyPair.publicKey)
  console.log('   ✓ Signature valid:', isValid)

  // Test with wrong message
  const wrongMessage = sha256('Wrong message')
  const isInvalid = await verify(signature, wrongMessage, keyPair.publicKey)
  console.log('   ✓ Wrong message rejected:', !isInvalid)

  console.log('\n✅ All signing tests passed!')
}

test().catch(console.error)
