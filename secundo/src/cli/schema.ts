import schemaContent from '../schema/secundo-spec.json'

const HELP = `
secundo schema - Output JSON schema for secundo.spec

USAGE:
  secundo schema

DESCRIPTION:
  Outputs the JSON schema that defines the secundo.spec format.
  Useful for IDE integration and validation.

EXAMPLES:
  secundo schema > secundo.schema.json
  secundo schema | jq .
`

export async function schema(args: string[]): Promise<void> {
  if (args[0] === '--help' || args[0] === '-h') {
    console.log(HELP)
    process.exit(0)
  }

  console.log(schemaContent)
}
