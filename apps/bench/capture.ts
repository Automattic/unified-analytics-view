/* The capture: every sample on the parts page, in each theme and height asked for, at every width the page has, with
 * nothing moving. For each frame a picture, a picture of each part that shows in it, and what the page measured
 * (src/parts.ts, `measure`). Everything goes in captures/<time>/, so whoever evaluates reads the same files:
 *
 *   frames/<sample>/<theme>-<height>-<width>.png    the frame
 *   parts/<part>/<sample>-<theme>-<height>-<width>.png    one part of it, cropped
 *   capture.json    how it was taken, and a record for each frame
 *
 *   pnpm capture [samples=a,b] [themes=light,dark] [heights=natural,100] [scenario=typical] [spec=<file>]
 *
 * `spec=<file>` takes a view that is no sample: a JSON file that is a spec, drawn on the fixtures' engine and catalog,
 * or { "spec", "result", "catalog", "name" } for one drawn on an answer and a catalog of its own. The path is from
 * where the command was run. The capture is then of that view alone, and `check` holds it as it holds any.
 */
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve as path } from 'node:path';
import { chromium, type Page } from 'playwright';
import { createServer } from 'vite';
import type { FrameMeasure } from './src/parts.ts';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=') as [string, string]));
const list = (key: string, fallback: string) => (args[key] ?? fallback).split(',').filter(Boolean);
const themes = list('themes', 'light,dark'), heights = list('heights', 'natural,100'), scenario = args.scenario ?? 'typical';
const VIEWPORT = { width: 1280, height: 800 }, PAGES = 4;
/** A view of one's own, from `spec=<file>`: the file is a spec, or holds one beside its answer and catalog. */
const given = args.spec ? ((file) => { const g = file.spec?.query ? file : { spec: file }; return { name: 'given', ...g } as { name: string; spec: unknown }; })(JSON.parse(readFileSync(path(process.env.INIT_CWD ?? process.cwd(), args.spec), 'utf8'))) : null;

const out = new URL(`./captures/${new Date().toISOString().replace(/[:.]/g, '-')}/`, import.meta.url).pathname;
const server = await createServer({ configFile: new URL('./vite.config.ts', import.meta.url).pathname, server: { port: 5199 }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls!.local[0]!;
// Reduced motion: the element then draws each state at once, so what is taken is where it ends, not a step on the way.
const browser = await chromium.launch(), context = await browser.newContext({ viewport: VIEWPORT, reducedMotion: 'reduce', deviceScaleFactor: 2 });
// The page takes a view handed to it before its own script runs (src/parts.ts, `benchGiven`).
if (given) await context.addInitScript((g) => { (window as unknown as { benchGiven: unknown }).benchGiven = g; }, given);

/** What the view plans, and what a fit rule may ask of its scene: `has` is core's hasOf, and `drawn` the parts the scene has anything for. A capture taken before the two were kept has neither. */
export interface Plan { layout: string; parts: string[]; marks: string[]; has?: string[]; drawn?: string[] }
export interface Record { sample: string; plan?: Plan; theme: string; height: string; width: string; error?: string; measure: FrameMeasure; frame: string; parts: { [part: string]: string } }
const records: Record[] = [];

/** Every frame's measure, read until two readings 150 ms apart agree: the view has painted and the measured pass is done. */
async function settled(page: Page): Promise<FrameMeasure[]> {
  await page.evaluate(() => document.fonts.ready.then(() => true));
  let last = '';
  for (let i = 0; i < 20; i++) {
    const now = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.frame')].map((f) => (window as unknown as { benchMeasure(f: HTMLElement): unknown }).benchMeasure(f)));
    const json = JSON.stringify(now);
    if (json === last) return now as FrameMeasure[];
    last = json;
    await page.waitForTimeout(150);
  }
  throw new Error('the frames never settled: a view is still changing after 3 s. Look at it on the parts page.');
}

async function take(page: Page, sample: string, theme: string, height: string): Promise<void> {
  const query = new URLSearchParams({ sample, part: '', scenario, height: height === 'natural' ? '' : height, theme });
  await page.goto(`${base}parts.html?${query}&embed`);
  const measures = await settled(page), frames = page.locator('.frame');
  const plan = await page.evaluate(() => (window as unknown as { benchPlan?: Plan }).benchPlan);
  for (const [i, measure] of measures.entries()) {
    const frame = frames.nth(i), width = (await frame.getAttribute('data-width'))!, name = `${theme}-${height}-${width}`;
    const error = await frame.locator('xpath=following-sibling::p[contains(@class,"error")]').textContent({ timeout: 50 }).catch(() => undefined);
    const record: Record = { sample, plan, theme, height, width, ...(error && { error }), measure, frame: `frames/${sample}/${name}.png`, parts: {} };
    mkdirSync(out + `frames/${sample}`, { recursive: true });
    await frame.screenshot({ path: out + record.frame, animations: 'disabled' });
    const at = (await frame.boundingBox())!;
    for (const [part, { box: [x, y, w, h] }] of Object.entries(measure.parts)) {
      if (w < 1 || h < 1) continue;
      mkdirSync(out + `parts/${part}`, { recursive: true });
      record.parts[part] = `parts/${part}/${sample}-${name}.png`;
      // A little room round the part, so its edge and what it meets show.
      await page.screenshot({ path: out + record.parts[part], fullPage: true, animations: 'disabled', clip: { x: at.x + x - 4, y: at.y + y - 4, width: w + 8, height: h + 8 } });
    }
    records.push(record);
  }
}

try {
  // The samples, from the page's own list of them.
  const first = await context.newPage();
  await first.goto(`${base}parts.html?embed`);
  const all = await first.$$eval('[name="sample"] option', (os) => os.map((o) => (o as HTMLOptionElement).value));
  const samples = given ? [given.name] : args.samples ? list('samples', '') : all;
  const unknown = samples.filter((s) => !all.includes(s));
  if (unknown.length) throw new Error(`no sample called ${unknown.join(', ')}: pick from ${all.join(', ')}.`);
  const jobs = samples.flatMap((s) => themes.flatMap((t) => heights.map((h) => [s, t, h] as const)));
  const pages = [first, ...await Promise.all(Array.from({ length: PAGES - 1 }, () => context.newPage()))];
  let done = 0; const total = jobs.length;
  await Promise.all(pages.map(async (page) => {
    for (let job = jobs.shift(); job; job = jobs.shift()) {
      await take(page, ...job);
      process.stdout.write(`\r${++done} of ${total} pages`);
    }
  }));
  records.sort((a, b) => (a.sample + a.theme + a.height).localeCompare(b.sample + b.theme + b.height));
  const commit = execSync('git rev-parse --short HEAD').toString().trim() + (execSync('git status --porcelain').toString() ? ' (with changes)' : '');
  writeFileSync(out + 'capture.json', JSON.stringify({ taken: new Date().toISOString(), commit, scenario, themes, heights, viewport: VIEWPORT, records }, null, 1));
  console.log(`\n${records.length} frames in ${out}`);
} finally {
  await browser.close();
  await server.close();
}
