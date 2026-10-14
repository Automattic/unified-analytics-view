import { defineConfig } from 'vite';

// The port is 5173 unless the launcher hands one over: a second session's bench takes the next free one.
export default defineConfig({ base: './', server: { port: Number(process.env.PORT) || 5173 }, build: { rollupOptions: { input: ['index.html', 'demo.html', 'marks.html', 'sidebar.html', 'goals.html', 'live.html', 'tokens.html', 'spike.html'] } } });
