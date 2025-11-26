import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileExists } from '../util/fs.js'
import { success, error, warning, info } from '../util/output.js'

const SPEC_TEMPLATE = `# Secundo Specification File
# Override autodetection with custom configuration

# Required fields (uncomment and set values)
# appId: com.example.myapp
# version: 1.0.0
# entry: src/index.js
# interpreter: node

# Optional fields
# name: My Application
# description: A single-file executable application

# Interpreter arguments (uncomment to use)
# interpreterArgs:
#   - --experimental-modules
#   - --no-warnings

# Additional metadata
# metadata:
#   author: Your Name
#   license: MIT
#   homepage: https://example.com
`

export async function init(args: string[]): Promise<void> {
  const cwd = process.cwd()
  const specPath = join(cwd, 'secundo.spec')

  // Check if spec already exists
  if (await fileExists(specPath)) {
    warning('secundo.spec already exists')
    info('Use --force to overwrite')

    if (!args.includes('--force')) {
      process.exit(1)
    }

    warning('Overwriting existing secundo.spec')
  }

  try {
    await writeFile(specPath, SPEC_TEMPLATE, 'utf-8')
    success('Created secundo.spec')
    info('Edit secundo.spec to configure your application')
    info('Run `secundo pack` to create your executable')
  } catch (err) {
    error(`Failed to create secundo.spec: ${err instanceof Error ? err.message : err}`)
    process.exit(1)
  }
}
