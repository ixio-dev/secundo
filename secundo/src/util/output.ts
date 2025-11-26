// Colored output utilities with --no-color support

let colorEnabled = true

export function enableColor(enabled: boolean): void {
  colorEnabled = enabled
}

export function isColorEnabled(): boolean {
  return colorEnabled
}

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',

  // Foreground colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',

  // Background colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m'
}

function colorize(text: string, colorCode: string): string {
  if (!colorEnabled) return text
  return `${colorCode}${text}${colors.reset}`
}

export function red(text: string): string {
  return colorize(text, colors.red)
}

export function green(text: string): string {
  return colorize(text, colors.green)
}

export function yellow(text: string): string {
  return colorize(text, colors.yellow)
}

export function blue(text: string): string {
  return colorize(text, colors.blue)
}

export function cyan(text: string): string {
  return colorize(text, colors.cyan)
}

export function gray(text: string): string {
  return colorize(text, colors.gray)
}

export function bold(text: string): string {
  return colorize(text, colors.bold)
}

export function dim(text: string): string {
  return colorize(text, colors.dim)
}

export function success(message: string): void {
  console.log(green('✓') + ' ' + message)
}

export function error(message: string): void {
  console.error(red('✗') + ' ' + message)
}

export function warning(message: string): void {
  console.warn(yellow('⚠') + ' ' + message)
}

export function info(message: string): void {
  console.log(blue('ℹ') + ' ' + message)
}

export function verbose(message: string, enabled: boolean): void {
  if (enabled) {
    console.log(gray('→') + ' ' + dim(message))
  }
}

// Progress indicator for long operations
export class ProgressIndicator {
  private message: string
  private spinner: string[] = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  private index: number = 0
  private interval: NodeJS.Timeout | null = null

  constructor(message: string) {
    this.message = message
  }

  start(): void {
    if (!colorEnabled) {
      console.log(this.message + '...')
      return
    }

    process.stdout.write(cyan(this.spinner[0]) + ' ' + this.message)

    this.interval = setInterval(() => {
      this.index = (this.index + 1) % this.spinner.length
      process.stdout.write('\r' + cyan(this.spinner[this.index]) + ' ' + this.message)
    }, 80)
  }

  succeed(message?: string): void {
    this.stop()
    if (colorEnabled) {
      process.stdout.write('\r' + green('✓') + ' ' + (message || this.message) + '\n')
    } else {
      console.log((message || this.message) + ' - done')
    }
  }

  fail(message?: string): void {
    this.stop()
    if (colorEnabled) {
      process.stdout.write('\r' + red('✗') + ' ' + (message || this.message) + '\n')
    } else {
      console.error((message || this.message) + ' - failed')
    }
  }

  update(message: string): void {
    this.message = message
    if (colorEnabled && this.interval) {
      process.stdout.write('\r' + cyan(this.spinner[this.index]) + ' ' + this.message)
    }
  }

  private stop(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }
}

export function progress(message: string): ProgressIndicator {
  return new ProgressIndicator(message)
}
