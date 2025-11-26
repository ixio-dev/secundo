```
function resolveName(spec, meta, projectDir):
    if spec.name exists:
        return spec.name

    if meta.packageJson.name exists:
        return meta.packageJson.name

    if meta.pyproject.project.name exists:
        return meta.pyproject.project.name

    return basename(projectDir)
```

```
function resolveVersion(spec, meta):
    if spec.version exists:
        return spec.version

    if meta.packageJson.version exists:
        return meta.packageJson.version

    if meta.pyproject.project.version exists:
        return meta.pyproject.project.version

    return "0.0.0"
```
