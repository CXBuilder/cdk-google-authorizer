#!/usr/bin/env node
const esbuild = require('esbuild');
const path = require('path');

const entry = path.join(__dirname, '..', 'src', 'lambda', 'handler.ts');
const outfile = path.join(__dirname, '..', 'src', 'lambda', 'dist', 'handler.js');

esbuild.buildSync({
  entryPoints: [entry],
  outfile,
  bundle: true,
  minify: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  external: [],
  legalComments: 'none',
});

console.log(`bundled ${path.relative(process.cwd(), outfile)}`);
