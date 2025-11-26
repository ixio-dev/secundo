export async function verify(args: string[]): Promise<void> {
  if (args.length === 0) {
    console.error('Usage: secundo verify <file.sec>')
    process.exit(1)
  }

  const file = args[0]
  console.log('Verify command not yet implemented')
  console.log('File:', file)
}
