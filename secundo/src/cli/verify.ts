import { parseSecFile, extractManifest, verifySignature } from '../core/sec-parser.js'

export async function verify(args: string[]): Promise<void> {
  if (args.length === 0) {
    console.error('Usage: secundo verify <file.sec>')
    process.exit(1)
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
