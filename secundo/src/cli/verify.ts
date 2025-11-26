import { parseSecFile, extractManifest, verifySignature } from '../core/sec-parser.js'

const HELP = `
secundo verify - Verify .sec file signature

USAGE:
  secundo verify <file.sec>

DESCRIPTION:
  Verifies the Ed25519 signature and payload integrity.
  Silent on success; exits with appropriate code.

EXIT CODES:
  0  Signature valid
  1  Signature invalid
  2  File corrupted or unreadable

EXAMPLES:
  secundo verify myapp.sec && echo "Valid"
  secundo verify myapp.sec || echo "Invalid or corrupted"
`

export async function verify(args: string[]): Promise<void> {
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(HELP)
    process.exit(args.length === 0 ? 1 : 0)
  }

  const file = args[0]

  try {
    const { metadata, payload } = await parseSecFile(file)
    const manifest = await extractManifest(payload)
    const isValid = await verifySignature(metadata, manifest)

    if (isValid) {
      process.exit(0)
    } else {
      process.exit(1)
    }
  } catch (error) {
    process.exit(2)
  }
}
