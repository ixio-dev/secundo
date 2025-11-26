```
function resolveInterpreter(spec, meta):
    if spec.interpreter exists:
        return spec.interpreter

    if meta.tsconfig or ts files exist:
        return "ts-node"

    if meta.packageJson exists:
        return "node"

    if meta.pyproject or meta.requirementsTxt or python files exist:
        return "python3"

    if meta.rbFiles not empty:
        return "ruby"

    if meta.shFiles not empty or executableScripts not empty:
        return "/bin/sh"

    error("Could not detect interpreter. Please specify in secundo.spec")
```
