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

function inverseNormalCDF(p) {
  if (p <= 0) return -Infinity; if (p >= 1) return Infinity;
  const a1=-3.969683028665376e+01, a2=2.209460984245205e+02, a3=-2.759285104469687e+02;
  const a4=1.383577518672690e+02, a5=-3.066479806614716e+01, a6=2.506628277459239e+00;
  const b1=-5.447609879822406e+01, b2=1.615858368580409e+02, b3=-1.556989798598866e+02;
  const b4=6.680131188771972e+01, b5=-1.328068155288572e+01;
  const c1=-7.784894002430293e-03, c2=-3.223964580411365e-01, c3=-2.400758277161838e+00;
  const c4=-2.549732539343734e+00, c5=4.374664141464968e+00, c6=2.938163982698783e+00;
  const d1=7.784695709041462e-03, d2=3.224671290700398e-01, d3=2.445134137142996e+00, d4=3.754408661907416e+00;
  const p_low=0.02425, p_high=1-p_low;
  let q,r;
  if (p < p_low) {
    q = Math.sqrt(-2*Math.log(p));
    return (((((c1*q+c2)*q+c3)*q+c4)*q+c5)*q+c6) / ((((d1*q+d2)*q+d3)*q+d4)*q+1);
  } else if (p <= p_high) {
    q = p - 0.5; r = q*q;
    return (((((a1*r+a2)*r+a3)*r+a4)*r+a5)*r+a6)*q / (((((b1*r+b2)*r+b3)*r+b4)*r+b5)*r+1);
  } else {
    q = Math.sqrt(-2*Math.log(1-p));
    return -(((((c1*q+c2)*q+c3)*q+c4)*q+c5)*q+c6) / ((((d1*q+d2)*q+d3)*q+d4)*q+1);
  }
}

function calculateDPrime(hits, misses, falseAlarms, correctRejects) {
  const targets = hits + misses, lures = falseAlarms + correctRejects;
  if (targets === 0 || lures === 0) return 0;
  let hr = hits / targets, far = falseAlarms / lures;
  if (hr >= 1) hr = 1 - 1/(2*targets); if (hr <= 0) hr = 1/(2*targets);
  if (far >= 1) far = 1 - 1/(2*lures); if (far <= 0) far = 1/(2*lures);
  return inverseNormalCDF(hr) - inverseNormalCDF(far);
}

function formatTime(ms) {
  const m = Math.floor(ms/60000), s = Math.floor((ms%60000)/1000);
  return m + ':' + (s<10?'0':'') + s;
}
function formatKey(k) {
  if (!k) return '?';
  if (k === ' ') return 'Space';
  if (k.startsWith('Arrow')) return k.replace('Arrow','') + 'Arr';
  return k.length === 1 ? k.toUpperCase() : k;
}

// ==================== AUDIO ENGINE (Safe Fallback) ====================
