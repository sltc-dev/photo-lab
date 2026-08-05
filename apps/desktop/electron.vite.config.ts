import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, externalizeDepsPlugin, loadEnv } from 'electron-vite';
import type { Plugin } from 'vite';

const currentDir = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(currentDir, '../..');
const DEFAULT_API_BASE_URL = 'http://localhost:3000';
const CSP_PLACEHOLDER = '__PHOTO_LAB_CONTENT_SECURITY_POLICY__';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repositoryRoot);
  const apiOrigin = getHttpOrigin(env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL);
  const contentSecurityPolicy = createContentSecurityPolicy(mode === 'development', apiOrigin);

  return {
    main: {
      build: {
        rollupOptions: {
          input: resolve(currentDir, 'electron/main.ts'),
        },
      },
      envDir: repositoryRoot,
      plugins: [externalizeDepsPlugin()],
    },
    preload: {
      build: {
        rollupOptions: {
          input: resolve(currentDir, 'electron/preload.ts'),
          output: {
            entryFileNames: '[name].cjs',
            format: 'cjs',
          },
        },
      },
      plugins: [externalizeDepsPlugin()],
    },
    renderer: {
      build: {
        rollupOptions: {
          input: resolve(currentDir, 'index.html'),
        },
      },
      envDir: repositoryRoot,
      plugins: [react(), contentSecurityPolicyPlugin(contentSecurityPolicy)],
      root: '.',
    },
  };
});

function getHttpOrigin(value: string): string {
  const url = new URL(value);

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('VITE_API_BASE_URL must use http or https.');
  }

  return url.origin;
}

function createContentSecurityPolicy(isDevelopment: boolean, apiOrigin: string): string {
  const connectSources = ["'self'", apiOrigin];
  const imageSources = ["'self'", 'data:', 'blob:', apiOrigin];
  const scriptSources = ["'self'"];

  if (isDevelopment) {
    connectSources.push('ws://localhost:*', 'ws://127.0.0.1:*');
    scriptSources.push("'unsafe-inline'", "'unsafe-eval'");
  }

  return [
    "default-src 'self'",
    "base-uri 'none'",
    `connect-src ${connectSources.join(' ')}`,
    "font-src 'self' data:",
    "form-action 'none'",
    "frame-src 'none'",
    `img-src ${imageSources.join(' ')}`,
    "object-src 'none'",
    `script-src ${scriptSources.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
  ].join('; ');
}

function contentSecurityPolicyPlugin(content: string): Plugin {
  return {
    name: 'photo-lab-content-security-policy',
    transformIndexHtml(html) {
      return html.replace(CSP_PLACEHOLDER, content);
    },
  };
}
