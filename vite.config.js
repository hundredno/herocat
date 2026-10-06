import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

// Version label: "v." + first 4 chars of the deployed commit.
// Cloudflare Workers Builds exposes WORKERS_CI_COMMIT_SHA; locally we ask git.
function commitSha() {
  const fromEnv = process.env.WORKERS_CI_COMMIT_SHA || process.env.GITHUB_SHA;
  if (fromEnv) return fromEnv;
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'dev';
  }
}

// The game chunk is imported dynamically by the tiny entry script so the title screen is
// interactive at once. Preloading it from the HTML lets it download in parallel instead of
// waiting for the entry script to run (saves a round trip on mobile).
function preloadGameChunk() {
  return {
    name: 'preload-game-chunk',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, { bundle }) {
        const chunk = Object.values(bundle ?? {}).find((c) => c.type === 'chunk' && c.isDynamicEntry && c.name === 'game');
        if (!chunk) return html;
        const css = [...(chunk.viteMetadata?.importedCss ?? [])];
        return [
          { tag: 'link', attrs: { rel: 'modulepreload', crossorigin: true, href: `/${chunk.fileName}` }, injectTo: 'head' },
          ...css.map((href) => ({ tag: 'link', attrs: { rel: 'preload', as: 'style', crossorigin: true, href: `/${href}` }, injectTo: 'head' })),
        ];
      },
    },
  };
}

export default defineConfig({
  plugins: [preloadGameChunk()],
  define: {
    __APP_VERSION__: JSON.stringify(`v.${commitSha().slice(0, 4)}`),
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 4096,
    // three.js alone is ~600 kB raw (~160 kB gzipped); the size budget is enforced by npm run size.
    chunkSizeWarningLimit: 800,
  },
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
  },
});
