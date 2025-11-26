import schemaContent from '../schema/secundo-spec.json'

export async function schema(_args: string[]): Promise<void> {
  console.log(schemaContent)
}
