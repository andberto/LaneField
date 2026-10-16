// Verify the analytic demo against independent numerical quadrature.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../dist/field-lab.js', import.meta.url), 'utf8');
const context = vm.createContext({ document: { querySelector: () => null } });
vm.runInContext(`${source}\nglobalThis.math = LaneFieldMath;`, context);
const { segment, weight, at } = context.math;
function close(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
}
function quadrature(p, s, sigma) {
  const n = 20000;
  let sum = 0;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = s.a[0] + t * (s.b[0] - s.a[0]), y = s.a[1] + t * (s.b[1] - s.a[1]);
    const k = Math.exp(-((p[0] - x) ** 2 + (p[1] - y) ** 2) / (2 * sigma * sigma));
    sum += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * k;
  }
  return s.length * sum / (3 * n);
}
const horizontal = segment([-10, 0], [10, 0]);
const oblique = segment([-4, -3], [6, 4]);
let comparisons = 0;
for (const s of [horizontal, oblique]) for (const p of [[0, 0], [2, 2], [12, 0], [-15, -3], [6, 8]]) for (const sigma of [.4, 1.75, 3.5]) {
  close(weight(p, s, sigma), quadrature(p, s, sigma), 2e-6); comparisons++;
}
console.log(`PASS: ${comparisons} closed-form weights match numerical Simpson integration, including beyond endpoints.`);
const reverse = segment(oblique.b, oblique.a);
for (const key of ['xx', 'xy', 'yy', 'proximity', 'confidence']) close(at([1, 2], [oblique])[key], at([1, 2], [reverse])[key]);
const half = oblique.a.map((v, i) => (v + oblique.b[i]) / 2);
const split = [segment(oblique.a, half), segment(half, oblique.b)];
for (const key of ['xx', 'xy', 'yy', 'proximity', 'confidence']) close(at([1, 2], [oblique])[key], at([1, 2], split)[key], 2e-6);
console.log('PASS: endpoint reversal and collinear subdivision preserve the constructed field.');
const crossing = [horizontal, segment([0, -10], [0, 10])];
const center = at([0, 0], crossing);
close(center.confidence, 0);
assert.ok(center.channels[3] > .89);
close(at([0, 0], [horizontal]).confidence, 1);
const far = at([100, 100], crossing);
assert.ok(far.channels.every(v => Number.isFinite(v) && Math.abs(v) < 1e-8));
console.log('PASS: orthogonal crossing has high proximity and zero confidence; isolated lane has unit raw confidence; background vanishes.');
for (let x = -14; x <= 14; x++) for (let y = -9; y <= 9; y++) {
  const result = at([x, y], [oblique, ...crossing]);
  close(result.xx + result.yy, result.proximity);
  result.channels.forEach((value, i) => assert.ok(Number.isFinite(value) && (i === 1 ? value >= -.5 && value <= .5 : value >= 0 && value <= 1)));
}
console.log('PASS: trace equals raw proximity, and all target channels obey the paper’s bounds over the grid.');
const collapsed = segment([2, 2], [2, 2]);
close(weight([2, 2], collapsed, 1.75), 0);
assert.ok(at([2, 2], [collapsed]).channels.every(v => Number.isFinite(v) && v === 0));
assert.ok(at([0, 0], []).channels.every(v => Number.isFinite(v) && v === 0));
console.log('PASS: collapsed geometry and an empty enabled-segment set yield finite zero targets.');
