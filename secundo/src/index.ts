import { parseArgs } from 'node:util'
import { pack } from './cli/pack.js'
import { inspect } from './cli/inspect.js'
import { verify } from './cli/verify.js'
import { run } from './cli/run.js'
import { ls } from './cli/ls.js'
import { uninstall } from './cli/uninstall.js'

const USAGE = `
secundo v0.1.0 - Single-file executable packer

USAGE:
  secundo pack <projectDir> [options]     Create a .sec executable
  secundo inspect <file.sec>              Show manifest and verify
  secundo verify <file.sec>               Verify signature (exit codes)
  secundo run <file.sec> [args]           Run without installing
  secundo ls                              List installed apps
  secundo uninstall <appId>               Remove installed app

PACK OPTIONS:
  --id <appId>            Override autodetected appId
  --entry <file>          Override autodetected entrypoint
  --interpreter <cmd>     Override autodetected interpreter
  --args <args...>        Interpreter arguments
  -o, --output <file>     Output file name
  --no-detect             Disable autodetection (spec only)
  --spec <path>           Use custom spec file
  --dry-run               Show detected config but don't pack
  --json                  Output detection result as JSON
  -h, --help              Show this help

EXAMPLES:
  secundo pack .
  secundo pack ./myapp -o myapp.sec
  secundo pack . --id com.example.app --entry src/main.ts
  secundo inspect myapp.sec
  secundo run myapp.sec --help
`

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(USAGE)
    process.exit(0)
  }

  const command = args[0]
  const commandArgs = args.slice(1)

  try {
    switch (command) {
      case 'pack':
        await pack(commandArgs)
        break
      case 'inspect':
        await inspect(commandArgs)
        break
      case 'verify':
        await verify(commandArgs)
        break
      case 'run':
        await run(commandArgs)
        break
      case 'ls':
        await ls(commandArgs)
        break
      case 'uninstall':
        await uninstall(commandArgs)
        break
      default:
        console.error(`Unknown command: ${command}`)
        console.log(USAGE)
        process.exit(1)
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

main()
