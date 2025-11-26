# ADR-001: Project Setup and Architecture

**Date**: 2025-11-26
**Status**: Implemented
**Branch**: concept

## Context

Secundo is a single-file executable packer for script-based applications. It bundles projects into portable POSIX-compatible self-extracting shell scripts (.sec files). The tool itself is written in TypeScript and uses esbuild for bundling.

## Current State

### Project Structure
```
secundo/                      # Main implementation directory
├── package.json              # Node project config (type: module)
├── tsconfig.json             # TypeScript config (ES2022, strict)
├── build.js                  # esbuild bundler script
├── secundo.spec              # Self-packing configuration
├── src/
│   ├── index.ts              # CLI entry point with command routing
│   ├── cli/                  # Command implementations (skeletons)
│   │   ├── pack.ts           # NOT IMPLEMENTED
│   │   ├── inspect.ts        # NOT IMPLEMENTED
│   │   ├── verify.ts         # NOT IMPLEMENTED
│   │   ├── run.ts            # NOT IMPLEMENTED
│   │   ├── ls.ts             # NOT IMPLEMENTED
│   │   └── uninstall.ts      # NOT IMPLEMENTED
│   ├── core/                 # DOES NOT EXIST YET
│   └── util/
│       └── types.ts          # TypeScript interfaces
└── dist/
    └── secundo.js            # 3.2KB bundled executable

docs/                         # Comprehensive specifications
├── PRD.md                    # Product requirements document
├── posix-extractor.sh        # Complete POSIX stub template
├── high-level-autodetect.md  # Detection algorithm overview
├── project-scan.md           # Project scanning logic
├── interpreter-resolution.md # How to detect interpreter
├── entrypoint-resolution.md  # How to detect entry point
├── application-id-resolution.md
├── interpreter-arguments.md
├── name-version-resolution.md
└── secunod-schema-spec.md    # Spec file format
```

### What's Working
- ✅ TypeScript project with esbuild bundling
- ✅ CLI framework with command routing
- ✅ Build system: `npm run build` → single 3.2KB executable
- ✅ Argument parsing for all commands
- ✅ Help system

### What's NOT Implemented
- ❌ Core detection logic (interpreter, entry, appId, version)
- ❌ Project scanning and metadata extraction
- ❌ Manifest generation
- ❌ Ed25519 signing
- ❌ Payload creation (tar + gzip + base64)
- ❌ POSIX stub embedding
- ❌ Extraction and verification
- ❌ All command implementations

## Key Architectural Decisions

### 1. Web Bundler Approach
**Decision**: Use esbuild to bundle TypeScript → single JavaScript file
**Rationale**:
- Smaller .sec files (3.2KB vs source + node_modules)
- Faster execution (no dependency resolution)
- Cleaner distribution
- Self-hosting: secundo.sec contains only bundled JS + manifest

**Flow**:
```
TypeScript source → esbuild → dist/secundo.js → secundo pack → secundo.sec
```

### 2. Self-Hosting Strategy
**Decision**: Secundo packs itself for distribution
**Rationale**: Perfect dogfooding and validation of the tool

**Bootstrap Process**:
1. Development: Use Node directly (`node dist/secundo.js`)
2. First pack: `secundo pack . -o secundo.sec`
3. Distribution: Ship `secundo.sec` instead of npm package

**Configuration**: `secundo.spec` defines self-packing metadata
```yaml
appId: dev.ixio.secundo
entry: dist/secundo.js
interpreter: node
version: 0.1.0
```

### 3. POSIX Portability
**Constraints**: Only use `/bin/sh`, `base64`, `gzip`, `tar`, `awk`
**Template**: Complete stub exists in `docs/posix-extractor.sh`

### 4. Security Model
- Ed25519 signatures over `SHA256(manifest) || SHA256(payload)`
- Public key embedded in .sec file
- Verification before extraction (best-effort with openssl)

## Implementation Roadmap

### Phase 1: Core Detection (Next Priority)
**Files to Create**:
- `src/core/detect.ts` - Main detection orchestrator
- `src/core/scan.ts` - Project scanning (package.json, files, etc.)
- `src/util/fs.ts` - File system utilities

**Logic** (see docs for full specs):
```typescript
// Pseudocode from docs/high-level-autodetect.md
function autodetect(projectDir) {
  spec = loadSpecIfExists(projectDir)
  meta = scanProject(projectDir)

  return {
    appId: resolveAppId(spec, meta, projectDir),
    interpreter: resolveInterpreter(spec, meta),
    entry: resolveEntrypoint(spec, meta),
    interpreterArgs: resolveInterpreterArgs(spec, meta),
    name: resolveName(spec, meta, projectDir),
    version: resolveVersion(spec, meta)
  }
}
```

**Detection Priority**:
- Interpreter: ts-node → node → python3 → ruby → sh
- Entry: package.json bin/main → common files (main.py, index.ts, etc.)
- AppId: package.json → pyproject.toml → git remote → directory name

### Phase 2: Signing Infrastructure
**Files to Create**:
- `src/core/signer.ts` - Ed25519 key generation and signing
- `src/util/crypto.ts` - Crypto utilities

**Dependencies Needed**:
- `@noble/ed25519` or similar (lightweight Ed25519 lib)

**Operations**:
- Generate key pair (store in `~/.secundo/keys/`)
- Sign `SHA256(manifest) || SHA256(payload)`
- Embed signature + public key in manifest

### Phase 3: Packing
**Files to Create**:
- `src/core/payload.ts` - Create tarball with manifest
- `src/core/embed.ts` - Embed payload in POSIX stub
- `src/core/manifest.ts` - Manifest generation

**Process**:
1. Run detection
2. Create `.secundo/manifest.json`
3. Tar project files + manifest
4. Gzip + Base64 encode
5. Sign manifest + payload hash
6. Load POSIX stub template
7. Replace placeholders (`__SECUNDO_APP_ID__`, etc.)
8. Append payload after `__SECUNDO_PAYLOAD__` marker
9. Write to output file, chmod +x

**Stub Template**: Use `docs/posix-extractor.sh` as base

### Phase 4: Verification & Inspection
**Files to Create**:
- `src/core/extractor.ts` - Parse .sec files
- `src/core/verifier.ts` - Signature verification

**Operations**:
- Find `__SECUNDO_PAYLOAD__` marker
- Extract base64 payload
- Verify hash matches embedded hash
- Verify signature (if openssl available)
- Pretty-print manifest

### Phase 5: Runtime (run command)
- Extract to temp dir
- Spawn interpreter with entry + args
- Pass through stdin/stdout/stderr

### Phase 6: Management (ls, uninstall)
- `ls`: Read `~/.secundo/lib/` structure
- `uninstall`: Remove app directory

## Testing Strategy

### Self-Test
Once `pack` is implemented:
```bash
npm run build
./dist/secundo.js pack . -o secundo.sec --dry-run  # Test detection
./dist/secundo.js pack . -o secundo.sec            # Create .sec
./secundo.sec --help                               # Should work!
```

### Multi-Language Tests
Create example projects in `example/`:
- TypeScript app
- Python script
- Bash script
- Node.js CLI

Pack each and verify they work.

## Dependencies to Add

```json
{
  "dependencies": {
    "@noble/ed25519": "^2.0.0",  // Ed25519 signing
    "yaml": "^2.3.4"              // Parse secundo.spec
  }
}
```

## Open Questions

1. **Key Management**: Where to store private keys? Options:
   - `~/.secundo/keys/default.pem`
   - Per-project keys in project root
   - ENV var override

2. **Version Management**: How to handle multiple installed versions?
   - Current symlink to latest?
   - Semver-aware resolution?

3. **Interpreter Discovery**: What if interpreter not in PATH?
   - Fail fast vs embedded interpreter (out of scope for v0.1)

## Notes

- All detection algorithms fully specified in `docs/`
- POSIX stub is complete and ready to use
- PRD defines all v0.1 requirements
- Out of scope: Windows, encryption, bundled interpreters
- Target Node >=18.0.0 for modern features

## Quick Start for Next Developer

```bash
cd secundo/
npm install
npm run dev            # Watch mode for development
npm run build          # Production build
npm run typecheck      # Type checking

# Start implementing
vim src/core/detect.ts  # Begin with detection logic
```

**First Goal**: Make `secundo pack . --dry-run` print detected configuration.
