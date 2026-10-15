import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/* The pages, in the nav's order: what the nav links and what the build takes in. */
const PAGES = { 'playground.html': 'Playground', 'index.html': 'Views', 'marks.html': 'Marks', 'tokens.html': 'Tokens' };

/** A fieldset of radios, the first checked. */
const radios = (legend: string, name: string, choices: [string, string][]) => `<fieldset><legend>${legend}</legend>`
  + choices.map(([value, label], i) => `<label><input type="radio" name="${name}" value="${value}"${i ? '' : ' checked'}> ${label}</label>`).join('') + '</fieldset>';

/* What the pages' HTML shares is written into it here: the theme in the head, and each `<!-- bench:name -->` in the body. */
const shared: Plugin = {
  name: 'bench-shared',
  transformIndexHtml(html, { filename }) {
    const parts: Record<string, string> = {
      nav: '<nav>' + Object.entries(PAGES).map(([file, name]) =>
        `<a href="${file === 'index.html' ? './' : file}"${file === basename(filename) ? ' aria-current="page"' : ''}>${name}</a>`).join(' ') + '</nav>',
      // The fixture engine's data states, and the box a frame is handed.
      data: radios('Data', 'scenario', [['typical', 'typical'], ['no-prior', 'no prior'], ['empty', 'empty']]),
      height: radios('Height', 'height', [['', 'natural'], ['160', '160'], ['100', '100'], ['60', '60'], ['40', '40']]),
    };
    return {
      html: html.replace(/<!-- bench:(\w+) -->/g, (_, name: string) => {
        if (!(name in parts)) throw new Error(`${filename} asks for <!-- bench:${name} -->: write one of ${Object.keys(parts).join(', ')}, or add it in vite.config.ts.`);
        return parts[name]!;
      }),
      // The kept theme, set in the head as a classic script so it holds before the page paints.
      tags: [{ tag: 'script', children: readFileSync(new URL('./src/theme-boot.js', import.meta.url), 'utf8'), injectTo: 'head' }],
    };
  },
};

// The port is 5173 unless the launcher hands one over: a second session's bench takes the next free one.
export default defineConfig({ base: './', plugins: [shared], server: { port: Number(process.env.PORT) || 5173 }, build: { rollupOptions: { input: Object.keys(PAGES) } } });
