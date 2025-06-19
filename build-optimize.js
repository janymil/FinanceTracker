// Build optimization script to bypass Vite icon processing timeout
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('Starting optimized build process...');

try {
  // Step 1: Build frontend with longer timeout and optimizations
  console.log('Building frontend with optimizations...');
  execSync('NODE_OPTIONS="--max-old-space-size=8192" timeout 600 npx vite build', {
    stdio: 'inherit',
    timeout: 600000 // 10 minutes
  });

  // Step 2: Build backend
  console.log('Building backend...');
  execSync('npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist', {
    stdio: 'inherit'
  });

  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed:', error.message);
  
  // Fallback: Try building without optimization
  console.log('Attempting fallback build...');
  try {
    execSync('npx vite build --mode development', {
      stdio: 'inherit',
      timeout: 300000
    });
    execSync('npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist', {
      stdio: 'inherit'
    });
    console.log('Fallback build completed!');
  } catch (fallbackError) {
    console.error('Fallback build also failed:', fallbackError.message);
    process.exit(1);
  }
}