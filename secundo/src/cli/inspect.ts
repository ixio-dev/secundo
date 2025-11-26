export async function inspect(args: string[]): Promise<void> {
  if (args.length === 0) {
    console.error('Usage: secundo inspect <file.sec>')
    process.exit(1)
  }

  const file = args[0]
  console.log('Inspect command not yet implemented')
  console.log('File:', file)
}
