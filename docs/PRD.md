# Secundo – Product Requirements Document (v0.1)

## Overview
Secundo is a single-file executable packer for script-based applications. It bundles a project directory into a portable POSIX-compatible shell script that self-extracts its resources and launches the declared entrypoint. Secundo focuses on simplicity, portability, cryptographic integrity, and predictable behavior across diverse UNIX-like systems.

## Core Goals
1. Produce a single self-contained `.sec` executable that runs anywhere with `/bin/sh`, `base64`, `gzip`, and `tar`.
2. Bundle script-based applications (e.g., TypeScript, Python, Bash, Node, Ruby) without requiring a custom runtime.
3. Ensure authenticity with Ed25519 signature and embedded public key.
4. Provide deterministic extraction into `~/.secundo/lib/<appId>/<hash>`.
5. Autodetect interpreter, entrypoint, and metadata with minimal configuration.
6. Be fully open source.

## Target Use Cases
- Packaging CLI utilities written in TypeScript, Python, or Bash.
- Distributing internal tools without installers.
- Sending small apps to servers without container dependencies.
- Portable scripting tools for CI or development machines.

## Out of Scope for v0.1
- Bundling full interpreter binaries.
- Payload encryption.
- Windows support.
- Multi-architecture packaging.

# v0.1 Requirements

## Functional Requirements

### 1. CLI Commands

#### `secundo pack <projectDir>`
Creates a `.sec` executable from a directory.

**Requirements**
- Auto-detects interpreter, entrypoint, and appId.
- Populates manifest.json and signs manifest + payload hash.
- Produces `projectDir.sec` unless `-o` is given.

**Options**
--id <appId>
--entry <file>
--interpreter <cmd>
--args <args...>
--no-detect
--spec <path>
--dry-run
--json
-o <file>

#### `secundo inspect <file.sec>`
Prints manifest, payload hash, and verification status.

#### `secundo verify <file.sec>`
Exit codes:
0 valid
1 invalid signature
2 corrupted file

#### `secundo run <file.sec> [args]`
Runs without installation.

#### `secundo ls`
Lists installed apps.

#### `secundo uninstall <appId>`
Removes installed versions.

## 2. Data Layout

### Executable Layout
[POSIX sh stub]
__SECUNDO_PAYLOAD__
BASE64(GZIP(TAR(projectFiles)))

### Installed Layout
~/.secundo/lib/<appId>/<hash>/

## 3. Manifest Format
{
  "appId": "string",
  "version": "string",
  "entry": "string",
  "interpreter": "string",
  "interpreterArgs": [...],
  "hash": "sha256",
  "publicKey": "base64",
  "signature": "base64",
  "metadata": {}
}

## 4. Security
Ed25519 signing of manifest+payload hashes. Stub verifies before extraction.

## 5. Autodetection
Interpreter and entrypoint determined by heuristics and optional spec file.

## 6. Non-Functional Requirements
Portable POSIX sh stub. Fast extraction. Deterministic behavior.

# Appendices

## A. JSON Schema for secundo.spec

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Secundo Spec",
  "type": "object",
  "additionalProperties": true,
  "properties": {
    "appId": {
      "type": "string",
      "pattern": "^[a-z0-9][a-z0-9.\\-]*[a-z0-9]$"
    },
    "entry": { "type": "string" },
    "interpreter": { "type": "string" },
    "interpreterArgs": {
      "type": "array",
      "items": { "type": "string" }
    },
    "name": { "type": "string" },
    "version": {
      "type": "string",
      "pattern": "^[0-9]+(\\.[0-9]+)*$"
    },
    "description": { "type": "string" },
    "metadata": {
      "type": "object",
      "additionalProperties": true
    }
  }
}
```

# TypeScript Reference Implementation Outline

## Project Structure
```
/src
  cli/
    pack.ts
    inspect.ts
    verify.ts
    run.ts
    ls.ts
    uninstall.ts
  core/
    detect.ts
    manifest.ts
    signer.ts
    payload.ts
    embed.ts
    stub.ts
  util/
    fs.ts
    exec.ts
    hash.ts
    types.ts
  index.ts
/bin
  secundo  (Node wrapper)
```

## Core Modules
detect.ts
signer.ts
payload.ts
embed.ts
stub.ts

Core Modules

1. core/detect.ts

Responsibilities:
	•	Detect interpreter
	•	Detect entrypoint
	•	Load and merge secundo.spec
	•	Infer appId and version

API:
- manifest.ts
```ts
export interface DetectionResult {
  appId: string
  entry: string
  interpreter: string
  interpreterArgs: string[]
  version: string
  metadata: Record<string, any>
}

export function detect(projectDir: string): Promise<DetectionResult>
```


## CLI Commands
pack.ts
inspect.ts
verify.ts
run.ts
ls.ts
uninstall.ts


---

CLI Layer

Each command is a thin wrapper around core functions.

pack.ts
	•	runs detection
	•	builds manifest
	•	signs
	•	generates payload
	•	writes .sec file

inspect.ts
	•	scans stub for placeholders
	•	parses manifest inside payload tar
	•	verifies signature

verify.ts
	•	same as inspect but silent, exit codes only

run.ts
	•	extracts to temp dir
	•	spawns interpreter

ls.ts
	•	lists subdirs under ~/.secundo/lib

uninstall.ts
	•	deletes ~/.secundo/lib/<appId>


