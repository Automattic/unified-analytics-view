import { spawn } from 'node:child_process';
import { describe as group, expect, it } from 'vitest';
import { FIELDS, FIT_RULES, PRESETS, READS, type Spec } from '@unified-analytics/core';
import { ROOMS, check, describe } from '@unified-analytics/agent';
import { boardSamples, catalog, facetSamples, moreSamples, runQuery, samples } from '@unified-analytics/fixtures';
import { TOOLS, handle } from '../packages/agent/src/server.ts';
import { err } from './helpers.ts';

/* The agent surface (docs/focus-plan.md, step 7): what an author outside this repository is handed. It wraps core and
 * adds no rule, so what is held here is that it says what core says: the tables whole, and resolve()'s own refusals. */
const trend = samples.trend!.spec, on = (spec: Spec) => ({ spec, result: runQuery(spec.query), catalog });

group('describe: what can be said, as data', () => {
  const said = describe(catalog);
  it('is core\'s own tables, the four schemas and the catalog it was handed', () => {
    expect([said.reads, said.fields, said.fit, said.presets.library, said.catalog]).toEqual([READS, FIELDS, FIT_RULES, PRESETS, catalog]);
    expect(Object.keys(said.schemas)).toEqual(['view', 'catalog', 'board', 'scene']);
    expect(Object.keys(said.presets.registered)).toEqual(['choropleth', 'sankey', 'treemap', 'pair-list']);
    expect(said.customMarks.geo).toMatchObject({ reads: { x: ['dimension'], color: ['metric'], size: ['metric'] }, fields: ['paint'] });
    expect(JSON.parse(JSON.stringify(said))).toEqual(said);            // all of it is data
  });
});

group('check: a spec read with no browser', () => {
  it('every sample is drawn: a sentence, a layout, where each part comes from, and at each room what shows and why', () => {
    for (const [name, { spec }] of Object.entries({ ...samples, ...moreSamples })) {
      const c = check(on(spec));
      if (!c.ok) throw new Error(name + ': ' + c.error);
      const [view] = c.views;
      expect([c.views.length, view!.rooms.map((r) => r.room)], name).toEqual([1, ROOMS]);
      expect(view!.sentence.length, name).toBeGreaterThan(0);
      for (const r of view!.rooms) expect(r.parts.length + r.gave.length, name + ' shows something at ' + r.room.inline).toBeGreaterThan(0);
      for (const b of view!.rooms.flatMap((r) => r.because)) expect(b.why, name).toMatch(/^rule "/);
    }
  });
  it('says the lever where a rule took something a spec could keep', () => {
    const c = check({ ...on(trend), rooms: [{ inline: 250 }] });
    expect(c.ok && c.views[0]!.rooms[0]).toMatchObject({ parts: ['number', 'plot'], set: { arrange: 'side' } });
    expect(c.ok && c.views[0]!.rooms[0]!.because.find((b) => b.part === 'x-axis')).toMatchObject({ what: 'hidden', rule: 'axes', lever: expect.stringContaining('add "guides" to keep') });
  });
  it('a spec that is refused comes back with the message resolve() gives', () => {
    for (const spec of [{ ...trend, use: 'no-such-preset' }, { query: { metrics: ['visitors'], by: ['channel'] } }, { query: trend.query, layers: [{ mark: 'line', encode: { x: 'date.day', y: 'visitors', size: 'visitors' } }] }] as Spec[])
      expect(check(on(spec))).toEqual({ ok: false, error: err(spec) });
  });
  it('and what only the schema refuses is refused too, once core has had its say: a value of the wrong kind, which core reads past', () => {
    expect(check(on({ ...trend, width: 346 } as Spec))).toEqual({ ok: false, error: err({ ...trend, width: 346 } as Spec) });
    const kept = { ...trend, keep: ['axes'] } as unknown as Spec;
    expect(err(kept)).toBeUndefined();
    expect(check(on(kept))).toEqual({ ok: false, error: 'spec.keep[0] must be equal to one of the allowed values: guides, secondary, rows, marks.' });
  });
  it('a spec with a facet is each of its views, under its value', () => {
    const spec = Object.values(facetSamples)[0]!.spec, c = check(on(spec));
    expect(c.ok && c.views.length).toBeGreaterThan(1);
    expect(c.ok && c.views.every((v) => typeof v.key === 'string' && v.rooms.length === ROOMS.length)).toBe(true);
  });
});

group('the server: three tools over JSON-RPC', () => {
  const call = (name: string, args: object) => (handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) as { result: { content: { type: string; text: string }[]; isError?: boolean } }).result;
  it('says who it is in the version it was asked for, and lists its tools with a schema each', () => {
    expect(handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } })).toMatchObject({ id: 1, result: { protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'ua-view' } } });
    expect(handle({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } })).toMatchObject({ result: { protocolVersion: '2025-06-18' } });
    const listed = (handle({ jsonrpc: '2.0', id: 3, method: 'tools/list' }) as { result: { tools: { name: string; inputSchema: object }[] } }).result.tools;
    expect(listed.map((t) => t.name)).toEqual(['describe', 'check_view', 'draw_view']);
    expect(listed.every((t) => 'inputSchema' in t && !('run' in t))).toBe(true);
    expect(handle({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBeUndefined();
    expect(handle({ jsonrpc: '2.0', id: 4, method: 'resources/list' })).toMatchObject({ error: { code: -32601 } });
  });
  it('check_view reads a spec on the fixture engine where no answer is passed, and on its own where one is', () => {
    const fixtures = JSON.parse(call('check_view', { spec: trend }).content[0]!.text), own = JSON.parse(call('check_view', on(trend)).content[0]!.text);
    expect(fixtures).toEqual(JSON.parse(JSON.stringify(check(on(trend)))));
    expect(own).toEqual(fixtures);
    expect(JSON.parse(call('check_view', { spec: trend, state: 'empty' }).content[0]!.text).views[0].sentence).toBe('Visitors: nothing recorded in the last 28 days.');
    expect(JSON.parse(call('check_view', { spec: { ...trend, use: 'nope' } }).content[0]!.text)).toEqual({ ok: false, error: err({ ...trend, use: 'nope' }) });
  });
  it('check_view reads a board as its views, each under its title', () => {
    const board = Object.values(boardSamples)[0]!.board, out = JSON.parse(call('check_view', { spec: board }).content[0]!.text);
    expect(Object.keys(out)).toEqual(board.views.map((v) => v.title));
    expect(Object.values(out).every((c) => (c as { ok: boolean }).ok)).toBe(true);
  });
  it('what a tool cannot do with what it was handed is an answer that names the fix', () => {
    expect(call('check_view', {})).toMatchObject({ isError: true, content: [{ text: expect.stringMatching(/^Pass "spec": a view\/0 spec, for example /) }] });
    expect(call('check_view', { spec: trend, result: runQuery(trend.query) })).toMatchObject({ isError: true, content: [{ text: expect.stringMatching(/^Pass "result" and "catalog" together/) }] });
    expect(call('check_view', { spec: trend, state: 'busy' })).toMatchObject({ isError: true, content: [{ text: '"state" is "busy", and the fixture engine has: typical, no-prior, empty.' }] });
    expect(handle({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'paint_view' } })).toMatchObject({ error: { message: 'No tool called "paint_view". There are: describe, check_view, draw_view.' } });
  });
  it('describe gives the sections asked for', () => {
    expect(Object.keys(JSON.parse(call('describe', { sections: ['reads', 'catalog'], fixtures: true }).content[0]!.text))).toEqual(['reads', 'catalog']);
    expect(TOOLS.every((t) => t.description.length > 40)).toBe(true);
  });
  it('speaks over stdio, a message to a line', async () => {
    const child = spawn(process.execPath, [new URL('../packages/agent/src/server.ts', import.meta.url).pathname], { stdio: ['pipe', 'pipe', 'inherit'] });
    const lines: string[] = await new Promise((done, fail) => {
      let out = '';
      child.stdout.on('data', (d) => { out += d; const got = out.split('\n').filter(Boolean); if (got.length === 2) { child.kill(); done(got); } });
      child.on('error', fail);
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }) + '\n' + JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n' + JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }) + '\n');
    });
    expect(lines.map((l) => JSON.parse(l).id)).toEqual([1, 2]);
    expect(JSON.parse(lines[1]!).result.tools).toHaveLength(3);
  }, 20000);
});
