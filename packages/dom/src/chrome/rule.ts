import { paintVar } from '../dom.ts';
import { FOCUS, HOVER, token } from '../tokens.ts';
import { IS } from '../rove.ts';

/* A rule: a line painted as a background, so its stroke stays true at any size. Five things draw one, each placing
 * its own box: a reference line across a plot (`.uav-line`, cartesian.ts) or upright at an x (points.ts), a segment
 * from (x, t) to (x2, t2) (ranges.ts), a rule along a row's track and a tick across it (track.ts), and the crosshair's
 * rule at a line's value and the hit's at a point (keys.ts). What they share is here, the Rule set in Figma:
 *
 * - Width: the scene's stroke (`--uav-stroke`), or the rule token. RULE is that, for the box that is as thick as it.
 * - Dash: a dashed rule is one gradient, run along it. One that stands upright says so with `--uav-rule-way: 0deg`.
 * - State: at rest a rule is the scene's paint and stroke. The crosshair's and the hit's are hover or focus, at the
 *   weights tokens.ts gives each, as `--uav-rule` and `--uav-rule-paint`. */
export const RULE = `var(--uav-stroke, ${token('stroke-width-rule')})`;

export const RULE_CSS = `
.uav-line[data-dash] { background: repeating-linear-gradient(var(--uav-rule-way, 90deg), var(--uav-paint) 0 var(--uav-dash), transparent 0 calc(var(--uav-dash) + var(--uav-gap))); }
:is(.uav-cross, .uav-hits ${IS.held}) { --uav-rule: ${HOVER.width}; --uav-rule-paint: ${paintVar('rule')}; }
:is(.uav-cross${IS.focus}, .uav-hits ${IS.focus}) { --uav-rule: ${FOCUS.width}; --uav-rule-paint: ${FOCUS.color}; }`;
