```
function autodetect(projectDir):
    spec = loadSpecIfExists(projectDir)
    meta = scanProject(projectDir)

    result = {}

    result.appId = resolveAppId(spec, meta, projectDir)
    result.interpreter = resolveInterpreter(spec, meta)
    result.entry = resolveEntrypoint(spec, meta)
    result.interpreterArgs = resolveInterpreterArgs(spec, meta)
    result.name = resolveName(spec, meta, projectDir)
    result.version = resolveVersion(spec, meta)

    return result
```
