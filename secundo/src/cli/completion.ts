export async function completion(args: string[]): Promise<void> {
  const shell = args[0]

  if (!shell || (shell !== 'zsh' && shell !== 'bash')) {
    console.error('Usage: secundo completion <shell>')
    console.error('Supported shells: zsh, bash')
    process.exit(1)
  }

  if (shell === 'zsh') {
    generateZshCompletion()
  } else if (shell === 'bash') {
    generateBashCompletion()
  }
}

function generateZshCompletion(): void {
  const script = `#compdef secundo

_secundo() {
  local -a commands
  commands=(
    'pack:Create a .sec executable from a project directory'
    'inspect:Show manifest and verify signature'
    'verify:Verify signature (exit codes only)'
    'run:Run a .sec file without installing'
    'ls:List installed applications'
    'uninstall:Remove an installed application'
    'completion:Generate shell completion script'
  )

  local -a pack_options
  pack_options=(
    '--id[Override autodetected appId]:appId:'
    '--entry[Override autodetected entrypoint]:file:_files'
    '--interpreter[Override autodetected interpreter]:command:'
    '--args[Interpreter arguments]:args:'
    '(-o --output)'{-o,--output}'[Output file name]:file:_files'
    '--no-detect[Disable autodetection]'
    '--spec[Use custom spec file]:file:_files'
    '--dry-run[Show detected config without packing]'
    '--json[Output detection result as JSON]'
    '(-h --help)'{-h,--help}'[Show help]'
  )

  _arguments -C \\
    '1: :->command' \\
    '*::arg:->args'

  case $state in
    command)
      _describe 'command' commands
      ;;
    args)
      case $words[1] in
        pack)
          _arguments \\
            '1:project directory:_directories' \\
            $pack_options
          ;;
        inspect|verify|run)
          _arguments '1:.sec file:_files -g "*.sec"'
          ;;
        uninstall)
          _arguments '1:appId:'
          ;;
        completion)
          _arguments '1:shell:(zsh bash)'
          ;;
      esac
      ;;
  esac
}

_secundo "$@"
`

  console.log(script)
}

function generateBashCompletion(): void {
  const script = `_secundo_completion() {
  local cur prev commands
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  commands="pack inspect verify run ls uninstall completion"

  case "\${COMP_CWORD}" in
    1)
      COMPREPLY=( $(compgen -W "\${commands}" -- \${cur}) )
      return 0
      ;;
    *)
      case "\${COMP_WORDS[1]}" in
        pack)
          case "\${prev}" in
            --id|--entry|--interpreter|--args|-o|--output|--spec)
              return 0
              ;;
            pack)
              COMPREPLY=( $(compgen -d -- \${cur}) )
              return 0
              ;;
            *)
              local pack_opts="--id --entry --interpreter --args -o --output --no-detect --spec --dry-run --json -h --help"
              COMPREPLY=( $(compgen -W "\${pack_opts}" -- \${cur}) )
              return 0
              ;;
          esac
          ;;
        inspect|verify|run)
          if [[ \${COMP_CWORD} -eq 2 ]]; then
            COMPREPLY=( $(compgen -f -X '!*.sec' -- \${cur}) )
          fi
          return 0
          ;;
        completion)
          if [[ \${COMP_CWORD} -eq 2 ]]; then
            COMPREPLY=( $(compgen -W "zsh bash" -- \${cur}) )
          fi
          return 0
          ;;
      esac
      ;;
  esac
}

complete -F _secundo_completion secundo
`

  console.log(script)
}
