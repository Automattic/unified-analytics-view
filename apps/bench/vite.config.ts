import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

/* What every page's HTML shares is written into it here. */
const shared: Plugin = {
  name: 'bench-shared',
  transformIndexHtml: () => [
    // The kept theme, set in the head as a classic script so it holds before the page paints.
    { tag: 'script', children: readFileSync(new URL('./src/theme-boot.js', import.meta.url), 'utf8'), injectTo: 'head' },
  ],
};

// The port is 5173 unless the launcher hands one over: a second session's bench takes the next free one.
export default defineConfig({ base: './', plugins: [shared], server: { port: Number(process.env.PORT) || 5173 }, build: { rollupOptions: { input: ['index.html', 'playground.html', 'marks.html', 'tokens.html'] } } });
