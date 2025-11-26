export async function uninstall(args: string[]): Promise<void> {
  if (args.length === 0) {
    console.error('Usage: secundo uninstall <appId>')
    process.exit(1)
  }

  const appId = args[0]
  console.log('Uninstall command not yet implemented')
  console.log('AppId:', appId)
}
