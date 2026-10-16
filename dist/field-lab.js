'use strict';

// Analytic construction from Sec. 3.2 and supplementary derivation/implementation.
// Coordinates, lengths and sigma are in metres. No model predictions are used.
const LaneFieldMath = (() => {
  function erf(x) {
    if (x === 0) return 0;
    const sign = Math.sign(x);
    const t = 1 / (1 + .3275911 * Math.abs(x));
    const polynomial = (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t;
    return sign * (1 - polynomial * Math.exp(-x * x));
  }
  function segment(a, b) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return { a, b, length, tangent: length > 1e-8 ? [(b[0] - a[0]) / length, (b[1] - a[1]) / length] : [0, 0] };
  }
  function weight(p, s, sigma) {
    if (s.length < 1e-8 || sigma <= 0) return 0;
    const dx = p[0] - s.a[0], dy = p[1] - s.a[1];
    const along = dx * s.tangent[0] + dy * s.tangent[1];
    const perpendicular2 = Math.max(0, dx * dx + dy * dy - along * along);
    const scale = Math.SQRT2 * sigma;
    // The supporting-line projection stays unclamped; erf handles finite ends.
    return Math.max(0, sigma * Math.sqrt(Math.PI / 2) * Math.exp(-perpendicular2 / (2 * sigma * sigma)) * (erf((s.length - along) / scale) - erf(-along / scale)));
  }
  function at(p, segments, sigma = 1.75) {
    const weights = segments.map(s => weight(p, s, sigma));
    let xx = 0, xy = 0, yy = 0;
    segments.forEach((s, i) => {
      xx += weights[i] * s.tangent[0] ** 2;
      xy += weights[i] * s.tangent[0] * s.tangent[1];
      yy += weights[i] * s.tangent[1] ** 2;
    });
    const proximity = weights.reduce((sum, value) => sum + value, 0);
    const trace = xx + yy;
    const delta = Math.hypot(xx - yy, 2 * xy);
    const confidence = trace > 1e-10 ? Math.min(1, delta / trace) : 0;
    const bounded = proximity / (proximity + 1);
    const mask = 1 / (1 + Math.exp(-20 * (bounded - .3)));
    return {
      weights, xx, xy, yy, proximity, confidence,
      eigenvalues: [(trace + delta) / 2, Math.max(0, (trace - delta) / 2)],
      angle: Math.atan2(2 * xy, xx - yy) / 2,
      channels: [xx / (trace + 1e-8) * mask, xy / (trace + 1e-8) * mask, yy / (trace + 1e-8) * mask, bounded, confidence * mask]
    };
  }
  return Object.freeze({ erf, segment, weight, at });
})();

(() => {
  const lab = document.querySelector('#field-lab');
  if (!lab) return;
  const { segment, weight, at } = LaneFieldMath;
  function preset(name) {
    const definitions = {
      straight: { points: [[-10, 0], [10, 0]], edges: [[0, 1]] },
      bend: { points: [[-11, -4], [-4, -4], [1, -1], [4, 5], [10, 6]], edges: [[0, 1], [1, 2], [2, 3], [3, 4]] },
      crossing: { points: [[-10, 0], [10, 0], [0, -8], [0, 8]], edges: [[0, 1], [2, 3]] }
    };
    const result = definitions[name];
    return { ...result, enabled: result.edges.map(() => true) };
  }
  const state = { scene: 'straight', geometry: preset('straight'), selected: 0, stage: 0, p: [2, 2], t: .5, sigma: 1.75, target: 'p' };
  const colors = ['#266ba5', '#b96837', '#5b62ae', '#39836f'];
  const canvas = lab.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  let width = 560, height = 360, mapDrag = null, frame = 0, heatDirty = true;
  const heat = document.createElement('canvas');
  heat.width = 112; heat.height = 72;
  const heatContext = heat.getContext('2d');
  const fmt = n => Math.abs(n) < .0005 ? '0.000' : n.toFixed(3);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const world = (x, y) => [width * (x + 14) / 28, height * (9 - y) / 18];
  const allSegments = () => state.geometry.edges.map(([a, b]) => segment(state.geometry.points[a], state.geometry.points[b]));
  const activeSegments = () => allSegments().filter((s, i) => state.geometry.enabled[i]);
  const selectedSegment = () => allSegments()[state.selected];
  const line = (a, b, color, strokeWidth = 1, dash = []) => {
    ctx.beginPath(); ctx.setLineDash(dash); ctx.strokeStyle = color; ctx.lineWidth = strokeWidth;
    ctx.moveTo(...world(...a)); ctx.lineTo(...world(...b)); ctx.stroke(); ctx.setLineDash([]);
  };
  function rebuildHeat() {
    const pixels = heatContext.createImageData(heat.width, heat.height);
    const contributions = state.stage === 1 ? [selectedSegment()] : activeSegments();
    for (let y = 0; y < heat.height; y++) for (let x = 0; x < heat.width; x++) {
      const p = [28 * (x + .5) / heat.width - 14, 9 - 18 * (y + .5) / heat.height];
      const value = at(p, contributions, state.sigma);
      const color = state.stage === 3 ? [139 + 100 * (1 - value.confidence), 104 + 65 * value.confidence, 77 + 128 * value.confidence] : [57, 124, 179];
      const i = (y * heat.width + x) * 4;
      pixels.data[i] = color[0]; pixels.data[i + 1] = color[1]; pixels.data[i + 2] = color[2];
      pixels.data[i + 3] = Math.round(value.channels[3] * 150);
    }
    heatContext.putImageData(pixels, 0, 0);
  }
  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, width, height);
    if (state.stage > 0) { ctx.imageSmoothingEnabled = true; ctx.drawImage(heat, 0, 0, width, height); }
    for (let x = -12; x <= 12; x += 2) line([x, -9], [x, 9], '#193f6010');
    for (let y = -8; y <= 8; y += 2) line([-14, y], [14, y], '#193f6010');
    const active = activeSegments();
    if (state.stage >= 2) {
      for (let x = -10; x <= 10; x += 2) for (let y = -6; y <= 6; y += 2) {
        const value = at([x, y], active, state.sigma);
        if (value.channels[3] < .1) continue;
        ctx.save(); ctx.translate(...world(x, y)); ctx.rotate(-value.angle);
        ctx.beginPath(); ctx.ellipse(0, 0, 3 + 7 * value.confidence, 3, 0, 0, 2 * Math.PI);
        ctx.strokeStyle = `rgba(34,79,115,${value.channels[3] * .55})`; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
      }
    }
    allSegments().forEach((s, i) => {
      const selected = i === state.selected;
      const color = state.geometry.enabled[i] ? colors[i] : '#9baab6';
      const normal = [-s.tangent[1] * 1.75, s.tangent[0] * 1.75];
      for (const sign of [-1, 1]) line(s.a.map((v, j) => v + sign * normal[j]), s.b.map((v, j) => v + sign * normal[j]), '#526d842e', 1, [4, 4]);
      if (selected) line(s.a, s.b, colors[i] + '22', 12);
      line(s.a, s.b, color, selected ? 3.5 : 2.5, state.geometry.enabled[i] ? [] : [5, 4]);
      [s.a, s.b].forEach(point => {
        ctx.beginPath(); ctx.arc(...world(...point), selected ? 6 : 3, 0, 2 * Math.PI);
        ctx.fillStyle = selected ? '#fff' : color; ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
      });
      const midpoint = s.a.map((v, j) => (v + s.b[j]) / 2);
      ctx.fillStyle = color; ctx.font = '600 11px Manrope, sans-serif';
      ctx.fillText(`S${i + 1}`, ...world(midpoint[0] - .6 * s.tangent[1], midpoint[1] + .7 * s.tangent[0]));
    });
    const selected = selectedSegment();
    for (const [point, name] of [[selected.a, 'A'], [selected.b, 'B']]) {
      const [x, y] = world(...point); ctx.fillStyle = '#314b63'; ctx.fillText(name, x - 5, y + (y > height - 30 ? -13 : 22));
    }
    if (state.stage === 1) {
      const q = selected.a.map((v, j) => v + state.t * (selected.b[j] - v));
      const qp = world(...q);
      line(q, state.p, '#b96837', 1.5, [5, 4]);
      ctx.beginPath(); ctx.arc(...qp, 6, 0, 2 * Math.PI); ctx.fillStyle = '#b96837'; ctx.fill();
      ctx.fillText('q(t)', qp[0] + 9, qp[1] + 18);
    }
    const value = at(state.p, active, state.sigma);
    const pp = world(...state.p);
    if (state.stage >= 2 && value.proximity > 1e-5) {
      ctx.save(); ctx.translate(...pp); ctx.rotate(-value.angle);
      ctx.beginPath(); ctx.ellipse(0, 0, 12 + 22 * value.confidence, 12, 0, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffffc9'; ctx.fill(); ctx.strokeStyle = '#254d70'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    }
    ctx.beginPath(); ctx.arc(...pp, 6, 0, 2 * Math.PI); ctx.fillStyle = '#c15a29'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.fillStyle = '#853a16'; ctx.font = '700 13px Manrope, sans-serif'; ctx.fillText('p', pp[0] + 12, pp[1] - 10);
    ctx.fillStyle = '#6b7f90'; ctx.font = '10px Manrope, sans-serif'; ctx.fillText('BEV · metres', 12, height - 12);
    line([10, -7.7], [12, -7.7], '#6b7f90', 2); ctx.fillText('2 m', ...world(10.6, -7.3));
  }
  function paint(heatChanged = false) {
    heatDirty ||= heatChanged;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (heatDirty && state.stage > 0) { rebuildHeat(); heatDirty = false; }
      draw();
    });
  }
  function buildSegmentControls() {
    const options = lab.querySelector('#segment-options');
    const rows = lab.querySelector('[data-contributions]');
    options.replaceChildren(); rows.replaceChildren();
    state.geometry.edges.forEach((edge, i) => {
      const label = document.createElement('label');
      const radio = document.createElement('input'); radio.type = 'radio'; radio.name = 'lab-segment'; radio.value = String(i);
      const span = document.createElement('span'); span.textContent = `S${i + 1}`;
      radio.addEventListener('change', () => selectSegment(i)); label.append(radio, span); options.append(label);
      const row = document.createElement('button'); row.type = 'button'; row.className = 'segment-contribution'; row.dataset.segment = i;
      row.setAttribute('aria-label', `Inspect segment S${i + 1}`); row.setAttribute('aria-pressed', 'false');
      const name = document.createElement('span'); name.textContent = `I${'₁₂₃₄'[i]}(p)`;
      const track = document.createElement('span'); track.className = 'contribution-track';
      const fill = document.createElement('span'); fill.style.background = colors[i]; track.append(fill);
      const output = document.createElement('output');
      row.append(name, track, output); row.addEventListener('click', () => selectSegment(i)); rows.append(row);
    });
  }
  function update(announce = false, heatChanged = false) {
    const all = allSegments(), s = all[state.selected];
    const value = at(state.p, all.filter((entry, i) => state.geometry.enabled[i]), state.sigma);
    lab.dataset.segmentIndex = state.selected;
    lab.querySelectorAll('[name="lab-segment"]').forEach((radio, i) => { radio.checked = i === state.selected; });
    lab.querySelector('#segment-enabled').checked = state.geometry.enabled[state.selected];
    lab.querySelectorAll('[data-selected-segment]').forEach(el => { el.textContent = `S${state.selected + 1}`; });
    const angle = Math.atan2(s.tangent[1], s.tangent[0]) * 180 / Math.PI;
    const maxLength = Math.min(24, 26 / Math.max(Math.abs(s.tangent[0]), 1e-8), 16 / Math.max(Math.abs(s.tangent[1]), 1e-8));
    lab.querySelector('#segment-angle').value = String(angle);
    lab.querySelector('#segment-angle-value').textContent = `${Math.round(angle)}°`;
    lab.querySelector('#segment-length').max = String(Math.floor(maxLength * 10) / 10);
    lab.querySelector('#segment-length').value = String(s.length);
    lab.querySelector('#segment-length-value').textContent = `${s.length.toFixed(1)} m`;
    lab.querySelector('#segment-points').textContent = `A (${s.a.map(v => v.toFixed(1)).join(', ')}) · B (${s.b.map(v => v.toFixed(1)).join(', ')})`;
    lab.querySelector('#map-target-hint').textContent = `Arrow keys: ${{ p: 'point p', a: 'endpoint A', b: 'endpoint B', segment: 'segment', q: 'q(t)' }[state.target]} · Tab switches target`;
    lab.querySelector('#probe-position').textContent = `p = (${state.p.map(v => v.toFixed(1)).join(', ')}) m`;
    ['xx', 'xy', 'yy', 'proximity', 'confidence'].forEach(key => lab.querySelectorAll(`[data-raw="${key}"]`).forEach(output => { output.textContent = fmt(value[key]); }));
    lab.querySelector('[data-lambda="0"]').textContent = fmt(value.eigenvalues[0]);
    lab.querySelector('[data-lambda="1"]').textContent = fmt(value.eigenvalues[1]);
    lab.querySelectorAll('[data-channel]').forEach((element, i) => {
      element.querySelector('output').textContent = fmt(value.channels[i]);
      const meter = element.querySelector('.channel-fill');
      meter.style.width = `${Math.abs(value.channels[i]) * (i === 1 ? 200 : 100)}%`; meter.classList.toggle('negative', value.channels[i] < 0);
    });
    lab.querySelectorAll('.segment-contribution').forEach((row, i) => {
      const w = state.geometry.enabled[i] ? weight(state.p, all[i], state.sigma) : 0;
      row.querySelector('.contribution-track > span').style.width = `${w / (state.sigma * Math.sqrt(2 * Math.PI)) * 100}%`;
      row.querySelector('output').textContent = fmt(w); row.classList.toggle('excluded', !state.geometry.enabled[i]);
      row.setAttribute('aria-pressed', String(i === state.selected));
    });
    const q = s.a.map((v, j) => v + state.t * (s.b[j] - v));
    const distance = Math.hypot(state.p[0] - q[0], state.p[1] - q[1]);
    lab.querySelector('#kernel-value').textContent = Math.exp(-(distance ** 2) / (2 * state.sigma ** 2)).toFixed(3);
    lab.querySelector('#kernel-t').value = String(state.t);
    lab.querySelector('#kernel-t-value').textContent = state.t.toFixed(2);
    lab.querySelector('#integral-value').textContent = fmt(weight(state.p, s, state.sigma));
    const path = [], area = ['M 0 66'];
    for (let i = 0; i <= 100; i++) {
      const qx = s.a[0] + i / 100 * (s.b[0] - s.a[0]), qy = s.a[1] + i / 100 * (s.b[1] - s.a[1]);
      const kernel = Math.exp(-((state.p[0] - qx) ** 2 + (state.p[1] - qy) ** 2) / (2 * state.sigma ** 2));
      path.push(`${i ? 'L' : 'M'} ${i * 2.8} ${66 - 60 * kernel}`); area.push(`L ${i * 2.8} ${66 - 60 * kernel}`);
    }
    area.push('L 280 66 Z');
    lab.querySelector('#kernel-curve').setAttribute('d', path.join(' ')); lab.querySelector('#kernel-area').setAttribute('d', area.join(' '));
    lab.querySelector('#kernel-marker').setAttribute('x1', state.t * 280); lab.querySelector('#kernel-marker').setAttribute('x2', state.t * 280);
    const explanation = value.channels[3] < .08 ? 'Little nearby road evidence: the proximity mask suppresses the output.' : value.confidence < .2 ? 'Strong road support, competing axes. The tensor becomes almost isotropic.' : value.confidence < .8 ? 'Several orientations contribute. The dominant axis is less certain.' : 'One axis dominates. The tensor is elongated along the lane.';
    lab.querySelector('#confidence-insight').textContent = explanation;
    lab.querySelector('#field-legend').textContent = ['Selected segment: drag its handles A and B', `Blue: integral of S${state.selected + 1} · outputs use enabled segments`, 'Blue: total proximity · ellipses: local tensor', 'Amber: competing axes → blue: dominant axis'][state.stage];
    if (announce) lab.querySelector('#lab-status').textContent = `Segment S${state.selected + 1}, ${state.geometry.enabled[state.selected] ? 'included' : 'excluded'}. ${lab.querySelector('#probe-position').textContent}. Proximity ${fmt(value.channels[3])}, masked confidence ${fmt(value.channels[4])}. ${explanation}`;
    paint(heatChanged);
  }
  function selectSegment(index) { state.selected = index; update(true, true); }
  function setStage(stage) {
    state.stage = stage;
    if (stage !== 1 && state.target === 'q') state.target = 'p';
    lab.querySelectorAll('[role="tab"]').forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === stage)); tab.tabIndex = i === stage ? 0 : -1; });
    lab.querySelectorAll('[role="tabpanel"]').forEach((panel, i) => { panel.hidden = i !== stage; });
    update(false, true);
  }
  lab.querySelectorAll('[role="tab"]').forEach((tab, i) => {
    tab.addEventListener('click', () => setStage(i));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (i + 1) % 4;
      if (event.key === 'ArrowLeft') next = (i + 3) % 4;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = 3;
      if (next === undefined) return;
      event.preventDefault(); setStage(next); lab.querySelectorAll('[role="tab"]')[next].focus();
    });
  });
  function resetGeometry() {
    if (mapDrag && canvas.hasPointerCapture(mapDrag.pointerId)) canvas.releasePointerCapture(mapDrag.pointerId);
    mapDrag = null;
    state.geometry = preset(state.scene); state.selected = 0; state.target = 'p'; buildSegmentControls(); update(true, true);
  }
  lab.querySelectorAll('[name="lab-scene"]').forEach(input => input.addEventListener('change', () => {
    state.scene = input.value; state.p = state.scene === 'straight' ? [2, 2] : [0, 0]; resetGeometry();
  }));
  lab.querySelector('#geometry-reset').addEventListener('click', resetGeometry);
  lab.querySelector('#probe-reset').addEventListener('click', () => {
    state.p = state.scene === 'straight' ? [2, 2] : [0, 0]; state.t = .5; state.target = 'p'; update(true);
  });
  lab.querySelector('#segment-enabled').addEventListener('change', event => {
    state.geometry.enabled[state.selected] = event.target.checked; update(true, true);
  });
  function moveVertices(changes) {
    const candidate = state.geometry.points.map((point, i) => changes.get(i) || point);
    // Shared vertices preserve the bend; reject collapsed incident segments.
    if (state.geometry.edges.some(([a, b]) => Math.hypot(candidate[a][0] - candidate[b][0], candidate[a][1] - candidate[b][1]) < 1 - 1e-8)) return false;
    state.geometry.points = candidate; return true;
  }
  function reshape(angleDegrees, requestedLength) {
    const s = selectedSegment(), angle = angleDegrees * Math.PI / 180;
    const tx = Math.cos(angle), ty = Math.sin(angle);
    const length = Math.min(requestedLength, 26 / Math.max(Math.abs(tx), 1e-8), 16 / Math.max(Math.abs(ty), 1e-8));
    const half = [tx * length / 2, ty * length / 2];
    const center = s.a.map((v, i) => clamp((v + s.b[i]) / 2, (i ? -8 : -13) + Math.abs(half[i]), (i ? 8 : 13) - Math.abs(half[i])));
    const [a, b] = state.geometry.edges[state.selected];
    moveVertices(new Map([[a, center.map((v, i) => v - half[i])], [b, center.map((v, i) => v + half[i])]]));
    update(false, true);
  }
  // Native keyboard semantics plus explicit pointer capture make dragging reliable
  // across mouse, pen and touch, including when the pointer leaves the track.
  function bindRange(input, apply) {
    let pointerId = null;
    const read = () => apply(Number(input.value));
    input.addEventListener('input', read); input.addEventListener('change', read);
    function fromPointer(event) {
      const bounds = input.getBoundingClientRect();
      const thumb = parseFloat(getComputedStyle(input).getPropertyValue('--range-thumb')) || 20;
      const ratio = clamp((event.clientX - bounds.left - thumb / 2) / Math.max(1, bounds.width - thumb), 0, 1);
      const min = Number(input.min), max = Number(input.max), step = Number(input.step);
      input.value = String(clamp(min + Math.round(ratio * (max - min) / step) * step, min, max));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    input.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0) return;
      event.preventDefault(); pointerId = event.pointerId;
      input.focus({ preventScroll: true }); input.setPointerCapture(pointerId); fromPointer(event);
    });
    // Some native range implementations release capture on the first move.
    // Track the active gesture on the window until up/cancel, even in that case.
    window.addEventListener('pointermove', event => {
      if (event.pointerId !== pointerId) return;
      if (event.pointerType === 'mouse' && event.buttons === 0) { pointerId = null; return; }
      fromPointer(event);
    });
    function finish(event) {
      if (event.pointerId !== pointerId) return;
      if (event.type === 'pointerup') fromPointer(event);
      const id = pointerId; pointerId = null;
      if (input.hasPointerCapture(id)) input.releasePointerCapture(id);
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    window.addEventListener('pointerup', finish); window.addEventListener('pointercancel', finish);
    window.addEventListener('blur', () => { pointerId = null; });
  }
  bindRange(lab.querySelector('#kernel-t'), value => { state.t = value; update(); });
  bindRange(lab.querySelector('#segment-angle'), value => reshape(value, selectedSegment().length));
  bindRange(lab.querySelector('#segment-length'), value => {
    const s = selectedSegment(); reshape(Math.atan2(s.tangent[1], s.tangent[0]) * 180 / Math.PI, value);
  });
  function position(event) {
    const bounds = canvas.getBoundingClientRect();
    return [clamp((event.clientX - bounds.left) / bounds.width * 28 - 14, -13, 13), clamp(9 - (event.clientY - bounds.top) / bounds.height * 18, -8, 8)];
  }
  function hitTest(p) {
    const screen = world(...p), distance = q => Math.hypot(...world(...q).map((v, i) => v - screen[i]));
    if (distance(state.p) < 12) return { target: 'p', selected: state.selected };
    const all = allSegments(), order = [state.selected, ...all.map((s, i) => i).filter(i => i !== state.selected)];
    for (const i of order) for (const target of ['a', 'b']) if (distance(all[i][target]) < 12) return { target, selected: i };
    if (state.stage === 1) {
      const s = all[state.selected];
      const q = s.a.map((v, i) => v + state.t * (s.b[i] - v));
      if (distance(q) < 12) return { target: 'q', selected: state.selected };
    }
    let hit = null, closest = 10;
    all.forEach((s, i) => {
      const t = clamp(((p[0] - s.a[0]) * s.tangent[0] + (p[1] - s.a[1]) * s.tangent[1]) / s.length, 0, 1);
      const d = distance(s.a.map((v, j) => v + t * (s.b[j] - v)));
      if (d < closest) { closest = d; hit = { target: 'segment', selected: i }; }
    });
    return hit || { target: 'p', selected: state.selected };
  }
  function translate(target, originPoints, dx, dy) {
    const edge = state.geometry.edges[state.selected];
    const indices = target === 'segment' ? edge : [edge[target === 'a' ? 0 : 1]];
    const points = indices.map(i => originPoints[i]);
    const delta = [clamp(dx, Math.max(...points.map(p => -13 - p[0])), Math.min(...points.map(p => 13 - p[0]))), clamp(dy, Math.max(...points.map(p => -8 - p[1])), Math.min(...points.map(p => 8 - p[1])))];
    moveVertices(new Map(indices.map(i => [i, originPoints[i].map((v, j) => v + delta[j])])));
  }
  function moveMap(event) {
    const p = position(event);
    if (mapDrag.target === 'p') state.p = p;
    else if (mapDrag.target === 'q') {
      const s = selectedSegment();
      state.t = clamp(((p[0] - s.a[0]) * s.tangent[0] + (p[1] - s.a[1]) * s.tangent[1]) / s.length, 0, 1);
    }
    else translate(mapDrag.target, mapDrag.points, p[0] - mapDrag.origin[0], p[1] - mapDrag.origin[1]);
    update(false, !['p', 'q'].includes(mapDrag.target));
  }
  canvas.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault(); const p = position(event), hit = hitTest(p);
    state.selected = hit.selected; state.target = hit.target;
    mapDrag = { ...hit, pointerId: event.pointerId, origin: p, points: state.geometry.points.map(point => [...point]) };
    canvas.focus({ preventScroll: true }); canvas.setPointerCapture(event.pointerId);
    if (hit.target === 'p') state.p = p;
    update(false, true);
  });
  canvas.addEventListener('pointermove', event => { if (mapDrag?.pointerId === event.pointerId) moveMap(event); });
  function finishMap(event) {
    if (mapDrag?.pointerId !== event.pointerId) return;
    if (event.type === 'pointerup') moveMap(event);
    mapDrag = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    update(true);
  }
  canvas.addEventListener('pointerup', finishMap); canvas.addEventListener('pointercancel', finishMap);
  canvas.addEventListener('lostpointercapture', () => { mapDrag = null; });
  window.addEventListener('blur', () => { mapDrag = null; });
  canvas.addEventListener('keydown', event => {
    if (event.key === 'Tab' && !event.ctrlKey && !event.altKey && !event.metaKey) {
      const targets = ['p', 'a', 'b', 'segment', ...(state.stage === 1 ? ['q'] : [])];
      const next = targets.indexOf(state.target) + (event.shiftKey ? -1 : 1);
      if (next >= 0 && next < targets.length) {
        event.preventDefault(); state.target = targets[next]; update();
      }
      return;
    }
    const changes = { ArrowLeft: [-.5, 0], ArrowRight: [.5, 0], ArrowUp: [0, .5], ArrowDown: [0, -.5] };
    if (!changes[event.key]) return;
    event.preventDefault(); const [dx, dy] = changes[event.key];
    if (state.target === 'p') state.p = [clamp(state.p[0] + dx, -13, 13), clamp(state.p[1] + dy, -8, 8)];
    else if (state.target === 'q') state.t = clamp(state.t + (dx || dy) * .05, 0, 1);
    else translate(state.target, state.geometry.points, dx, dy);
    update(true, !['p', 'q'].includes(state.target));
  });
  function resize() {
    const nextWidth = canvas.clientWidth;
    if (!nextWidth) return;
    width = nextWidth; height = width * 18 / 28;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(width * ratio), pixelHeight = Math.round(height * ratio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) { canvas.width = pixelWidth; canvas.height = pixelHeight; }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); paint();
  }
  lab.hidden = false; buildSegmentControls();
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
  else window.addEventListener('resize', resize);
  setStage(0); resize();
})();
