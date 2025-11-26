export async function run(args: string[]): Promise<void> {
  if (args.length === 0) {
    console.error('Usage: secundo run <file.sec> [args]')
    process.exit(1)
  }

  const file = args[0]
  const runArgs = args.slice(1)
  console.log('Run command not yet implemented')
  console.log('File:', file)
  console.log('Args:', runArgs)
}
