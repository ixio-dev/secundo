# Secundo

> Single-file executable packer for script-based applications

**Secundo** packages your script-based applications (Node.js, TypeScript, Python, Ruby, Shell) into single, self-contained executable files. Each `.sec` file includes your application code, dependencies, and cryptographic signature—everything needed to run anywhere.

## Features

- 🎯 **Single-File Distribution** - Pack your entire application into one executable
- 🔐 **Cryptographically Signed** - Ed25519 signatures ensure integrity and authenticity
- 🤖 **Auto-Detection** - Automatically detects interpreter, entry point, and metadata
- 🚀 **Self-Extracting** - POSIX shell stub handles extraction and execution
- 📦 **Multiple Languages** - Supports Node.js, TypeScript, Python, Ruby, and Shell scripts
- ✨ **Zero Dependencies** - Generated executables have no external dependencies
- 🔧 **Configurable** - Override defaults with `secundo.spec` configuration file

## Installation

```bash
npm install -g secundo
```

Or build from source:

```bash
git clone <repo-url>
cd secundo/secundo
npm install
npm run build
npm link
```

## Quick Start

### Pack Your First Application

```bash
# Pack a Node.js project
cd my-app
secundo pack

# Creates my-app.sec executable
./my-app.sec
```

### Inspect a .sec File

```bash
secundo inspect my-app.sec
```

Output:
```
Application: my-app
App ID: com.example.my-app
Version: 1.0.0
Entry: index.js
Interpreter: node
Payload Hash: abc123...
Signature: ✓ Valid
```

### Verify Signature

```bash
secundo verify my-app.sec
echo $?  # 0 = valid, 1 = invalid signature, 2 = corrupted
```

## Commands

### `secundo pack [directory]`

Package an application into a `.sec` executable.

```bash
# Pack current directory
secundo pack

# Pack specific directory
secundo pack ./my-app

# Specify output file
secundo pack -o custom-name.sec

# See all options
secundo pack --help
```

**Auto-detection:**
- Detects interpreter (node, ts-node, python3, ruby, sh)
- Finds entry point (main, index, bin, etc.)
- Extracts version and metadata from package.json, pyproject.toml, etc.
- Generates app ID from project name or git remote

### `secundo inspect <file.sec>`

Display metadata and signature status of a `.sec` file.

```bash
secundo inspect my-app.sec
```

### `secundo verify <file.sec>`

Verify cryptographic signature and integrity.

```bash
secundo verify my-app.sec
```

Exit codes:
- `0` - Valid signature and integrity
- `1` - Invalid signature
- `2` - Corrupted file

### `secundo run <file.sec> [args...]`

Execute a `.sec` file in a temporary directory (doesn't install).

```bash
secundo run my-app.sec --arg1 --arg2
```

### `secundo ls`

List all installed applications.

```bash
secundo ls
```

Output:
```
Installed Applications:
┌─────────────────────┬─────────┬──────────┐
│ App ID              │ Version │ Hash     │
├─────────────────────┼─────────┼──────────┤
│ com.example.my-app  │ 1.0.0   │ abc123…  │
│ com.example.cli     │ 2.5.1   │ def456…  │
└─────────────────────┴─────────┴──────────┘
```

### `secundo uninstall <appId>`

Remove an installed application.

```bash
secundo uninstall com.example.my-app
```

### `secundo schema`

Output JSON schema for `secundo.spec` configuration file.

```bash
secundo schema > secundo-schema.json
```

### `secundo completion <shell>`

Generate shell completion script.

```bash
# Zsh
secundo completion zsh > /usr/local/share/zsh/site-functions/_secundo

# Bash
secundo completion bash > /etc/bash_completion.d/secundo

# Temporary use
source <(secundo completion zsh)
```

## Configuration

Create a `secundo.spec` file in your project root to override auto-detection:

```yaml
# Required
appId: com.example.myapp
version: 1.0.0
entry: src/cli.js
interpreter: node

# Optional
name: My Application
description: A description of my app
interpreterArgs:
  - --experimental-modules
  - --no-warnings

# Additional metadata
metadata:
  author: John Doe
  license: MIT
  homepage: https://example.com
```

### Supported Fields

| Field | Description | Example |
|-------|-------------|---------|
| `appId` | Unique identifier (reverse DNS) | `com.example.myapp` |
| `version` | Semantic version | `1.0.0` |
| `entry` | Entry point file | `src/index.js` |
| `interpreter` | Runtime to use | `node`, `python3`, `ruby` |
| `interpreterArgs` | Arguments for interpreter | `["--experimental-modules"]` |
| `name` | Display name | `My Application` |
| `description` | Short description | `A CLI tool` |
| `metadata` | Additional key-value pairs | `{author: "..."}` |

## How It Works

1. **Pack Time**
   - Scans project for files (excludes node_modules, .git, etc.)
   - Creates tarball with application code
   - Generates manifest with metadata
   - Signs with Ed25519 private key
   - Embeds into POSIX shell stub template

2. **Run Time**
   - Shell stub extracts base64 payload
   - Decompresses gzip archive
   - Extracts to `~/.secundo/lib/<appId>/<hash>`
   - Verifies signature (optional)
   - Executes with specified interpreter

## Security

### Signing Keys

Secundo uses Ed25519 cryptographic signatures. Keys are automatically generated on first use:

```
~/.secundo/dev/sign/
├── private.key  # Keep this secret!
└── public.key   # Embedded in .sec files
```

**⚠️ Important:** Back up your private key! Without it, you cannot sign updates or prove authenticity.

### Verification

Each `.sec` file contains:
- **Payload hash** - SHA-256 of compressed archive
- **Manifest hash** - SHA-256 of metadata
- **Signature** - Ed25519 signature of combined hashes
- **Public key** - For verification

The shell stub can verify signatures at runtime (currently disabled by default).

## Supported Languages

| Language | Interpreter | Entry Detection |
|----------|-------------|-----------------|
| Node.js | `node` | `main` in package.json, index.js |
| TypeScript | `ts-node` | index.ts, main.ts |
| Python | `python3` | main.py, app.py, \_\_main\_\_.py |
| Ruby | `ruby` | main.rb |
| Shell | `sh` | Executable *.sh files |

## Examples

### Node.js CLI Tool

```bash
cd my-cli-tool
secundo pack
./my-cli-tool.sec --help
```

### Python Application with Custom Config

**secundo.spec:**
```yaml
appId: com.mycompany.analyzer
version: 2.0.0
entry: src/main.py
interpreter: python3
interpreterArgs:
  - -u  # Unbuffered output
name: Data Analyzer
description: Analyzes data files
```

```bash
secundo pack
./analyzer.sec data.csv
```

### TypeScript Project

Secundo automatically detects TypeScript projects and uses `ts-node`:

```bash
cd typescript-app
secundo pack
./typescript-app.sec
```

## Development

### Build

```bash
npm run build       # Production build
npm run dev         # Watch mode
npm run typecheck   # Type checking
```

### Testing

```bash
npm test                # Unit tests
npm run test:all        # All tests including integration
npm run test:watch      # Watch mode
```

**Test Coverage:** 126 tests across all core functionality

### Project Structure

```
secundo/
├── src/
│   ├── cli/          # Command implementations
│   ├── core/         # Core packing logic
│   ├── util/         # Utility functions
│   └── stub/         # POSIX shell stub template
├── dist/             # Compiled output
└── tests/            # Test files
```

## Troubleshooting

### "Could not detect interpreter"

Specify the interpreter in `secundo.spec`:

```yaml
interpreter: node
entry: index.js
```

### "No entrypoint detected"

Create a `secundo.spec` and specify the entry point:

```yaml
entry: src/main.js
```

### Permission Denied

Make sure the `.sec` file is executable:

```bash
chmod +x my-app.sec
```

### Signature Verification Fails

The application may have been modified or corrupted. Use `secundo verify` to check:

```bash
secundo verify my-app.sec
```

## Limitations

- **POSIX Systems Only** - Requires bash/sh (Linux, macOS, WSL)
- **No Interpreter Bundling** - Target system must have required interpreter
- **No Encryption** - Payloads are compressed but not encrypted
- **Large Binaries** - Including node_modules can create large files

## Roadmap

- [ ] Windows support (PowerShell stub)
- [ ] Payload encryption
- [ ] Interpreter bundling
- [ ] Multi-architecture support
- [ ] Auto-update mechanism
- [ ] Package registry/hosting

## Contributing

Contributions welcome! Please read the development guidelines in `TODO.md`.

### Development Rules

- Keep functions under ~30 lines
- Keep files under ~200 lines
- Write tests for all new features
- Run `npm run typecheck && npm test` before committing

## License

MIT License - See LICENSE file for details

## Author

Stefan

## Acknowledgments

- Built with [esbuild](https://esbuild.github.io/)
- Uses [@noble/ed25519](https://github.com/paulmillr/noble-ed25519) for signatures
- Tested with [vitest](https://vitest.dev/)
