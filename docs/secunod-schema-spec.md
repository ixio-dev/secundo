```yaml
# secundo.spec

# REQUIRED? → No
# Only override what needs to be overridden.

# Unique application identifier
appId: com.example.myapp

# Entrypoint file relative to project root
entry: src/main.ts

# Interpreter command to run the app
interpreter: ts-node

# Optional interpreter arguments
interpreterArgs:
  - --transpile-only

# Human-readable name (optional)
name: My Application

# Version string (optional)
version: 1.0.0

# Long description (optional)
description: |
  Single-file command-line tool that demonstrates X.

# Optional metadata for later extensions
metadata:
  author: Stefan
  license: MIT
  homepage: https://example.com
```

### Validation rules:
- All fields optional.
- Unrecognized fields stored but ignored by v0.1.
- appId must be lower-case, alphanumeric, dots allowed.
- interpreter must be a single command (no spaces).
- entry must point to an existing file.

