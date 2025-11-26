```
function resolveInterpreterArgs(spec, meta):
    if spec.interpreterArgs exists:
        return spec.interpreterArgs

    if meta.tsconfig exists:
        return ["--transpile-only"]

    return []
```
