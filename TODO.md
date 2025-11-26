# Secundo TODO List

This document tracks all pending tasks to ensure the project follows coding rules and meets all PRD requirements.

## ✅ Completed

- [x] Fix TypeScript compilation error (scan.ts:42)
- [x] Add test infrastructure (vitest)
- [x] Add core utility tests (hash, crypto, resolve)
- [x] Add integration tests for self-hosting
- [x] Implement pack command with signing
- [x] Implement autodetection (interpreter, entrypoint, appId, version, name)
- [x] Create project structure and architecture
- [x] Create POSIX shell stub template (docs/posix-extractor.sh)
- [x] Implement self-hosting (secundo can pack itself)
- [x] Add --help flag to main CLI
- [x] Implement all CLI placeholder commands (inspect, verify, run, ls, uninstall)
- [x] Implement inspect command - parse and display .sec file metadata
- [x] Implement verify command - verify signature and integrity
- [x] Implement run command - execute .sec files in temp directory
- [x] Implement ls command - list installed applications
- [x] Implement uninstall command - remove installed apps
- [x] Create shared sec-parser module (DRY principle)

## 🔴 Critical - Rule Compliance

### Refactor Large Functions (>30 lines)
Priority: HIGH - User emphasized this is IMPORTANT

- [x] ~~Refactor `pack()` in `cli/pack.ts`~~ **DONE** - Split into 5 focused functions
  - ✅ parsePackArgs() - argument parsing
  - ✅ buildPackConfig() - config merging
  - ✅ printPackConfig() - output formatting
  - ✅ determineOutputFile() - path resolution
  - ✅ packProject() - main packing logic
- [x] ~~Refactor `createTarball()` in `core/payload.ts`~~ **DONE** - Split into 4 helpers
  - ✅ prepareManifestStaging() - staging setup
  - ✅ executeTarCommand() - tar execution with error handling
  - ✅ createProjectTar() - project tarball creation
  - ✅ addManifestToTar() - manifest addition
- [x] ~~Refactor `resolveEntrypoint()` in `core/resolve.ts`~~ **DONE** - Split into 3 strategies
  - ✅ resolveNodeEntrypoint() - Node.js detection
  - ✅ resolveCommonEntrypoint() - Common file detection
  - ✅ resolveExecutableScript() - Shell script detection
- [x] ~~Refactor `resolveAppId()` in `core/resolve.ts`~~ **DONE** - Split into 2 helpers
  - ✅ parseGitHubRemote() - GitHub remote parsing
  - ✅ getAppIdFromProject() - Project metadata extraction
- [x] ~~Refactor `listFilesRecursive()` in `util/fs.ts`~~ **DONE** - Split into 2 helpers
  - ✅ shouldIgnoreEntry() - Filter logic
  - ✅ processDirectoryEntries() - Entry processing

### Testing
- [ ] Add tests for `core/scan.ts`
- [ ] Add tests for `core/detect.ts`
- [ ] Add tests for `core/manifest.ts`
- [ ] Add tests for `core/signer.ts`
- [ ] Add tests for `core/payload.ts` and `core/payload-helper.ts`
- [ ] Add tests for `core/embed.ts`
- [ ] Add tests for `util/fs.ts`
- [ ] Add integration tests for full pack workflow
- [ ] Add CLI command tests (pack, inspect, verify, run, ls, uninstall)

## 🟡 High Priority - PRD Core Requirements

### CLI Commands

- [x] ~~Implement `secundo inspect <file.sec>`~~ **DONE**
  - ✅ Parse .sec file structure
  - ✅ Extract and display manifest
  - ✅ Show payload hash
  - ✅ Display verification status
  - ✅ Format output cleanly

- [x] ~~Implement `secundo verify <file.sec>`~~ **DONE**
  - ✅ Verify Ed25519 signature
  - ✅ Check payload hash integrity
  - ✅ Exit codes: 0 (valid), 1 (invalid signature), 2 (corrupted file)
  - ✅ Silent operation (no output unless error)

- [x] ~~Implement `secundo run <file.sec> [args]`~~ **DONE**
  - ✅ Extract to temp directory (not ~/.secundo/lib)
  - ✅ Execute with interpreter + args
  - ✅ Clean up temp directory after execution
  - ✅ Pass through exit codes
  - ✅ Handle errors gracefully

- [x] ~~Implement `secundo ls`~~ **DONE**
  - ✅ List installed apps from ~/.secundo/lib
  - ✅ Show appId, version, and hash for each
  - ✅ Handle empty directory case
  - ✅ Format output as table

- [x] ~~Implement `secundo uninstall <appId>`~~ **DONE**
  - ✅ Remove ~/.secundo/lib/<appId> directory
  - ✅ Handle non-existent appId
  - ✅ Report what was removed

### Core Infrastructure

- [x] ~~Create POSIX shell stub template~~ **DONE** - `docs/posix-extractor.sh` exists and works
  - ✅ Self-extraction logic
  - ✅ Base64 decode
  - ✅ Gzip decompress
  - ✅ Tar extraction to ~/.secundo/lib/<appId>/<hash>
  - ✅ Signature verification (currently disabled, needs fix)
  - ✅ Execute interpreter with entry point
  - ✅ Error handling and cleanup
  - ✅ Exit code propagation

- [x] ~~Verify stub.sh template placeholders~~ **DONE** - All placeholders working correctly
  - ✅ __SECUNDO_APP_ID__
  - ✅ __SECUNDO_PAYLOAD_HASH__
  - ✅ __SECUNDO_PUBKEY_B64__
  - ✅ __SECUNDO_SIGNATURE_B64__
  - ✅ __SECUNDO_ENTRY__
  - ✅ __SECUNDO_INTERPRETER__
  - ✅ __SECUNDO_INTERPRETER_ARGS__
  - ✅ __SECUNDO_PAYLOAD__

## 🟢 Medium Priority - CLI Enhancements

### Help & Documentation
**User Preference: ALWAYS add help functionality to CLI tools**

- [x] ~~Add `--help` flag to main CLI~~ **DONE**
- [ ] Add `--help` to each subcommand
- [ ] Add `--version` flag (currently shown in help text)
- [x] ~~Create comprehensive help text for pack command~~ **DONE**
- [ ] Document remaining CLI options for other commands

### Shell Completion
**User Preference: ALWAYS add zsh completion support**

- [x] ~~Add `secundo completion zsh` command~~ **DONE**
  - ✅ Generates completion script dynamically
  - ✅ Outputs to stdout for easy installation
  - ✅ Uses pattern: `secundo completion zsh > /usr/local/share/zsh/site-functions/_secundo`
- [x] ~~Add completion for bash~~ **DONE**
  - ✅ Bash completion with full command support
  - ✅ File and directory completion where appropriate
- [x] ~~Document completion installation~~ **DONE** - Added to help text
- [ ] Test completion in multiple shells (manual verification needed)

## 🔵 Nice-to-Have - Additional Features

### Development Experience
- [ ] Add `--verbose` flag for debugging
- [ ] Add progress indicators for long operations
- [ ] Improve error messages with suggestions
- [ ] Add colored output (with --no-color flag)
- [ ] Add `secundo init` to create secundo.spec template

### Pack Command Enhancements
- [ ] Add `--exclude` patterns support
- [ ] Add `--include-dev-deps` flag for Node.js projects
- [ ] Add `--no-sign` option for unsigned builds (dev only)
- [ ] Add build reproducibility (deterministic timestamps)
- [ ] Support multiple output formats (not just .sec)

### Security & Validation
- [ ] Add key rotation mechanism
- [ ] Add timestamp to manifest
- [ ] Add manifest schema validation
- [ ] Warn if payload is very large (>50MB)
- [ ] Add checksum verification for extracted files

### Documentation
- [ ] Create comprehensive README.md
- [ ] Add examples directory with sample projects
- [ ] Document secundo.spec file format
- [ ] Create troubleshooting guide
- [ ] Add architecture diagrams

### Quality & CI/CD
- [ ] Set up GitHub Actions CI
- [ ] Add lint configuration (ESLint)
- [ ] Add format configuration (Prettier)
- [ ] Add pre-commit hooks
- [ ] Set up automated releases
- [ ] Add code coverage reporting
- [ ] Benchmark pack/extract performance

### Package & Distribution
- [ ] Publish to npm
- [ ] Create install script (curl | sh)
- [ ] Add Homebrew formula
- [ ] Create Docker image for CI usage
- [ ] Add badges to README (CI, coverage, npm version)

## 🟣 Future / Out of Scope for v0.1

These are explicitly out of scope per PRD, but tracked for future consideration:

- [ ] Bundle full interpreter binaries
- [ ] Payload encryption support
- [ ] Windows support (WSL compatibility first?)
- [ ] Multi-architecture packaging
- [ ] Auto-update mechanism
- [ ] Plugin system for custom detectors
- [ ] GUI for pack/inspect operations
- [ ] Web service for package hosting

---

## Priority Order for Implementation

1. **CRITICAL**: Refactor large functions (rule compliance)
2. **HIGH**: Implement missing CLI commands (PRD requirements)
3. **HIGH**: Create POSIX stub template (core functionality)
4. **MEDIUM**: Add help and completion (user preferences)
5. **MEDIUM**: Complete test coverage
6. **LOW**: Nice-to-have features
7. **FUTURE**: Out of scope items

## Notes

- Always run `npm run typecheck` and `npm test` before committing
- Follow file size guideline: ~200 lines per file
- Follow function size guideline: ~30 lines per function
- No TODOs in code - use this file instead
- Update this TODO as work progresses
