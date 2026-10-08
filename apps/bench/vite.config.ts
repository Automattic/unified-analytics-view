import { defineConfig } from 'vite';

// The port is 5173 unless whoever starts the server hands it another, as a preview does when 5173 is taken.
export default defineConfig({ server: { port: Number(process.env.PORT) || 5173 }, build: { rollupOptions: { input: ['index.html', 'demo.html', 'marks.html', 'sidebar.html', 'goals.html', 'tokens.html', 'spike.html'] } } });
