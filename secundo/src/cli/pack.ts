import { parseArgs } from 'node:util'
import type { PackOptions } from '../util/types.js'

export async function pack(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      id: { type: 'string' },
      entry: { type: 'string' },
      interpreter: { type: 'string' },
      args: { type: 'string', multiple: true },
      output: { type: 'string', short: 'o' },
      'no-detect': { type: 'boolean' },
      spec: { type: 'string' },
      'dry-run': { type: 'boolean' },
      json: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' }
    },
    allowPositionals: true
  })

  if (values.help || positionals.length === 0) {
    console.log('Usage: secundo pack <projectDir> [options]')
    process.exit(0)
  }

  const projectDir = positionals[0]

  const options: PackOptions = {
    projectDir,
    outputFile: values.output as string | undefined,
    appId: values.id as string | undefined,
    entry: values.entry as string | undefined,
    interpreter: values.interpreter as string | undefined,
    interpreterArgs: values.args as string[] | undefined,
    noDetect: values['no-detect'] as boolean | undefined,
    specPath: values.spec as string | undefined,
    dryRun: values['dry-run'] as boolean | undefined,
    json: values.json as boolean | undefined
  }

  console.log('Pack command not yet implemented')
  console.log('Options:', options)
}
