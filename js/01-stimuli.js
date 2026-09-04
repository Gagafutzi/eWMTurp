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

/*
 * The visual sets, and the one place that decides what counts as one.
 *
 * There were four separate three-way normalisers -- the card click handler,
 * `setStimulusType`, `startSession`, and the preloader -- each written when
 * there were three sets and each silently collapsing anything else to faces.
 * Adding "custom" therefore had to be remembered in four places and was
 * remembered in one, so the mode was unreachable from the card and, once
 * reached, was thrown away again at the moment a session began.
 *
 * A list and a function, so the next set is one edit.
 */
const STIMULUS_TYPES = Object.freeze(['human_faces', 'anime_faces', 'mix', 'custom']);

function normalizeStimulusType(type) {
  // The old alias, kept because saved settings may still carry it.
  if (type === 'anime_standard') return 'anime_faces';
  return STIMULUS_TYPES.includes(type) ? type : 'human_faces';
}

const FACES = Object.freeze([
  {file:'assets/stimuli/human_faces/face_0.jpg', emotion:'neutral', valence:0},
  {file:'assets/stimuli/human_faces/face_1.jpg', emotion:'positive', valence:1},
  {file:'assets/stimuli/human_faces/face_2.jpg', emotion:'positive', valence:2},
  {file:'assets/stimuli/human_faces/face_3.jpg', emotion:'negative', valence:-2},
  {file:'assets/stimuli/human_faces/face_4.jpg', emotion:'negative', valence:-2},
  {file:'assets/stimuli/human_faces/face_5.jpg', emotion:'negative', valence:-1},
  {file:'assets/stimuli/human_faces/face_6.jpg', emotion:'surprise', valence:0},
  {file:'assets/stimuli/human_faces/face_7.jpg', emotion:'negative', valence:-2},
  {file:'assets/stimuli/human_faces/face_8.jpg', emotion:'neutral', valence:0},
  {file:'assets/stimuli/human_faces/face_9.jpg', emotion:'negative', valence:-1}
]);

// ==================== VISUAL ASSET PIPELINE ====================
// Standard Anime&More uses the exact WebP files committed under
// assets/stimuli/anime/. No manifest.json or filename transformation is required.
// The repository contains the Standard Anime WebP files directly in:
//   assets/stimuli/anime/
//
// This manifest is intentionally embedded in index.html so GitHub Pages
// never depends on a runtime manifest.json or directory listing.
/*
 * Configurable Hentai asset count.
 * Files are expected to be h1.jpg ... hN.jpg.
 */
const HENTAI_COUNT = 30;

const ANIME_FACE_ASSET_MANIFEST = Object.freeze({
  standard: Object.freeze([
    'assets/stimuli/anime/a.webp', 'assets/stimuli/anime/b.webp', 'assets/stimuli/anime/c.webp',
    'assets/stimuli/anime/d.webp', 'assets/stimuli/anime/e.webp', 'assets/stimuli/anime/f.webp',
    'assets/stimuli/anime/g.webp', 'assets/stimuli/anime/h.webp', 'assets/stimuli/anime/i.webp',
    'assets/stimuli/anime/j.webp', 'assets/stimuli/anime/k.webp', 'assets/stimuli/anime/l.webp'
  ]),
  waifu: Object.freeze([
    'assets/stimuli/waifu/waifu_0.webp',
    'assets/stimuli/waifu/waifu_1.webp',
    'assets/stimuli/waifu/waifu_2.webp',
    'assets/stimuli/waifu/waifu_3.webp',
    'assets/stimuli/waifu/waifu_4.webp',
    'assets/stimuli/waifu/waifu_5.webp',
    'assets/stimuli/waifu/waifu_7.webp',
    'assets/stimuli/waifu/waifu_8.webp',
    'assets/stimuli/waifu/waifu_9.webp',
    'assets/stimuli/waifu/waifu_10.webp',
    'assets/stimuli/waifu/waifu_11.webp',
    'assets/stimuli/waifu/waifu_12.webp',
    'assets/stimuli/waifu/waifu_13.webp',
    'assets/stimuli/waifu/waifu_14.webp',
    'assets/stimuli/waifu/waifu_15.webp',
    'assets/stimuli/waifu/waifu_16.webp',
    'assets/stimuli/waifu/waifu_17.webp',
    'assets/stimuli/waifu/waifu_18.webp',
    'assets/stimuli/waifu/waifu_19.webp',
    'assets/stimuli/waifu/waifu_20.webp',
    'assets/stimuli/waifu/waifu_21.webp',
    'assets/stimuli/waifu/waifu_22.webp',
    'assets/stimuli/waifu/waifu_23.webp',
    'assets/stimuli/waifu/waifu_24.webp',
    'assets/stimuli/waifu/waifu_25.webp',
    'assets/stimuli/waifu/waifu_26.webp',
    'assets/stimuli/waifu/waifu_27.webp',
    'assets/stimuli/waifu/waifu_28.webp',
    'assets/stimuli/waifu/waifu_29.webp',
    'assets/stimuli/waifu/waifu_30.webp',
    'assets/stimuli/waifu/waifu_31.webp',
    'assets/stimuli/waifu/waifu_32.webp',
    'assets/stimuli/waifu/waifu_33.webp',
    'assets/stimuli/waifu/waifu_34.webp',
    'assets/stimuli/waifu/waifu_35.webp',
    'assets/stimuli/waifu/waifu_36.webp',
    'assets/stimuli/waifu/waifu_37.webp',
    'assets/stimuli/waifu/waifu_38.webp',
    'assets/stimuli/waifu/waifu_39.webp',
    'assets/stimuli/waifu/waifu_40.webp',
    'assets/stimuli/waifu/waifu_41.webp',
    'assets/stimuli/waifu/waifu_42.webp',
    'assets/stimuli/waifu/waifu_43.webp',
    'assets/stimuli/waifu/waifu_44.webp',
    'assets/stimuli/waifu/waifu_45.webp',
    'assets/stimuli/waifu/waifu_46.webp',
    'assets/stimuli/waifu/waifu_47.webp',
    'assets/stimuli/waifu/waifu_48.webp',
    'assets/stimuli/waifu/waifu_49.webp',
    'assets/stimuli/waifu/waifu_50.webp',
    'assets/stimuli/waifu/waifu_51.webp',
    'assets/stimuli/waifu/waifu_52.webp',
    'assets/stimuli/waifu/waifu_53.webp',
    'assets/stimuli/waifu/waifu_54.webp',
    'assets/stimuli/waifu/waifu_55.webp',
    'assets/stimuli/waifu/waifu_56.webp'
  ]),
  hentai: Object.freeze(
    Array.from(
      { length: HENTAI_COUNT },
      (_, index) => `assets/stimuli/hentai/h${index + 1}.jpg`
    )
  ),
  gore: Object.freeze([])
});

const ANIME_MODES = Object.freeze(['standard','waifu','hentai','gore','porn']);
const GORE_ASSET_PATHS = [];
const GORE_MAX_DISCOVERY_INDEX = 5000;
const PORN_ASSET_PATHS = [];
const PORN_MAX_DISCOVERY_INDEX = 5000;

const FACE_IMAGE_CACHE = Object.create(null);
const ANIME_IMAGE_CACHE = Object.create(null);

ANIME_MODES.forEach(mode => {
  ANIME_IMAGE_CACHE[mode] = Object.create(null);
});

function preloadImage(path, targetCache) {
  return new Promise(resolve => {
    if (!path || !targetCache) {
      resolve(false);
      return;
    }

    const existing = targetCache[path];

    if (
      existing instanceof HTMLImageElement &&
      existing.complete &&
      existing.naturalWidth > 0 &&
      existing.naturalHeight > 0
    ) {
      resolve(true);
      return;
    }

    delete targetCache[path];

    const img = new Image();
    img.decoding = 'async';
    img.loading = 'eager';

    let settled = false;

    const fail = reason => {
      if (settled) return;
      settled = true;
      delete targetCache[path];

      console.error(
        '[ATTENTIONAL SHIELD] Failed to load image:',
        path,
        reason || ''
      );

      resolve(false);
    };

    img.onerror = () => fail('load error');

    img.onload = async () => {
      if (
        img.naturalWidth <= 0 ||
        img.naturalHeight <= 0
      ) {
        fail('zero natural dimensions');
        return;
      }

      if (typeof img.decode === 'function') {
        try {
          await img.decode();
        } catch (error) {
          fail(error);
          return;
        }
      }

      if (
        img.naturalWidth <= 0 ||
        img.naturalHeight <= 0
      ) {
        fail('zero dimensions after decode');
        return;
      }

      if (settled) return;

      settled = true;
      targetCache[path] = img;
      resolve(true);
    };

    img.src = path;
  });
}

function getCachedAnimePaths(mode = 'standard') {
  const safeMode =
    ANIME_MODES.includes(mode)
      ? mode
      : 'standard';

  const cache =
    ANIME_IMAGE_CACHE[safeMode] || Object.create(null);

  const paths = safeMode === 'gore'
    ? GORE_ASSET_PATHS
    : safeMode === 'porn'
      ? PORN_ASSET_PATHS
      : (ANIME_FACE_ASSET_MANIFEST[safeMode] || []);

  return paths.filter(path => {
    const img = cache[path];

    return (
      img instanceof HTMLImageElement &&
      img.complete &&
      img.naturalWidth > 0 &&
      img.naturalHeight > 0
    );
  });
}

// ==================== SELECTED ASSET PRELOADER ====================
// Preload the visual family selected for the upcoming session. The same
// verified HTMLImageElement instances are consumed by the 2D renderer and
// Three.js, so the game never starts by racing the first stimulus against a
// network request. Individual failures remain non-fatal.
async function preloadAssets(options = {}) {
  /*
   * "custom" deliberately preloads the face set and not the player's pictures.
   * Those are data URLs already held in memory -- there is no network fetch to
   * warm -- and the faces are what the engine falls back to when the custom set
   * is empty, so they are the ones worth having ready.
   */
  const stimulusType = options.stimulusType === 'mix'
    ? 'mix'
    : (options.stimulusType === 'anime_faces' ? 'anime_faces' : 'human_faces');
  const animeMode = ANIME_MODES.includes(options.animeMode) ? options.animeMode : 'standard';
  let paths;

  if (stimulusType === 'mix') {
    const modes = ANIME_MODES.filter(mode => mode !== 'gore' && mode !== 'porn');
    const discovered = [];
    // Discover the optional sequential families first so Mix Mode can include them.
    for (const mode of ['gore','porn']) {
      const target = mode === 'gore' ? GORE_ASSET_PATHS : PORN_ASSET_PATHS;
      target.length = 0;
      const cache = ANIME_IMAGE_CACHE[mode] || (ANIME_IMAGE_CACHE[mode] = Object.create(null));
      const prefix = mode === 'gore' ? 'assets/stimuli/gore/gore_' : 'assets/stimuli/porn/p';
      for (let index = 1; index <= (mode === 'gore' ? GORE_MAX_DISCOVERY_INDEX : PORN_MAX_DISCOVERY_INDEX); index++) {
        const candidates = mode === 'gore'
          ? [prefix + index + '.webp', prefix + index + '.jpg', prefix + index + '.jpeg']
          : [prefix + index + '.jpg', prefix + index + '.webp'];
        const results = await Promise.all(candidates.map(path => preloadImage(path, cache)));
        const found = candidates.find((path, i) => results[i]);
        if (!found) break;
        target.push(found);
      }
    }
    paths = [
      ...FACES.map(face => ({ type:'human_faces', path:face.file, mode:null })),
      ...ANIME_MODES.flatMap(mode => {
        const modePaths = mode === 'gore' ? GORE_ASSET_PATHS : mode === 'porn' ? PORN_ASSET_PATHS : (ANIME_FACE_ASSET_MANIFEST[mode] || []);
        return modePaths.map(path => ({ type:'anime_faces', path, mode }));
      })
    ];
    const loadResults = await Promise.all(paths.map(item => preloadImage(item.path, item.type === 'human_faces' ? FACE_IMAGE_CACHE : ANIME_IMAGE_CACHE[item.mode])));
    return { stimulusType:'mix', animeMode:'mix', requested:paths.length, loaded:paths.filter((_,i) => loadResults[i]).map(item => item.path), failed:paths.filter((_,i) => !loadResults[i]).map(item => item.path), ready:loadResults.some(Boolean) || paths.length === 0 };
  }

  if (stimulusType === 'anime_faces' && animeMode === 'gore') {
    // GitHub Pages cannot enumerate a directory, so discover contiguous
    // gore_1, gore_2, ... files by trying the supported extensions.
    // Discovery stops at the first missing index, matching the user's
    // sequential naming convention without requiring a hard-coded count.
    GORE_ASSET_PATHS.length = 0;
    const goreCache = ANIME_IMAGE_CACHE.gore || (ANIME_IMAGE_CACHE.gore = Object.create(null));

    for (let index = 1; index <= GORE_MAX_DISCOVERY_INDEX; index++) {
      const candidates = [
        `assets/stimuli/gore/gore_${index}.webp`,
        `assets/stimuli/gore/gore_${index}.jpg`,
        `assets/stimuli/gore/gore_${index}.jpeg`
      ];

      const results = await Promise.all(
        candidates.map(path => preloadImage(path, goreCache))
      );
      const found = candidates.find((path, i) => results[i]);

      if (!found) break;
      GORE_ASSET_PATHS.push(found);
    }

    paths = GORE_ASSET_PATHS.slice();
  } else if (stimulusType === 'anime_faces' && animeMode === 'porn') {
    // GitHub Pages cannot enumerate a directory, so discover p1.webp, p2.webp, ... sequentially.
    PORN_ASSET_PATHS.length = 0;
    const pornCache = ANIME_IMAGE_CACHE.porn || (ANIME_IMAGE_CACHE.porn = Object.create(null));

    for (let index = 1; index <= PORN_MAX_DISCOVERY_INDEX; index++) {
      const jpgPath = `assets/stimuli/porn/p${index}.jpg`;
      const webpPath = `assets/stimuli/porn/p${index}.webp`;

      const foundJpg = await preloadImage(jpgPath, pornCache);

      if (foundJpg) {
        PORN_ASSET_PATHS.push(jpgPath);
        continue;
      }

      const foundWebp = await preloadImage(webpPath, pornCache);

      if (foundWebp) {
        PORN_ASSET_PATHS.push(webpPath);
        continue;
      }

      break;
    }

    paths = PORN_ASSET_PATHS.slice();
  } else {
    paths = stimulusType === 'anime_faces'
      ? (ANIME_FACE_ASSET_MANIFEST[animeMode] || [])
      : FACES.map(face => face.file);
  }

  const cache = stimulusType === 'anime_faces'
    ? (ANIME_IMAGE_CACHE[animeMode] || (ANIME_IMAGE_CACHE[animeMode] = Object.create(null)))
    : FACE_IMAGE_CACHE;

  const settled = stimulusType === 'anime_faces' && animeMode === 'gore'
    ? paths.map(path => ({ status: 'fulfilled', value: true }))
    : await Promise.allSettled(
        paths.map(path => preloadImage(path, cache))
      );

  const results = settled.map((entry, index) => {
    const path = paths[index];

    if (entry.status === 'fulfilled') {
      return { path, ok: !!entry.value };
    }

    console.warn(
      '[ATTENTIONAL SHIELD] Non-fatal anime asset rejection:',
      path,
      entry.reason
    );

    return { path, ok: false };
  });

  return {
    stimulusType,
    animeMode,
    requested: paths.length,
    loaded: results.filter(r => r.ok).map(r => r.path),
    failed: results.filter(r => !r.ok).map(r => r.path),
    ready: results.some(r => r.ok) || paths.length === 0
  };
}

function getPreloadedImage(path, stimulusType = 'human_faces', animeMode = 'standard') {
  if (!path) return null;
  if (stimulusType === 'anime_faces') {
    const mode = ANIME_MODES.includes(animeMode) ? animeMode : 'standard';
    const image = ANIME_IMAGE_CACHE[mode]?.[path];
    return image instanceof HTMLImageElement && image.naturalWidth > 0 ? image : null;
  }
  const image = FACE_IMAGE_CACHE[path];
  return image instanceof HTMLImageElement && image.naturalWidth > 0 ? image : null;
}


const FACE_PRELOAD_PROMISE = Promise.all(
  FACES.map(face =>
    preloadImage(
      face.file,
      FACE_IMAGE_CACHE
    )
  )
);

/*
 * Single unified Anime preload gate.
 * It resolves even if an individual image fails, so optional Anime
 * stimuli can never freeze session initialization.
 */
const ANIME_PRELOAD_READY = Promise.all(
  ANIME_MODES.map(async mode => {
    const paths =
      ANIME_FACE_ASSET_MANIFEST[mode] || [];

    if (!ANIME_IMAGE_CACHE[mode]) {
      ANIME_IMAGE_CACHE[mode] =
        Object.create(null);
    }

    const results = await Promise.all(
      paths.map(path =>
        preloadImage(
          path,
          ANIME_IMAGE_CACHE[mode]
        )
      )
    );

    return {
      mode,
      loaded: results.filter(Boolean).length
    };
  })
).catch(error => {
  console.error(
    '[ATTENTIONAL SHIELD] Anime preload pipeline failed:',
    error
  );

  ANIME_MODES.forEach(mode => {
    if (!ANIME_IMAGE_CACHE[mode]) {
      ANIME_IMAGE_CACHE[mode] =
        Object.create(null);
    }
  });

  return [];
});

const ANIME_FACE_PRELOAD_PROMISES =
  Object.fromEntries(
    ANIME_MODES.map(mode => [
      mode,
      ANIME_PRELOAD_READY.then(() =>
        getCachedAnimePaths(mode)
      )
    ])
  );

function createPreloadedFaceImage(path, altText, cache) {
  const cached = cache?.[path] || FACE_IMAGE_CACHE[path] || null;
  const img = cached instanceof HTMLImageElement ? cached.cloneNode(false) : new Image();
  img.src = path;
  img.alt = altText || '';
  img.decoding = 'async';
  img.loading = 'eager';
  img.draggable = false;
  img.className = 'stimulus-image';
  img.style.width = '100%';
  img.style.height = '100%';
  img.style.display = 'block';
  img.style.objectFit = 'cover';
  img.style.maxWidth = '100%';
  img.style.maxHeight = '100%';
  img.style.pointerEvents = 'none';
  img.style.imageRendering = 'pixelated';
  return img;
}

// Expanded High-Arousal Affective Word Bank for eWMT Engine
// Used specifically for the spoken affective-word stimulus.

/* ------------------------------------------------------------------ *
 * Your own pictures                                                   *
 * ------------------------------------------------------------------ */

/*
 * A stimulus set the player supplies, kept in IndexedDB.
 *
 * **Not localStorage.** Images as data URLs run to hundreds of kilobytes each
 * and localStorage caps out around five megabytes for the whole origin — which
 * this page shares with everything else served from it, so a dozen pictures
 * would evict somebody's training history to make room. IndexedDB has no such
 * ceiling and is the right place for blobs.
 *
 * Stored as data URLs rather than as object URLs, because an object URL dies
 * with the page that made it: a set chosen today would be a list of broken
 * links tomorrow, which is the one thing a *saved* set must not be.
 */
const CustomStimuli = {
  DB: 'ewmturp',
  STORE: 'custom-images',
  KEY: 'images',

  /** In memory for the session; the database is the durable copy. */
  images: [],

  _open() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') { reject(new Error('no indexedDB')); return; }
      const req = indexedDB.open(this.DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this.STORE)) db.createObjectStore(this.STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async load() {
    try {
      const db = await this._open();
      const list = await new Promise((resolve, reject) => {
        const req = db.transaction(this.STORE, 'readonly').objectStore(this.STORE).get(this.KEY);
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
      this.images = Array.isArray(list) ? list : [];
    } catch (e) {
      // No database is not an error worth stopping for: the option simply has
      // nothing in it, and every other stimulus set still works.
      this.images = [];
    }
    return this.images;
  },

  async save(list) {
    this.images = list;
    try {
      const db = await this._open();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(this.STORE, 'readwrite');
        tx.objectStore(this.STORE).put(list, this.KEY);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      return true;
    } catch (e) {
      console.warn('[CustomStimuli] Could not save:', e);
      return false;
    }
  },

  /**
   * Read files the player picked, downscaled.
   *
   * A phone photo is four thousand pixels wide and is about to be drawn into a
   * grid cell a couple of hundred across, so storing it whole would cost
   * megabytes per image to display none of them. Longest edge capped at 640,
   * re-encoded as JPEG — which is also what keeps a large set inside a
   * reasonable database.
   */
  async fromFiles(fileList, max = 640) {
    const out = [];
    for (const file of Array.from(fileList || [])) {
      if (!/^image\//.test(file.type)) continue;
      try {
        out.push(await this._downscale(file, max));
      } catch (e) {
        console.warn('[CustomStimuli] Skipped a file that could not be read:', file.name, e);
      }
    }
    return out;
  },

  _downscale(file, max) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('decode failed'));
        img.onload = () => {
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  },

  pick() {
    if (!this.images.length) return null;
    return this.images[Math.floor(Math.random() * this.images.length)];
  }
};
