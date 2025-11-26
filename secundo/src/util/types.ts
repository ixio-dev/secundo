// Manifest stored inside the payload (unsigned)
export interface SecundoManifest {
  appId: string
  version: string
  entry: string
  interpreter: string
  interpreterArgs: string[]
  hash: string
  name?: string
  description?: string
  metadata?: Record<string, any>
}

// Full manifest with signature (used for embedding in shell stub)
export interface SignedSecundoManifest extends SecundoManifest {
  publicKey: string
  signature: string
}

export interface DetectionResult {
  appId: string
  entry: string
  interpreter: string
  interpreterArgs: string[]
  version: string
  name?: string
  metadata: Record<string, any>
  packFolder?: string
  testArgs?: string[]
}

export interface SecundoSpec {
  appId?: string
  entry?: string
  interpreter?: string
  interpreterArgs?: string[]
  name?: string
  version?: string
  description?: string
  metadata?: Record<string, any>
  packFolder?: string
  testArgs?: string[]
}

export interface ProjectMeta {
  packageJson?: any
  pyproject?: any
  requirementsTxt?: boolean
  tsconfig?: boolean
  gitRemote?: string
  files: string[]
  tsFiles: string[]
  jsFiles: string[]
  pyFiles: string[]
  rbFiles: string[]
  shFiles: string[]
  executableScripts: string[]
}

export interface PackOptions {
  projectDir: string
  outputFile?: string
  appId?: string
  entry?: string
  interpreter?: string
  interpreterArgs?: string[]
  noDetect?: boolean
  specPath?: string
  dryRun?: boolean
  json?: boolean
  packFolder?: string
}
