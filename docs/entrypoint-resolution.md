```
function resolveEntrypoint(spec, meta):
    if spec.entry exists:
        return spec.entry

    # Node
    if meta.packageJson contains "bin":
        return pathFromPackageBin(meta.packageJson)

    if meta.packageJson contains "main":
        return meta.packageJson.main

    # Python
    for name in ["main.py", "app.py", "cli.py"]:
        if fileExists(projectDir + "/" + name):
            return name

    # TS/JS
    for name in ["main.ts", "main.js", "index.ts", "index.js"]:
        if fileExists(projectDir + "/" + name):
            return name

    # Ruby
    if fileExists(projectDir + "/main.rb"):
        return "main.rb"

    # Shell
    for file in meta.executableScripts:
        if looksLikeEntryScript(file):
            return file.relativeTo(projectDir)

    error("No entrypoint detected. Add entry: to secundo.spec")
```
