#!/usr/bin/env node

import { build } from 'esbuild';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Create dist directories
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist', { recursive: true });
}
if (!fs.existsSync('dist/public')) {
  fs.mkdirSync('dist/public', { recursive: true });
}

// Copy static files
fs.copyFileSync('client/index.html', 'dist/public/index.html');

// Build frontend with esbuild (avoiding Vite timeout issues)
console.log('Building frontend...');
await build({
  entryPoints: ['client/src/main.tsx'],
  bundle: true,
  outfile: 'dist/public/main.js',
  format: 'iife',
  jsx: 'automatic',
  define: {
    'import.meta.env.NODE_ENV': '"production"',
    'import.meta.env.VITE_CLERK_PUBLISHABLE_KEY': `"${process.env.VITE_CLERK_PUBLISHABLE_KEY || ''}"`,
    'global': 'globalThis',
  },
  loader: {
    '.css': 'css',
    '.png': 'file',
    '.jpg': 'file',
    '.jpeg': 'file',
    '.svg': 'file',
  },
  minify: true,
  target: 'es2020',
  external: [],
});

// Build CSS separately
console.log('Building CSS...');
await build({
  entryPoints: ['client/src/index.css'],
  bundle: true,
  outfile: 'dist/public/style.css',
  loader: {
    '.css': 'css',
  },
  minify: true,
});

// Build backend
console.log('Building backend...');
await build({
  entryPoints: ['server/index.ts'],
  bundle: true,
  outfile: 'dist/index.js',
  format: 'esm',
  platform: 'node',
  packages: 'external',
  target: 'node18',
});

console.log('Production build completed successfully!');