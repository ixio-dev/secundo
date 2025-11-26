import { join } from 'node:path'
import type { DetectionResult, SecundoSpec } from '../util/types.js'
import { fileExists, readYAML } from '../util/fs.js'
import { scanProject } from './scan.js'
import {
  resolveAppId,
  resolveInterpreter,
  resolveEntrypoint,
  resolveInterpreterArgs,
  resolveName,
  resolveVersion
} from './resolve.js'

export async function detect(projectDir: string): Promise<DetectionResult> {
  // Load spec if exists
  const spec = await loadSpec(projectDir)

  // Scan project for metadata
  const meta = await scanProject(projectDir)

  // Resolve all fields
  const result: DetectionResult = {
    appId: resolveAppId(spec, meta, projectDir),
    interpreter: resolveInterpreter(spec, meta),
    entry: await resolveEntrypoint(spec, meta, projectDir),
    interpreterArgs: resolveInterpreterArgs(spec, meta),
    version: resolveVersion(spec, meta),
    name: resolveName(spec, meta, projectDir),
    metadata: {
      description: spec?.description || meta.packageJson?.description || '',
      ...(spec?.metadata || {})
    }
  }

  return result
}

async function loadSpec(projectDir: string): Promise<SecundoSpec | null> {
  const specPath = join(projectDir, 'secundo.spec')

  if (!await fileExists(specPath)) {
    return null
  }

  const spec = await readYAML(specPath)

  // Parse interpreterArgs if it's a string (YAML array representation)
  if (spec?.interpreterArgs && typeof spec.interpreterArgs === 'string') {
    try {
      // Handle YAML array format like "[arg1, arg2]"
      spec.interpreterArgs = spec.interpreterArgs
        .replace(/^\[|\]$/g, '')
        .split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0)
    } catch {
      spec.interpreterArgs = []
    }
  }

  return spec
}
