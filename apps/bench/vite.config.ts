import { defineConfig } from 'vite';

export default defineConfig({ build: { rollupOptions: { input: ['index.html', 'demo.html', 'marks.html', 'sidebar.html', 'tokens.html', 'spike.html'] } } });
