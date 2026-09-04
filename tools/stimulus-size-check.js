#!/usr/bin/env node
/**
 * The badge must fit its cell at every setting of the Stimulus Size slider.
 *
 * Two faults, one shape, both shipped: a box sized for one scale holding a
 * drawing sized for another. In the grid the drawing scaled inside a box that
 * stayed 32% tall, so anything past 100% was taller than its own container —
 * and that container is clipped, because `.grid-2d [class*="cell"]` is a
 * substring match that catches `cell-shape` too. In the strip above the grid
 * the badge scaled inside a fixed 80px row, which cut it off past about 114%.
 *
 * The numbers are read out of the files that ship, so raising the slider's
 * maximum or the badge's base height is checked rather than assumed.
 *
 * Stdlib only.  node tools/stimulus-size-check.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const failures = [];
const note = m => failures.push(m);

// --- what the slider can ask for --------------------------------------------
const html = read('index.html');
const slider = html.match(/id="rng-stim-size"[^>]*>/);
if (!slider) note('no Stimulus Size slider in index.html');
const attr = (name, src) => {
  const m = src && src.match(new RegExp(name + '="(\\d+)"'));
  return m ? Number(m[1]) : null;
};
const minPct = attr('min', slider && slider[0]);
const maxPct = attr('max', slider && slider[0]);
if (!minPct || !maxPct) note('the slider does not declare a min and a max');

// --- the in-cell badge ------------------------------------------------------
const grid = read('css/06-grid-2d.css');
const shapeBlock = grid.match(/\.cell-2d \.cell-shape \{[\s\S]*?\}/);
if (!shapeBlock) note('no .cell-2d .cell-shape rule');
const block = shapeBlock ? shapeBlock[0] : '';

const bottom = Number((block.match(/bottom:\s*([\d.]+)%/) || [])[1]);
const baseH = Number((block.match(/height:\s*calc\(([\d.]+)%\s*\*\s*var\(--shape-scale/) || [])[1]);

if (!Number.isFinite(bottom)) note('.cell-shape has no percentage `bottom`');
if (!Number.isFinite(baseH)) {
  note('.cell-shape height does not scale with --shape-scale — the drawing is '
     + 'being scaled inside a fixed box again');
}

// The substring selector that clips it, and the override that stops it.
if (/\[class\*="cell"\]/.test(grid) && !/overflow:\s*visible/.test(block)) {
  note('.cell-shape is caught by [class*="cell"] and does not override overflow, '
     + 'so an enlarged badge is clipped at its own box');
}

const svgBlock = (grid.match(/\.cell-2d \.cell-shape svg \{[\s\S]*?\}/) || [''])[0];
if (/height:\s*calc\([^)]*--shape-scale/.test(svgBlock)) {
  note('the drawing scales as well as its box — that is the original fault');
}

// --- geometry across the whole slider range ---------------------------------
if (Number.isFinite(bottom) && Number.isFinite(baseH) && minPct && maxPct) {
  for (const pct of [minPct, 100, maxPct]) {
    const top = bottom + baseH * (pct / 100);
    if (top > 100) {
      note(`at ${pct}% the badge reaches ${top.toFixed(1)}% of the cell and is clipped`);
    }
  }
  const top = bottom + baseH * (maxPct / 100);
  console.log(`in-cell badge: ${bottom}% to ${top.toFixed(1)}% of the cell at the `
    + `slider maximum (${maxPct}%)`);
}

// --- the fallback strip above the grid --------------------------------------
const base = read('css/01-base.css');
const strip = (base.match(/\.top-stimulus \{[^}]*\}/) || [''])[0];
const badge = (base.match(/\.shape-display \{[^}]*\}/) || [''])[0];
const badgePx = Number((badge.match(/width:\s*calc\((\d+)px\s*\*\s*var\(--shape-scale/) || [])[1]);
const fixedStrip = Number((strip.match(/(?:^|[^-])height:\s*(\d+)px/) || [])[1]);
const minStrip = Number((strip.match(/min-height:\s*(\d+)px/) || [])[1]);

if (Number.isFinite(fixedStrip) && Number.isFinite(badgePx) && maxPct) {
  const need = badgePx * (maxPct / 100);
  if (need > fixedStrip) {
    note(`the strip is a fixed ${fixedStrip}px but the badge needs ${need}px at `
       + `${maxPct}% — it is cut off`);
  }
} else if (Number.isFinite(minStrip)) {
  console.log(`strip: floor ${minStrip}px, grows to hold a `
    + `${badgePx * (maxPct / 100)}px badge at the slider maximum`);
} else {
  note('.top-stimulus declares neither a fixed height nor a min-height');
}

// A badge hidden with `visibility` still occupies its box, so a large one would
// cost that space on every trial where the picture is in a cell instead.
const app = read('js/08-app.js');
if (/shapeDisp\.style\.visibility/.test(app)) {
  note('the strip badge is hidden with `visibility`, which keeps its space — at a '
     + 'large size that pushes the grid down on every trial that does not use it');
}

if (failures.length) {
  for (const f of failures) console.log('FAIL: ' + f);
  process.exit(1);
}
console.log('PASS: the badge fits at every slider setting');
