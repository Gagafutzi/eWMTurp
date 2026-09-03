'use strict';

/*
 * Split out of index.html, which was 5,800 lines in one file.
 *
 * The program was wrapped in a single IIFE, so every declaration was
 * function-scoped and invisible outside it. Splitting across <script> tags
 * therefore meant unwrapping it: these are plain scripts in the original
 * order, sharing global scope the way the IIFE's interior shared its own, and
 * `'use strict'` is restated per file because the wrapper that carried it for
 * everybody is gone.
 *
 * Not ES modules, deliberately: these names are reached for directly by the
 * other files, so imports would have meant rewriting all of that at the same
 * time as moving it — two changes at once, in a file there is no test to catch
 * either of them with.
 *
 * Boundaries were not chosen by eye. Each was checked to leave both halves
 * parsing on their own, which is how the theme controller turned out to be a
 * second IIFE *after* the main one rather than part of it.
 */

// Defensive DOM helpers: missing optional controls must never crash startup.
const $ = (id) => document.getElementById(id);
const setText = (id, value) => { const el = $(id); if (el) el.textContent = value; };
const getValue = (id, fallback = '') => { const el = $(id); return el ? el.value : fallback; };
const getChecked = (id, fallback = false) => { const el = $(id); return el ? !!el.checked : fallback; };

const STORAGE_KEY = 'attentional_shield_v2';
const SETTINGS_STORAGE_KEY = STORAGE_KEY + '_settings_v3';

// ==================== SESSION / TRIAL DEFAULTS ====================
const DEFAULT_ISI = 1800;
const DEFAULT_SESSION_DURATION_MIN = 10;

// Stimulus presentation is intentionally unchanged.
// ISI is the blank/response interval after the stimulus.
const TRIAL_TIMING = Object.freeze({ stimulusMs:700 });
