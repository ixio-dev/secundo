```
function resolveAppId(spec, meta, projectDir):
    if spec.appId exists:
        return spec.appId

    # From package.json
    if meta.packageJson.name exists:
        return sanitizeToAppId(meta.packageJson.name)

    # From Python metadata
    if meta.pyproject.project.name exists:
        return sanitizeToAppId(meta.pyproject.project.name)

    # From git remote
    if meta.gitRemote contains "github.com/user/repo":
        return "com.github." + user + "." + repo

    # Fallback: directory name
    base = basename(projectDir)
    return "local." + base
```
