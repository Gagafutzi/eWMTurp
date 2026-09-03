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

class GameEngine {
  constructor() {
    this.reset();
    this.voices = [];
    this.selectedVoice = null;
    this.mode = 'dual';
    this.keys = {pos:'a', aud:'l', shp:'s', col:'d'};
    this.listeningBind = null;
    this.activeStimuli = [];
    this.imageCache = {};
    this.imagesLoaded = false;
    this.animeImagesLoaded = false;
    this.stimulusType = 'human_faces';
    this.animeMode = 'standard';
    this.ageVerified = (() => {
      try { return sessionStorage.getItem('age_verified') === '1'; } catch (e) { return false; }
    })();
    this.pendingAgeAction = null;
  }
  reset() {
    this.trials = []; this.kSeq = []; this.currentTrial = 0; this.blockTrials = 0;
    this.responses = {}; this.stats = {};
    this.isRunning = false; this.isPaused = false; this.isTrialActive = false;
    this.sessionStart = 0; this.sessionMs = 0; this.lastTick = 0;
    this.timerInterval = null; this.trialTimeout = null; this.trialAdvanceTimeout = null;
    this.currentN = 2; this.highestN = 2;
    this.sessionTotalTrials = 0;
    this.sessionTrialsCompleted = 0;
  }

  async preloadImages() {
    const selectedType =
      this.stimulusType === 'mix'
        ? 'mix'
        : (this.stimulusType === 'anime_faces'
          ? 'anime_faces'
          : 'human_faces');

    const selectedMode =
      ANIME_MODES.includes(this.animeMode)
        ? this.animeMode
        : 'standard';

    const key =
      selectedType + ':' + selectedMode;

    if (
      this._selectedPreloadKey === key &&
      this._selectedPreloadResult
    ) {
      return this._selectedPreloadResult;
    }

    const preload = (async () => {
      try {
        const result = await preloadAssets({
          stimulusType: selectedType,
          animeMode: selectedMode
        });

        FACES.forEach(face => {
          const image = FACE_IMAGE_CACHE[face.file];
          this.imageCache[face.file] =
            image instanceof HTMLImageElement &&
            image.complete &&
            image.naturalWidth > 0;
        });

        this.imagesLoaded = true;

        const animeLoaded = selectedType === 'mix'
          ? ANIME_MODES.reduce((total, mode) => total + getCachedAnimePaths(mode).length, 0)
          : getCachedAnimePaths(selectedMode).length;

        this.animeImagesLoaded =
          animeLoaded > 0;

        const finalResult = {
          stimulusType: selectedType,
          animeMode: selectedMode,
          animeReady:
            selectedType === 'anime_faces' || selectedType === 'mix'
              ? animeLoaded > 0
              : true,
          animeLoaded,
          requested: result.requested,
          loaded: result.loaded,
          failed: result.failed,
          ready: result.ready
        };

        console.info(
          '[ATTENTIONAL SHIELD] Selected image preload complete:',
          finalResult
        );

        return finalResult;
      } catch (error) {
        this.imagesLoaded = true;

        const animeLoaded = selectedType === 'mix'
          ? ANIME_MODES.reduce((total, mode) => total + getCachedAnimePaths(mode).length, 0)
          : getCachedAnimePaths(selectedMode).length;

        this.animeImagesLoaded =
          animeLoaded > 0;

        const fallbackResult = {
          stimulusType: selectedType,
          animeMode: selectedMode,
          animeReady:
            selectedType === 'anime_faces' || selectedType === 'mix'
              ? animeLoaded > 0
              : true,
          animeLoaded,
          requested: 0,
          loaded: [],
          failed: [],
          ready: true,
          error
        };

        console.warn(
          '[ATTENTIONAL SHIELD] Non-fatal selected image preload issue:',
          error
        );

        return fallbackResult;
      }
    })();

    this._selectedPreloadKey = key;
    this._selectedPreloadResult = preload;

    return preload;
  }

  initVoices() {
    if (typeof speechSynthesis === 'undefined') return;
    try {
      const raw = speechSynthesis.getVoices();
      if (!raw || raw.length === 0) return;
      /*
       * Best first, rather than whatever order the platform hands them over.
       *
       * The list used to be presented as-is and the default fell to the first
       * entry flagged `default` or named Google or Samantha — so on a machine
       * with neither, the opening voice was position one, which on Linux is
       * eSpeak. Ordering by likely quality makes the top of the list the right
       * answer and the default the top of the list.
       */
      this.voices = AudioEngine.rankedVoices();
      if (!this.voices.length) this.voices = raw;
      const sel = document.getElementById('sel-voice');
      if (!sel) return;
      sel.innerHTML = '';
      this.voices.forEach((v, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = v.name + ' (' + v.lang + ')';
        if (i === 0) opt.selected = true;
        sel.appendChild(opt);
      });
      if (this._savedVoiceName) {
        const savedIndex = this.voices.findIndex(v => v.name === this._savedVoiceName);
        if (savedIndex >= 0) sel.value = String(savedIndex);
      }
      this.selectedVoice = this.voices[sel.value];
      // The synthesiser reads this, not the <select>.
      AudioEngine.setVoice(this.selectedVoice);
    } catch(e) {}
  }

  getSettings() {
    const safeInt = (id, def) => { const el = document.getElementById(id); return el ? (parseInt(el.value) || def) : def; };
    const safeBool = (id) => { const el = document.getElementById(id); return el ? el.checked : false; };
    const safeVal = (id, def) => { const el = document.getElementById(id); return el ? el.value : def; };
    return {
      gridType: safeVal('sel-grid-type', '2d'),
      gridSize: safeInt('sel-grid-size', 3),
      // Kept as chosen rather than collapsed to two, so a session saved under
      // "Your Images" comes back as that and not as human faces.
      stimulusType: ['mix', 'custom', 'anime_faces'].includes(this.stimulusType)
        ? this.stimulusType
        : 'human_faces',
      animeMode: this.animeMode || 'standard',
      speed3d: safeInt('rng-3d-speed', 40),
      startN: safeInt('rng-start-n', 2),
      variableN: safeBool('chk-variable-n'),
      varMin: safeInt('rng-var-min', 1),
      varMax: safeInt('inp-var-max', 3),
      adaptive: safeBool('chk-adaptive'),
      isiMode: safeVal('sel-isi-mode', 'fixed'),
      isiFixed: safeInt('rng-isi-fixed', DEFAULT_ISI),
      isiMin: safeInt('rng-isi-min', 1300),
      isiMax: safeInt('rng-isi-max', 3000),
      stimDur: safeInt('rng-stim-dur', TRIAL_TIMING.stimulusMs),
      sessionDurationMin: safeInt('rng-session-duration', DEFAULT_SESSION_DURATION_MIN),
      tally: safeBool('chk-tally'),
      buzzerOnMiss: safeBool('chk-buzzer'),
      feedbackEnabled: safeBool('chk-feedback'),
      wordInterference: safeBool('chk-word-interference'),
      dichoticAudio: safeBool('chk-dichotic'),
      emoLoad: safeInt('rng-emo-load', 70),
      interference: safeInt('rng-interference', 40),
      matchRate: safeInt('rng-match-rate', 30) / 100,
      stimPos: safeBool('chk-pos'),
      stimAud: safeBool('chk-aud'),
      stimShp: safeBool('chk-shp'),
      stimCol: safeBool('chk-col'),
    };
  }

  setActiveStimuli() {
    const s = this.getSettings();
    this.activeStimuli = [];
    if (s.stimPos) this.activeStimuli.push('pos');
    if (s.stimAud) this.activeStimuli.push('aud');
    if (s.stimShp) this.activeStimuli.push('shp');
    if (s.stimCol) this.activeStimuli.push('col');
    if (this.activeStimuli.length === 0) {
      this.activeStimuli = ['pos'];
      const el = document.getElementById('chk-pos');
      if (el) el.checked = true;
    }
  }

  getPosCount() {
    const s = this.getSettings();
    return s.gridType === '3d' ? 27 : (s.gridSize * s.gridSize);
  }

  pickFace(emoLoad) {
    const r = Math.random() * 100;
    const neg = FACES.filter(f => f.valence < 0);
    const neu = FACES.filter(f => f.valence === 0);
    const pos = FACES.filter(f => f.valence > 0);
    if (r < emoLoad) return neg[Math.floor(Math.random() * neg.length)];
    if (r < emoLoad + (100 - emoLoad) * 0.6) return neu[Math.floor(Math.random() * neu.length)];
    return pos[Math.floor(Math.random() * pos.length)];
  }

  pickAnimeFace(mode = this.animeMode) {
    const safeMode = ANIME_MODES.includes(mode) ? mode : 'standard';
    const available = getCachedAnimePaths(safeMode);
    if (!available.length) return null;
    return available[Math.floor(Math.random() * available.length)];
  }

  pickVisualStimulus(emoLoad) {
    /*
     * The player's own pictures, when they have supplied any.
     *
     * Falls through to faces if the set is empty rather than showing blank
     * cells — an option with nothing in it should be inert, not broken.
     */
    if (this.stimulusType === 'custom') {
      const own = CustomStimuli.pick();
      if (own) return {type:'custom', path:own, emotion:'custom', animeMode:null, fallbackFromAnime:false};
      const face = this.pickFace(emoLoad);
      return {type:'standard_faces', path:face.file, emotion:face.emotion, animeMode:null, fallbackFromAnime:false};
    }

    if (this.stimulusType === 'mix') {
      const pool = [
        ...FACES.map(face => ({type:'standard_faces', path:face.file, emotion:face.emotion, animeMode:null})),
        ...ANIME_MODES.flatMap(mode => getCachedAnimePaths(mode).map(path => ({type:'anime_faces', path, emotion:'anime', animeMode:mode})))
      ];
      if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
      const face = this.pickFace(emoLoad);
      return {type:'standard_faces', path:face.file, emotion:face.emotion, animeMode:null, fallbackFromAnime:false};
    }

    if (this.stimulusType === 'anime_faces') {
      const safeMode = ANIME_MODES.includes(this.animeMode)
        ? this.animeMode
        : 'standard';
      const animePath = this.pickAnimeFace(safeMode);
      if (animePath) {
        return {type:'anime_faces', path:animePath, emotion:'anime', animeMode:safeMode, fallbackFromAnime:false};
      }

      // Anime is optional. If its files are unavailable, continue the actual
      // training session using a verified human face rather than throwing.
      console.warn('[ATTENTIONAL SHIELD] Anime ' + safeMode + ' assets unavailable; falling back to human face stimuli for this trial.');
      const face = this.pickFace(emoLoad);
      return {type:'standard_faces', path:face.file, emotion:face.emotion, animeMode:null, fallbackFromAnime:true};
    }

    const face = this.pickFace(emoLoad);
    return {type:'standard_faces', path:face.file, emotion:face.emotion, fallbackFromAnime:false, animeMode:null};
  }

  pickWord(emoLoad) {
    const r = Math.random() * 100;
    if (r < emoLoad * 0.8) return WORDS_NEGATIVE[Math.floor(Math.random() * WORDS_NEGATIVE.length)];
    if (r < emoLoad * 0.8 + (100 - emoLoad * 0.8) * 0.5) return WORDS_NEUTRAL[Math.floor(Math.random() * WORDS_NEUTRAL.length)];
    return WORDS_POSITIVE[Math.floor(Math.random() * WORDS_POSITIVE.length)];
  }

  pickAffectiveAudioWord(emoLoad) {
    // Higher emotional load favors threat/grief/visceral material while
    // retaining some positive and ambiguous high-arousal words.
    const load = Math.max(0, Math.min(100, Number(emoLoad) || 0)) / 100;
    const r = Math.random();

    let category;
    if (r < 0.28 + load * 0.24) {
      category = 'threat';
    } else if (r < 0.50 + load * 0.22) {
      category = 'grief';
    } else if (r < 0.62 + load * 0.10) {
      category = 'visceral';
    } else if (r < 0.78 + load * 0.04) {
      category = 'socialIsolation';
    } else if (r < 0.89) {
      category = 'ambiguousShock';
    } else {
      category = 'intensePositive';
    }

    const words = AFFECTIVE_WORD_BANK[category];
    return words[Math.floor(Math.random() * words.length)];
  }

  generateBlock() {
    const s = this.getSettings();
    if (this.blockTrials > 0 && this.currentTrial >= this.blockTrials) {
      this.sessionTrialsCompleted += this.currentTrial;
    }
    this.blockTrials = 24;
    this.kSeq = [];
    const minK = s.variableN ? s.varMin : this.currentN;
    const maxK = s.variableN ? Math.min(s.varMax, this.currentN) : this.currentN;

    for (let i = 0; i < this.blockTrials; i++) {
      if (!s.variableN) { this.kSeq.push(this.currentN); continue; }
      const maxAllowed = Math.min(i, maxK);
      if (maxAllowed < minK) this.kSeq.push(this.currentN);
      else this.kSeq.push(Math.floor(Math.random() * (maxAllowed - minK + 1)) + minK);
    }

    const posSeq = this.genSequence(this.getPosCount(), this.kSeq, s.matchRate, s.interference / 100);
    const colSeq = this.genSequence(COLORS.length, this.kSeq, s.matchRate, s.interference / 100);
    const audSeq = this.genSequence(AFFECTIVE_AUDIO_WORDS.length, this.kSeq, s.matchRate, s.interference / 100);
    const shpSeq = this.genSequence(SHAPES_SVG.length, this.kSeq, s.matchRate, s.interference / 100);

    this.trials = [];
    for (let i = 0; i < this.blockTrials; i++) {
      const visual = this.pickVisualStimulus(s.emoLoad);
      const word = this.pickWord(s.emoLoad);
      const audWord = AFFECTIVE_AUDIO_WORDS[audSeq[i]];

      this.trials.push({
        pos:posSeq[i], col:colSeq[i], aud:audSeq[i], shp:shpSeq[i],
        face:visual.path,
        faceEmotion:visual.emotion,
        visualType:visual.type,
        animeAsset:visual.type === 'anime_faces' ? visual.path : null,
        animeMode:visual.type === 'anime_faces' ? visual.animeMode : null,
        fallbackFromAnime:!!visual.fallbackFromAnime,
        word, audWord,
        wordInterference: s.wordInterference ? pickWordInterference() : ''
      });
    }

    this.currentTrial = 0;
    this.responses = {};
    this.activeStimuli.forEach(t => {
      this.responses[t] = Array(this.blockTrials).fill(false);
      if (!this.stats[t]) this.stats[t] = {hits:0, misses:0, falseAlarms:0, correctRejects:0};
    });
  }

  genSequence(poolSize, kArr, matchRate, interfRate) {
    const seq = [];
    for (let i = 0; i < this.blockTrials; i++) {
      const k = kArr[i];
      const targetVal = (i >= k) ? seq[i - k] : null;
      const isTarget = (i >= k) && (Math.random() < matchRate);
      if (isTarget) {
        seq.push(targetVal);
      } else {
        const forbidden = new Set();
        if (targetVal !== null) forbidden.add(targetVal);
        let picked = null;
        if (Math.random() < interfRate) {
          const lures = [];
          for (let lag = 1; lag <= 4; lag++) {
            if (i - lag >= 0) {
              const c = seq[i - lag];
              if (!forbidden.has(c)) lures.push(c);
            }
          }
          if (lures.length > 0) picked = lures[Math.floor(Math.random() * lures.length)];
        }
        if (picked === null) {
          const avoid = new Set(forbidden);
          if (interfRate < 0.5) {
            for (let lag = 1; lag <= 3; lag++) { if (i - lag >= 0) avoid.add(seq[i - lag]); }
          }
          let avail = [];
          for (let v = 0; v < poolSize; v++) { if (!avoid.has(v)) avail.push(v); }
          if (avail.length === 0) { for (let v = 0; v < poolSize; v++) { if (!forbidden.has(v)) avail.push(v); } }
          if (avail.length === 0) avail = Array.from({length: poolSize}, (_, idx) => idx);
          picked = avail[Math.floor(Math.random() * avail.length)];
        }
        seq.push(picked);
      }
    }
    return seq;
  }

  getISI() {
    const s = this.getSettings();
    const fixed = Number.isFinite(s.isiFixed) ? s.isiFixed : DEFAULT_ISI;
    if (s.isiMode === 'fixed') return Math.max(500, Math.min(5000, fixed));
    const min = Math.max(500, Math.min(5000, Number.isFinite(s.isiMin) ? s.isiMin : 1300));
    const max = Math.max(min, Math.min(5000, Number.isFinite(s.isiMax) ? s.isiMax : 3000));
    return Math.round(min + Math.random() * (max - min));
  }
}

// ==================== APP CONTROLLER ====================
