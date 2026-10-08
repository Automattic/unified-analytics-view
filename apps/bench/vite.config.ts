import { defineConfig } from 'vite';

export default defineConfig({ build: { rollupOptions: { input: ['index.html', 'demo.html', 'sidebar.html', 'tokens.html', 'materials.html', 'spike.html'] } } });
