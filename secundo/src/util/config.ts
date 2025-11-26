// Global configuration for CLI flags

interface Config {
  verbose: boolean
  noColor: boolean
}

const config: Config = {
  verbose: false,
  noColor: false
}

export function setVerbose(enabled: boolean): void {
  config.verbose = enabled
}

export function setNoColor(enabled: boolean): void {
  config.noColor = enabled
}

export function isVerbose(): boolean {
  return config.verbose
}

export function isNoColor(): boolean {
  return config.noColor
}

export function getConfig(): Readonly<Config> {
  return config
}
