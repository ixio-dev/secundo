```
function scanProject(projectDir):
    meta = {}

    meta.packageJson = loadJSONIfExists(projectDir + "/package.json")
    meta.pyproject = loadTOMLIfExists(projectDir + "/pyproject.toml")
    meta.requirementsTxt = fileExists(projectDir + "/requirements.txt")
    meta.tsconfig = fileExists(projectDir + "/tsconfig.json")
    meta.gitRemote = readGitRemote(projectDir)

    meta.files = listAllFiles(projectDir)

    meta.tsFiles = filter(meta.files, endsWith(".ts"))
    meta.jsFiles = filter(meta.files, endsWith(".js"))
    meta.pyFiles = filter(meta.files, endsWith(".py"))
    meta.rbFiles = filter(meta.files, endsWith(".rb"))
    meta.shFiles = filter(meta.files, endsWith(".sh"))

    meta.executableScripts = findExecutableScripts(meta.files)

    return meta
```
