import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { boardViews, type Board, type Catalog, type Result, type Spec } from '@unified-analytics/core';
import { catalog as fixtureCatalog, runQuery, scenarios, type Scenario } from '@unified-analytics/fixtures';   // registers the custom marks too
import { ROOMS, check, describe, type Checked, type Room } from './index.ts';

/* The agent surface as an MCP server, over stdio: three tools, and no library.
 *
 *   describe     what can be said: the schemas, what each mark reads, the guides, the fit rules, the presets.
 *   check_view   a spec read with no browser: the refusal, or what the view says and shows at each room, and why.
 *   draw_view    a spec drawn in a browser by the bench's capture: pictures at a ladder of widths, and what the check found.
 *
 * A view is drawn on the answer and the catalog it is handed. With neither it is drawn on the fixtures' engine, in the
 * data state asked for, which is how an author tries a spec before there is an engine to ask.
 *
 * ponytail: the protocol is written out here, JSON-RPC 2.0 with a message to a line, for the three methods a server of
 * tools needs. It adds no dependency. If this grows resources or prompts, take the MCP SDK and delete the loop below. */

type Content = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string };
interface Tool { name: string; description: string; inputSchema: object; run(args: Record<string, unknown>): Content[] }
const text = (v: unknown): Content[] => [{ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v, null, 1) }];

/** A view's answer and catalog: the ones handed over, or the fixtures' in the data state asked for. */
function inputs(args: Record<string, unknown>, spec: Spec): { result: Result; catalog: Catalog } {
  if ((args.result == null) !== (args.catalog == null)) throw new Error('Pass "result" and "catalog" together, as the query layer returned them, or neither, to draw on the fixture engine.');
  if (args.result) return { result: args.result as Result, catalog: args.catalog as Catalog };
  const state = (args.state ?? 'typical') as Scenario;
  if (!scenarios.includes(state)) throw new Error('"state" is ' + JSON.stringify(args.state) + ', and the fixture engine has: ' + scenarios.join(', ') + '.');
  return { result: runQuery(spec.query, state), catalog: fixtureCatalog };
}
const specOf = (args: Record<string, unknown>): Spec => {
  if (!args.spec || typeof args.spec !== 'object') throw new Error('Pass "spec": a view/0 spec, for example { "use": "line", "query": { "metrics": ["visitors"], "by": ["date.day"], "range": "28d" } }.');
  return args.spec as Spec;
};

const VIEW = { type: 'object', description: 'A view/0 spec, or a board/0 board of them. The schema is in `describe`.' };
const DATA = {
  result: { type: 'object', description: 'What the spec\'s query returned: { rows, totals, meta }. With `catalog`. Left out, the view is drawn on the fixture engine.' },
  catalog: { type: 'object', description: 'The catalog the query was run against: { metrics, dimensions }. With `result`.' },
  state: { enum: scenarios, description: 'The fixture engine\'s data state, where no result is passed: typical, no-prior (a comparison asked for and none there) or empty.' },
};

/** Where the bench is: the capture and the check are its, and are run as it runs them. */
const BENCH = new URL('../../../apps/bench/', import.meta.url).pathname;

export const TOOLS: Tool[] = [
  { name: 'describe',
    description: 'What a view can say, as data: the JSON Schemas (view, catalog, board, scene), the channels and fields each mark reads in each layout, which encoding each guide is read off, the fit rules by which a view gives way when room is short, and the presets. Read it before writing a spec. `sections` picks some of it.',
    inputSchema: { type: 'object', properties: { sections: { type: 'array', items: { enum: ['schemas', 'reads', 'needs', 'fields', 'customMarks', 'guides', 'fit', 'presets', 'catalog'] } }, catalog: DATA.catalog, fixtures: { type: 'boolean', description: 'Include the fixture catalog: the metrics and dimensions a spec may name when it is drawn on the fixture engine.' } } },
    run: (args) => {
      const all = describe((args.catalog as Catalog | undefined) ?? (args.fixtures ? fixtureCatalog : undefined)) as Record<string, unknown>, only = args.sections as string[] | undefined;
      return text(only ? Object.fromEntries(only.map((s) => [s, all[s]])) : all);
    } },
  { name: 'check_view',
    description: 'Read a spec with no browser. A spec that is refused comes back with the reason, which names the fix. One that is drawn comes back with its sentence, its layout and where in the spec each part comes from, and at each room the parts that show, what a fit rule hides or changes there, and the lever that would change it. It measures nothing: use draw_view to see it.',
    inputSchema: { type: 'object', required: ['spec'], properties: { spec: VIEW, ...DATA, rooms: { type: 'array', description: 'The rooms to read it at, in px. Left out: a sidebar (346 wide), a tile (250 by 100) and a cell (120 by 60).', items: { type: 'object', required: ['inline'], properties: { inline: { type: 'number' }, block: { type: 'number' } } } } } },
    run: (args) => {
      const spec = specOf(args), rooms = (args.rooms as Room[] | undefined) ?? ROOMS;
      // A board is its views, each on the board's shared query: every one is checked, under its title.
      if ((spec as { spec?: string }).spec === 'board/0') {
        if (args.result) throw new Error('A board\'s views each have an answer of their own, so one "result" is not theirs. Check each view with its own, or leave "result" and "catalog" out to read them on the fixture engine.');
        const out: Record<string, Checked> = {};
        for (const v of boardViews(spec as unknown as Board, fixtureCatalog)) out[v.key] = check({ spec: v.spec, ...inputs(args, v.spec), rooms });
        return text(out);
      }
      return text(check({ spec, ...inputs(args, spec), rooms }));
    } },
  { name: 'draw_view',
    description: 'Draw a spec in a browser, as <ua-view> draws it, at a ladder of widths from 480 px to 40 px. Returns pictures of three of them, where every frame and every part is saved, and what the check found: a part cut or reaching past its frame, parts that cross, a part that shows where its fit rule says it should not. Slow: it starts a browser.',
    inputSchema: { type: 'object', required: ['spec'], properties: { spec: VIEW, ...DATA, theme: { enum: ['light', 'dark'] }, height: { type: 'number', description: 'A height in px to hand the view. Left out, it takes its natural height.' } } },
    run: (args) => {
      const spec = specOf(args), given = inputs(args, spec);
      if (!existsSync(BENCH + 'capture.ts')) throw new Error('The bench is not beside this package, and it is what draws: run this server from a checkout of the repository, or use check_view.');
      const refusal = check({ spec, ...given });
      if (!refusal.ok) return text(refusal);                                // refused before a browser is started
      const file = join(mkdtempSync(join(tmpdir(), 'ua-view-')), 'view.json');
      writeFileSync(file, JSON.stringify(args.result ? { spec, ...given } : { spec }));
      const ran = execFileSync('node', ['capture.ts', 'spec=' + file, 'themes=' + (args.theme ?? 'light'), 'heights=' + (args.height ?? 'natural'), 'scenario=' + (args.state ?? 'typical')], { cwd: BENCH, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      const at = /frames in (\S+)/.exec(ran)?.[1];
      if (!at) throw new Error('The capture ran and named no folder: ' + ran.slice(-200));
      execFileSync('node', ['check.ts', 'capture=' + at], { cwd: BENCH, stdio: 'ignore' });
      const { records } = JSON.parse(readFileSync(at + 'capture.json', 'utf8')) as { records: { width: string; frame: string; measure: { width: number; height: number; parts: Record<string, unknown> } }[] };
      const findings = JSON.parse(readFileSync(at + 'check.json', 'utf8')) as { check: string; part: string; width: string; detail: string }[];
      const shown = ['480', '250', '120'].flatMap((w) => records.filter((r) => r.width === w));
      return [
        ...text({ folder: at, frames: records.map((r) => ({ width: r.width, size: r.measure.width + ' × ' + r.measure.height, parts: Object.keys(r.measure.parts), picture: at + r.frame })), findings: findings.map((f) => ({ check: f.check, part: f.part, width: f.width, detail: f.detail })) }),
        ...shown.map((r): Content => ({ type: 'image', data: readFileSync(at + r.frame).toString('base64'), mimeType: 'image/png' })),
      ];
    } },
];

/** The versions of the protocol this speaks. A client that asks for one of them gets it, and any other gets the last. */
const VERSIONS = ['2024-11-05', '2025-03-26', '2025-06-18'];
interface Message { jsonrpc: '2.0'; id?: number | string; method?: string; params?: Record<string, unknown> }

/** Answer one message. A notification has no id and gets no answer. */
export function handle(m: Message): object | undefined {
  const reply = (result: object) => ({ jsonrpc: '2.0', id: m.id, result }), fail = (code: number, message: string) => ({ jsonrpc: '2.0', id: m.id, error: { code, message } });
  if (m.id === undefined) return undefined;
  if (m.method === 'initialize') return reply({ protocolVersion: VERSIONS.includes(m.params?.protocolVersion as string) ? m.params!.protocolVersion : VERSIONS.at(-1), capabilities: { tools: {} }, serverInfo: { name: 'ua-view', version: '0.0.0' } });
  if (m.method === 'ping') return reply({});
  if (m.method === 'tools/list') return reply({ tools: TOOLS.map(({ run: _run, ...tool }) => tool) });
  if (m.method === 'tools/call') {
    const tool = TOOLS.find((t) => t.name === m.params?.name);
    if (!tool) return fail(-32602, 'No tool called ' + JSON.stringify(m.params?.name) + '. There are: ' + TOOLS.map((t) => t.name).join(', ') + '.');
    // What a tool cannot do with what it was handed is an answer, with its fix, and not a fault of the protocol.
    try { return reply({ content: tool.run((m.params!.arguments as Record<string, unknown>) ?? {}) }); } catch (e) { return reply({ content: text((e as Error).message), isError: true }); }
  }
  return fail(-32601, 'This server answers initialize, ping, tools/list and tools/call, and not ' + JSON.stringify(m.method) + '.');
}

// Run as a program, it speaks over stdio: a message to a line, each way.
if (import.meta.main) {
  createInterface({ input: process.stdin }).on('line', (line) => {
    if (!line.trim()) return;
    let answer: object | undefined;
    try { answer = handle(JSON.parse(line) as Message); } catch { answer = { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'That line is not JSON. Send one JSON-RPC message to a line.' } }; }
    if (answer) process.stdout.write(JSON.stringify(answer) + '\n');
  });
}
