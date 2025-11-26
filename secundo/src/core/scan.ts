import { join } from 'node:path'
import type { ProjectMeta } from '../util/types.js'
import {
  fileExists,
  readJSON,
  readYAML,
  listFilesRecursive,
  findExecutableScripts,
  readGitRemote
} from '../util/fs.js'

export async function scanProject(projectDir: string): Promise<ProjectMeta> {
  const meta: ProjectMeta = {
    files: [],
    tsFiles: [],
    jsFiles: [],
    pyFiles: [],
    rbFiles: [],
    shFiles: [],
    executableScripts: []
  }

  // Load package.json
  const packageJsonPath = join(projectDir, 'package.json')
  if (await fileExists(packageJsonPath)) {
    meta.packageJson = await readJSON(packageJsonPath)
  }

  // Load pyproject.toml (simplified YAML-like parsing)
  const pyprojectPath = join(projectDir, 'pyproject.toml')
  if (await fileExists(pyprojectPath)) {
    meta.pyproject = await readYAML(pyprojectPath)
  }

  // Check requirements.txt
  meta.requirementsTxt = await fileExists(join(projectDir, 'requirements.txt'))

  // Check tsconfig.json
  meta.tsconfig = await fileExists(join(projectDir, 'tsconfig.json'))

  // Get git remote
  meta.gitRemote = await readGitRemote(projectDir)

  // List all files
  meta.files = await listFilesRecursive(projectDir)

  // Categorize files by extension
  meta.tsFiles = meta.files.filter(f => f.endsWith('.ts'))
  meta.jsFiles = meta.files.filter(f => f.endsWith('.js'))
  meta.pyFiles = meta.files.filter(f => f.endsWith('.py'))
  meta.rbFiles = meta.files.filter(f => f.endsWith('.rb'))
  meta.shFiles = meta.files.filter(f => f.endsWith('.sh'))

  // Find executable scripts
  meta.executableScripts = await findExecutableScripts(meta.files, projectDir)

  return meta
}
