import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { cacheControlFor } from '../../server/vite';

/**
 * What the browser is allowed to keep.
 *
 * These headers decide whether a returning visitor downloads six megabytes again and whether a
 * release is actually picked up. Both mistakes are silent: an over-cached shell keeps pointing at
 * files that no longer exist, and an under-cached asset bundle is paid for on every visit.
 */
const at = (...parts: string[]) => path.join('/var/www/kaptia/dist/public', ...parts);

describe('cache headers for build output', () => {
  it('lets a hashed bundle be kept for a year', () => {
    expect(cacheControlFor(at('assets', 'vendor-Bya3TZp7.js'))).toBe(
      'public, max-age=31536000, immutable',
    );
    expect(cacheControlFor(at('assets', 'index-Bbn3SogH.css'))).toBe(
      'public, max-age=31536000, immutable',
    );
  });

  it('never caches the shell, which names those hashes', () => {
    expect(cacheControlFor(at('index.html'))).toBe('no-cache');
  });

  it('revalidates the service worker, or an update never arrives', () => {
    expect(cacheControlFor(at('sw.js'))).toBe('no-cache');
  });

  it('revalidates translation files, which belong to the running release', () => {
    expect(cacheControlFor(at('locales', 'en-us', 'translation.json'))).toBe('no-cache, must-revalidate');
  });

  it('says nothing about a file it does not know', () => {
    // A favicon or an image without a hash: let the server's defaults decide.
    expect(cacheControlFor(at('favicon.png'))).toBeNull();
  });

  it('does not treat a directory that merely mentions assets as build output', () => {
    // The rule is about the `assets/` directory, not about any path containing the word.
    expect(cacheControlFor(at('my-assets', 'photo.png'))).toBeNull();
  });
});
