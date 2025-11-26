import { parseArgs } from 'node:util'
import { pack } from './cli/pack.js'
import { inspect } from './cli/inspect.js'
import { verify } from './cli/verify.js'
import { run } from './cli/run.js'
import { ls } from './cli/ls.js'
import { uninstall } from './cli/uninstall.js'
import { completion } from './cli/completion.js'
import { schema } from './cli/schema.js'
import { init } from './cli/init.js'
import { setVerbose, setNoColor } from './util/config.js'
import { enableColor } from './util/output.js'

const USAGE = `
secundo v0.1.0 - Single-file executable packer

USAGE:
  secundo pack <projectDir> [options]     Create a .sec executable
  secundo inspect <file.sec>              Show manifest and verify
  secundo verify <file.sec>               Verify signature (exit codes)
  secundo run <file.sec> [args]           Run without installing
  secundo ls                              List installed apps
  secundo uninstall <appId>               Remove installed app
  secundo init [--force]                  Create secundo.spec template
  secundo completion <shell>              Generate shell completion script
  secundo schema                          Output JSON schema for secundo.spec

GLOBAL OPTIONS:
  --verbose                               Enable verbose output
  --no-color                              Disable colored output
  -h, --help                              Show this help

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

COMPLETION:
  # Zsh (add to ~/.zshrc):
  secundo completion zsh > /usr/local/share/zsh/site-functions/_secundo

  # Bash (add to ~/.bashrc or ~/.bash_profile):
  source <(secundo completion bash)

EXAMPLES:
  secundo pack .
  secundo pack ./myapp -o myapp.sec --verbose
  secundo pack . --id com.example.app --entry src/main.ts
  secundo init
  secundo inspect myapp.sec
  secundo run myapp.sec --help
`

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(USAGE)
    process.exit(0)
  }

  // Parse global flags
  const verboseIndex = args.indexOf('--verbose')
  const noColorIndex = args.indexOf('--no-color')

  if (verboseIndex !== -1) {
    setVerbose(true)
    args.splice(verboseIndex, 1)
  }

  if (noColorIndex !== -1) {
    setNoColor(true)
    enableColor(false)
    args.splice(noColorIndex, 1)
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
      case 'init':
        await init(commandArgs)
        break
      case 'completion':
        await completion(commandArgs)
        break
      case 'schema':
        await schema(commandArgs)
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
