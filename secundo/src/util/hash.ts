import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

export function sha256(data: string | Buffer): Buffer {
  return createHash('sha256').update(data).digest()
}

export function sha256Hex(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}

export async function sha256File(filePath: string): Promise<Buffer> {
  const content = await readFile(filePath)
  return sha256(content)
}

export async function sha256FileHex(filePath: string): Promise<string> {
  const content = await readFile(filePath)
  return sha256Hex(content)
}
