import { boardSelect, boardViews, filterSaid, type Board, type Where } from '@unified-analytics/core';
import { UaView } from '@unified-analytics/dom';
import { boardSamples, catalog, runQuery, type Scenario } from '@unified-analytics/fixtures';
import { el } from './page.ts';
import { register } from './setup.ts';

/* A board on a page: the reference for a surface that draws one. The page is the surface, so it does the three things
 * core leaves to one: it holds the board, it runs each view's query (here the fixture engine), and it says where the
 * views stand (bench.css). The rest is core's: boardViews() gives each view's spec and what it is to mark, and
 * boardSelect() the board after a view proposes a selection. The controls are chrome, and set the board's query too. */
register();
const controls = document.querySelector<HTMLFormElement>('#controls')!, grid = document.querySelector<HTMLElement>('#board')!;
const filter = document.querySelector<HTMLElement>('#filter')!, state = document.querySelector<HTMLElement>('#state')!;
let board: Board = boardSamples.traffic!.board;
document.querySelector('#title')!.textContent = board.title ?? '';

// Selected has no look of its own yet: that is design's to set (reference, section 13). So that a selection can be seen
// here the page lends one, inside each view, as the parts page lends its outline (setup.ts, focus).
const lent = new CSSStyleSheet();
lent.replaceSync('.uav-body:has([data-selected]) :is([data-row], [data-series]):not([data-selected], [data-row] *) { opacity: .3; }');
// ponytail: a view takes its sheets back on each paint and says nothing when it has painted, so the rule is lent again
// a moment after each change. An event from the element, if a selection is ever seen late here.
const lend = () => setTimeout(() => { for (const { view } of cards.values()) { const root = view.shadowRoot; if (root && !root.adoptedStyleSheets.includes(lent)) root.adoptedStyleSheets = [...root.adoptedStyleSheets, lent]; } }, 60);

const cards = new Map<string, { view: UaView; note: HTMLElement }>();
function card(key: string) {
  const cell = grid.appendChild(el('section', 'card')), frame = el('div', 'frame ua-stack'), note = el('p', 'meta');
  cell.append(el('h2', '', key), frame, note);
  const view = frame.appendChild(new UaView());
  view.catalog = catalog; view.dataset.key = key;
  cards.set(key, { view, note });
  return cards.get(key)!;
}

function draw() {
  const { scenario } = Object.fromEntries(new FormData(controls)) as { scenario: Scenario };
  for (const v of boardViews(board, catalog)) {
    const { view, note } = cards.get(v.key) ?? card(v.key);
    // The spec and its answer go in together, so no view is drawn from the answer to its last query.
    try { view.inputs = { spec: v.spec, result: runQuery(v.spec.query, scenario) }; view.selected = v.selected; note.className = 'meta'; note.textContent = ''; }
    catch (e) { note.className = 'meta error'; note.textContent = (e as Error).message; }
  }
  const { where, ...rest } = board.query ?? {}, said = filterSaid(where, catalog);
  filter.textContent = said ? 'Filtered to ' + said + '. ' : 'Nothing selected. Activate a row or a day, with a click or Enter, to filter the other views by it; again to let it go.';
  if (said) filter.append(Object.assign(el('button', '', 'Let it all go'), { type: 'button', onclick: () => { board = { ...board, query: rest }; draw(); } }));
  state.textContent = JSON.stringify(board, null, 2);
  lend();
}

// A view proposes, the board keeps: the event is the view's own, so its target says which view.
grid.addEventListener('ua-select', (e) => { board = boardSelect(board, (e.target as HTMLElement).dataset.key!, (e as CustomEvent<{ where: Where | null }>).detail.where); draw(); });
controls.addEventListener('change', () => {
  const form = new FormData(controls), { compare: _, ...rest } = board.query ?? {};
  board = { ...board, query: { ...rest, range: String(form.get('range')), ...(form.has('compare') && { compare: 'previous' as const }) } };
  draw();
});
draw();
