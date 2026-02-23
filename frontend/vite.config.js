import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';

function getGitInfo() {
  try {
    const sha = (process.env.GITHUB_SHA || execSync('git rev-parse HEAD').toString()).trim();
    const short = sha.slice(0, 7);
    const rawRemote = execSync('git remote get-url origin').toString().trim();
    const repoUrl = rawRemote
      .replace(/\.git$/, '')
      .replace(/^git@github\.com:/, 'https://github.com/');
    return { short, commitUrl: `${repoUrl}/commit/${sha}` };
  } catch {
    return { short: 'dev', commitUrl: 'https://github.com/ppapadeas/openadeia' };
  }
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
