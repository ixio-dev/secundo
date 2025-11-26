#!/usr/bin/env node

import * as esbuild from 'esbuild'

const isWatch = process.argv.includes('--watch')

const buildOptions = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'dist/secundo.js',
  banner: {
    js: '#!/usr/bin/env node\n'
  },
  external: [],
  minify: !isWatch,
  sourcemap: isWatch,
  logLevel: 'info'
}

if (isWatch) {
  const ctx = await esbuild.context(buildOptions)
  await ctx.watch()
  console.log('Watching for changes...')
} else {
  await esbuild.build(buildOptions)
  console.log('Build complete!')
}
