import { describe, expect, it } from 'vitest';
import { FIT_RULES } from '@universal-analytics/core';
import { compileFitRules } from '@universal-analytics/dom';
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
  const fig = (keep: string) => '.vg[data-layout="matrix"]:not([data-keep~="' + keep + '"])';
  it('sets each cell in its track by two custom properties, in a grid whose tracks are counted by two more', () => {
    expect(matrix.css).toContain('grid-template: repeat(var(--vg-ny), minmax(0, 1fr)) / repeat(var(--vg-nx), minmax(0, 1fr));');
    expect(matrix.css).toContain('.vg-cells i { grid-area: var(--vg-cy) / var(--vg-cx);');
  });
  it('gives up the ramp, then the body for the number, by width and by height', () => {
    expect(css).toContain('@container view (inline-size < 240px) {\n  ' + fig('guides') + ' .vg-ramp { display: none; }\n}');
    expect(css).toContain('@container view (block-size < 150px) {\n  ' + fig('guides') + ' .vg-ramp { display: none; }\n}');
    const alone = ['  ' + fig('marks') + ' :is(.vg-plot, .vg-ramp) { display: none; }', '  ' + fig('marks') + ' .vg-number { display: block; }',
      '  ' + fig('marks') + ' { grid-template: "number" auto / minmax(0, 1fr); }', '  ' + fig('marks') + ' .vg-body { display: none; }', '  ' + fig('marks') + ' .vg-number { margin: 0; }', '}'].join('\n');
    expect(css).toContain('@container view (inline-size < 150px) {\n' + alone);
    expect(css).toContain('@container view (block-size < 90px) {\n' + alone);
  });
});
