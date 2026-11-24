import { describe, expect, it } from 'vitest';
import { FIT_RULES } from '@unified-analytics/core';
import { compileFitRules } from '@unified-analytics/dom';
import { matrix, stepCell } from '../packages/dom/src/layouts/matrix.ts';

// String work and one plain function, with no DOM. Focus, hover, the readout and the table are checked in a browser on the bench.
describe('stepCell', () => {
  it('moves left and right along x and up and down along y, and stops at the edges', () => {
    expect(stepCell('ArrowRight', [2, 3], 24, 7)).toEqual([3, 3]);
    expect(stepCell('ArrowLeft', [2, 3], 24, 7)).toEqual([1, 3]);
    expect(stepCell('ArrowDown', [2, 3], 24, 7)).toEqual([2, 4]);
    expect(stepCell('ArrowUp', [2, 3], 24, 7)).toEqual([2, 2]);
    expect(stepCell('ArrowRight', [23, 6], 24, 7)).toEqual([23, 6]);
    expect(stepCell('ArrowDown', [23, 6], 24, 7)).toEqual([23, 6]);
    expect(stepCell('ArrowLeft', [0, 0], 24, 7)).toEqual([0, 0]);
    expect(stepCell('ArrowUp', [0, 0], 24, 7)).toEqual([0, 0]);
  });
  it('starts at the first cell from nothing, as version 4 starts at the first point', () => {
    for (const k of ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp']) expect(stepCell(k, null, 24, 7)).toEqual([0, 0]);
  });
  it('leaves every other key, and a grid with no cells, alone', () => {
    for (const k of ['Tab', 'Home', 'End', 'a']) expect(stepCell(k, [1, 1], 24, 7)).toBeNull();
    expect(stepCell('ArrowRight', null, 0, 7)).toBeNull();
  });
});

describe('the matrix layout', () => {
  const css = compileFitRules(FIT_RULES.filter((r) => r.layout === 'matrix'), { matrix: matrix.fit! });
  const fig = (_was?: string) => '.uav[data-layout="matrix"]';
  it('sets what a pair says in the middle of the pair\'s place, as a plot\'s label and not cut short', () => {
    // The label is the plot's own (points.ts): the grid moves it from above its point to the middle of its cell.
    expect(matrix.css).toContain('.uav[data-layout="matrix"] .uav-point-labels span { translate: -50% -50%; max-inline-size: none; }');
  });
  it('sets each cell in its track by two custom properties, in a grid whose tracks are counted by two more', () => {
    expect(matrix.css).toContain('grid-template: repeat(var(--uav-ny), minmax(0, 1fr)) / repeat(var(--uav-nx), minmax(0, 1fr));');
    expect(matrix.css).toContain('.uav-cells i { grid-area: var(--uav-cy) / var(--uav-cx);');
  });
  it('steps the ramp down to a strip and the key to sizes to its largest step, then gives the body up for the number, by width and by height', () => {
    // Neither key is taken: each is in its shorter form, and stays as long as the grid.
    const shorter = ['  ' + fig('guides') + ' { --uav-ramp: strip; --uav-size-key: most; }', '  ' + fig('guides') + ' .uav-ramp { gap: 0; }', '  ' + fig('guides') + ' .uav-ramp i { --uav-swatch-i: 7px; --uav-swatch-r: 0px; }',
      '  ' + fig('guides') + ' .uav-ramp :is([data-key="ramp:none"], [data-key="ramp:none:label"]) { display: none; }', '  ' + fig('guides') + ' .uav-size > :not(:first-child):not(:nth-last-child(-n+2)) { display: none; }', '}'].join('\n');
    expect(css).toContain('@container uav-view (inline-size < 239.5px) {\n' + shorter);
    expect(css).toContain('@container uav-view (block-size < 149.5px) {\n' + shorter);
    const alone = ['  ' + fig('marks') + ' :is(.uav-plot, .uav-point-labels, .uav-x-axis, .uav-y-axis, .uav-ramp, .uav-size) { display: none; }', '  ' + fig('marks') + ' .uav-number { display: block; }',
      '  ' + fig('marks') + ' { grid-template: "number" auto / minmax(0, 1fr); }', '  ' + fig('marks') + ' .uav-body { display: none; }', '  ' + fig('marks') + ' .uav-number { align-self: start; margin: 0; }', '}'].join('\n');
    expect(css).toContain('@container uav-view (inline-size < 149.5px) {\n' + alone);
    expect(css).toContain('@container uav-view (block-size < 89.5px) {\n' + alone);
  });
});
