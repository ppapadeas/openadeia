import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';

function getGitInfo() {
  // Step 1: get SHA — prefer CI env var, then git command
  // These are in separate try/catch so a failing git remote doesn't lose the SHA
  let sha = process.env.GITHUB_SHA || null;
  if (!sha) {
    try { sha = execSync('git rev-parse HEAD').toString().trim(); } catch { /* no .git */ }
  }

  // Step 2: get repo URL — git remote fails inside Docker (no .git directory)
  let repoUrl = 'https://github.com/ppapadeas/openadeia';
  try {
    const raw = execSync('git remote get-url origin').toString().trim();
    repoUrl = raw.replace(/\.git$/, '').replace(/^git@github\.com:/, 'https://github.com/');
  } catch { /* no git or no remote */ }

  if (!sha) return { short: 'dev', commitUrl: repoUrl };
  return { short: sha.slice(0, 7), commitUrl: `${repoUrl}/commit/${sha}` };
}

const git = getGitInfo();

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  define: {
    __GIT_COMMIT__: JSON.stringify(git.short),
    __GIT_COMMIT_URL__: JSON.stringify(git.commitUrl),
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.js'],
  },
});
