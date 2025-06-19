#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🚀 Starting deployment build with icon optimization...');

try {
  // Clean previous builds
  if (fs.existsSync('dist')) {
    console.log('🧹 Cleaning previous build...');
    execSync('rm -rf dist', { stdio: 'inherit' });
  }

  // Build frontend with custom config that excludes lucide-react processing
  console.log('🎨 Building frontend with icon optimization...');
  execSync('NODE_OPTIONS="--max-old-space-size=8192" npx vite build --config vite-build.config.ts --mode production', {
    stdio: 'inherit',
    timeout: 300000 // 5 minutes
  });

  // Build backend
  console.log('⚙️ Building backend...');
  execSync('npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist', {
    stdio: 'inherit'
  });

  console.log('✅ Build completed successfully!');
  console.log('📁 Files ready in dist/ directory');
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  
  // Show specific error details
  if (error.status === 124) {
    console.error('⏰ Build timed out - likely due to processing too many dependencies');
  }
  
  console.log('\n🔧 Attempting fallback build without minification...');
  try {
    execSync('NODE_OPTIONS="--max-old-space-size=8192" npx vite build --config vite-build.config.ts --mode development --minify false', {
      stdio: 'inherit',
      timeout: 180000
    });
    execSync('npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist', {
      stdio: 'inherit'
    });
    console.log('✅ Fallback build completed!');
  } catch (fallbackError) {
    console.error('❌ Fallback build also failed:', fallbackError.message);
    process.exit(1);
  }
}