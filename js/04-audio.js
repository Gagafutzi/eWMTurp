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

const AudioEngine = {
  _speechRequestId: 0,
  ctx: null,
  bufferCache: new Map(),
  activeSources: new Set(),
  nextDichoticPan: -1,
  dichoticEnabled: false,

  audioManifest: Object.freeze({
    "APOCALYPSE": "assets/stimuli/audio/apocalypse.mp3",
    "DANGER":     "assets/stimuli/audio/danger.mp3",
    "FEAR":       "assets/stimuli/audio/fear.mp3",
    "LOSS":       "assets/stimuli/audio/loss.mp3",
    "PANIC":      "assets/stimuli/audio/panic.mp3",
    "THREAT":     "assets/stimuli/audio/threat.mp3"
  }),

  /*
   * Optional aliases can be populated at runtime without changing
   * the original manifest. This allows trial vocabulary to grow
   * without making the audio system brittle.
   */
  manifestAliases: Object.create(null),

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }

    try {
      const AudioContextClass =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioContextClass) {
        console.error('[AudioEngine] Web Audio API unavailable.');
        return null;
      }

      this.ctx = new AudioContextClass();

      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }

      return this.ctx;
    } catch (error) {
      console.error('[AudioEngine] AudioContext initialization failed:', error);
      this.ctx = null;
      return null;
    }
  },

  ensureContext() {
    const ctx = this.init();

    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    return ctx;
  },

  setDichotic(enabled) {
    this.dichoticEnabled = !!enabled;
    this.resetDichoticSequence();

    if (!this.dichoticEnabled) {
      this.stopAll();
    }

    return this.dichoticEnabled;
  },

  resetDichoticSequence() {
    this.nextDichoticPan = -1;
  },

  getNextDichoticPan() {
    const pan = this.nextDichoticPan;
    this.nextDichoticPan = pan === -1 ? 1 : -1;
    return pan;
  },

  /*
   * Normalize trial vocabulary safely:
   *   "OBSESSION" -> "OBSESSION"
   *   "obsession" -> "OBSESSION"
   *   "Obsession" -> "OBSESSION"
   *   " obsession " -> "OBSESSION"
   */
  normalizeWord(word) {
    if (word === null || word === undefined) {
      return '';
    }

    return String(word)
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase();
  },

  /*
   * Resolve an audio URL without assuming that the manifest's
   * property casing matches the trial word casing.
   *
   * Resolution order:
   * 1. Exact manifest key
   * 2. Case-insensitive manifest key
   * 3. Runtime alias
   * 4. Conventional generated filename
   */
  /*
   * The voice the player picked, if they picked one.
   *
   * `speak()` used to call `getVoices()` itself and take the first English
   * entry it found, which meant the voice selector on the settings screen
   * changed nothing at all in normal (non-dichotic) play. On most Linux
   * installs that first entry is eSpeak, which is where "robotic" comes from —
   * the good voices are further down the list, and the player had already
   * chosen one.
   */
  preferredVoice: null,

  setVoice(voice) {
    this.preferredVoice = voice || null;
  },

  /**
   * How good a voice is likely to sound, without hearing it.
   *
   * Browsers expose no quality field, but they do expose `localService`, and it
   * is a strong proxy: the network voices are the neural ones. Beyond that the
   * names are the evidence — "Natural" and "Neural" say so outright, Google and
   * the Apple voices are known-good, and eSpeak is the formant synthesiser that
   * everything else here is trying not to sound like.
   *
   * Only ever used to *order* the list and to pick an opening default. The
   * player's choice always wins.
   */
  voiceScore(voice) {
    if (!voice) return -Infinity;
    const name = (voice.name || '').toLowerCase();
    let score = 0;

    /*
     * `+male1` and `+female2` are eSpeak's variant syntax, and on most Linux
     * installs the voice is named "English (America)+male1" rather than
     * anything containing "espeak" — so the obvious pattern misses the one
     * voice this is most trying to avoid.
     */
    if (/espeak|mbrola|festival|pico|robosoft|flite/.test(name)) score -= 100;
    if (/\+(male|female)\d?/.test(name)) score -= 100;
    if (/natural|neural|premium|enhanced|wavenet|studio/.test(name)) score += 40;
    if (/google/.test(name)) score += 30;
    if (/samantha|siri|ava|allison|serena|daniel|karen|moira/.test(name)) score += 25;
    if (/microsoft/.test(name) && /online/.test(name)) score += 30;
    if (voice.localService === false) score += 20;
    if ((voice.lang || '').toLowerCase().startsWith('en')) score += 10;
    if (voice.default) score += 2;

    return score;
  },

  /** Every usable voice, best first. */
  rankedVoices() {
    if (typeof speechSynthesis === 'undefined') return [];
    let all = [];
    try { all = speechSynthesis.getVoices() || []; } catch (e) { return []; }
    const english = all.filter(v => v.lang && v.lang.toLowerCase().startsWith('en'));
    return (english.length ? english : all)
      .slice()
      .sort((a, b) => this.voiceScore(b) - this.voiceScore(a));
  },

  getAudioUrl(word) {
    const normalized = this.normalizeWord(word);

    if (!normalized) {
      return null;
    }

    // Exact key.
    if (this.audioManifest[normalized]) {
      return this.audioManifest[normalized];
    }

    // Case-insensitive manifest scan.
    const manifestKeys = Object.keys(this.audioManifest);

    const matchingKey = manifestKeys.find(
      key => this.normalizeWord(key) === normalized
    );

    if (matchingKey && this.audioManifest[matchingKey]) {
      return this.audioManifest[matchingKey];
    }

    // Runtime aliases.
    const aliasKeys = Object.keys(this.manifestAliases);

    const matchingAlias = aliasKeys.find(
      key => this.normalizeWord(key) === normalized
    );

    if (matchingAlias && this.manifestAliases[matchingAlias]) {
      return this.manifestAliases[matchingAlias];
    }

    /*
     * Auto-generated conventional path.
     *
     * Example:
     *   OBSESSION -> assets/stimuli/audio/obsession.mp3
     *
     * The actual fetch/decode result is still validated. A missing
     * generated asset therefore cannot crash the session.
     */
    const safeFilename = normalized
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '');

    if (!safeFilename) {
      return null;
    }

    return `assets/stimuli/audio/${safeFilename}.mp3`;
  },

  /*
   * Allows dynamically generated trial vocabularies to register
   * their conventional MP3 path explicitly when desired.
   */
  registerAudioWord(word, url = null) {
    const normalized = this.normalizeWord(word);

    if (!normalized) {
      return null;
    }

    const resolvedUrl =
      url ||
      `assets/stimuli/audio/${
        normalized
          .toLowerCase()
          .replace(/[^a-z0-9_-]+/g, '_')
          .replace(/^_+|_+$/g, '')
      }.mp3`;

    this.manifestAliases[normalized] = resolvedUrl;

    return resolvedUrl;
  },

  createStereoRoute(pan) {
    const ctx = this.ensureContext();

    if (!ctx) {
      return null;
    }

    const hardPan =
      pan <= -1 ? -1 :
      pan >= 1 ? 1 : 0;

    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();

      panner.pan.setValueAtTime(
        hardPan,
        ctx.currentTime
      );

      return {
        input: panner,
        output: panner,

        disconnect() {
          try { panner.disconnect(); } catch (e) {}
        }
      };
    }

    const splitter = ctx.createChannelSplitter(2);
    const merger = ctx.createChannelMerger(2);
    const leftGain = ctx.createGain();
    const rightGain = ctx.createGain();

    if (hardPan === -1) {
      leftGain.gain.value = 1;
      rightGain.gain.value = 0;
    } else if (hardPan === 1) {
      leftGain.gain.value = 0;
      rightGain.gain.value = 1;
    } else {
      leftGain.gain.value = 1;
      rightGain.gain.value = 1;
    }

    splitter.connect(leftGain, 0);
    splitter.connect(rightGain, 1);
    leftGain.connect(merger, 0, 0);
    rightGain.connect(merger, 0, 1);

    return {
      input: splitter,
      output: merger,

      disconnect() {
        try { splitter.disconnect(); } catch (e) {}
        try { leftGain.disconnect(); } catch (e) {}
        try { rightGain.disconnect(); } catch (e) {}
        try { merger.disconnect(); } catch (e) {}
      }
    };
  },

  async loadAudioBuffer(url) {
    const ctx = this.ensureContext();

    if (!ctx || !url) {
      return null;
    }

    if (this.bufferCache.has(url)) {
      return this.bufferCache.get(url);
    }

    try {
      const response = await fetch(
        url,
        { cache: 'force-cache' }
      );

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status} while loading ${url}`
        );
      }

      const arrayBuffer =
        await response.arrayBuffer();

      const audioBuffer =
        await ctx.decodeAudioData(arrayBuffer);

      this.bufferCache.set(
        url,
        audioBuffer
      );

      return audioBuffer;
    } catch (error) {
      /*
       * IMPORTANT:
       * Missing individual MP3s are now a recoverable condition.
       * We return null to allow speak() to use its safe synthetic
       * dichotic fallback rather than breaking the session.
       */
      console.warn(
        '[AudioEngine] MP3 unavailable:',
        url,
        error
      );

      return null;
    }
  },

  playBuffer(audioBuffer, pan, options = {}) {
    const ctx = this.ensureContext();

    if (!ctx || !audioBuffer) {
      return null;
    }

    const volume = Number.isFinite(options.volume)
      ? Math.max(0, Math.min(1, options.volume))
      : 1;

    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    const route = this.createStereoRoute(pan);

    if (!route) {
      return null;
    }

    source.buffer = audioBuffer;

    const now = ctx.currentTime;
    const safeVolume = Math.min(volume, 0.72);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(safeVolume, now + 0.008);

    source.connect(gain);
    gain.connect(route.input);
    route.output.connect(ctx.destination);

    const record = {
      source,
      gain,
      route
    };

    this.activeSources.add(record);

    source.onended = () => {
      try { source.disconnect(); } catch (e) {}
      try { gain.disconnect(); } catch (e) {}
      try { route.disconnect(); } catch (e) {}

      this.activeSources.delete(record);
    };

    try {
      source.start(ctx.currentTime);
    } catch (error) {
      console.error(
        '[AudioEngine] AudioBuffer playback failed:',
        error
      );

      try { source.disconnect(); } catch (e) {}
      try { gain.disconnect(); } catch (e) {}
      try { route.disconnect(); } catch (e) {}

      this.activeSources.delete(record);

      return null;
    }

    return record;
  },

  /*
   * Safe synthetic fallback for a missing MP3.
   *
   * This is intentionally ONLY used when a dichotic MP3 is missing.
   * It prevents a missing asset from making the auditory modality
   * silent or breaking the trial sequence.
   *
   * The fallback itself is still routed through the same hard
   * left/right StereoPannerNode architecture.
   */
  playDichoticFallback(word, pan) {
    const ctx = this.ensureContext();

    if (!ctx) {
      return null;
    }

    const route = this.createStereoRoute(pan);

    if (!route) {
      return null;
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    /*
     * Deterministic frequency from the word so different missing
     * vocabulary items do not all sound identical.
     */
    const normalized = this.normalizeWord(word);

    let hash = 0;

    for (let i = 0; i < normalized.length; i++) {
      hash =
        ((hash << 5) - hash + normalized.charCodeAt(i)) |
        0;
    }

    const frequency =
      260 + (Math.abs(hash) % 360);

    const now = ctx.currentTime;
    const duration = 0.18;

    osc.type = 'sine';

    osc.frequency.setValueAtTime(
      frequency,
      now
    );

    gain.gain.setValueAtTime(
      0.0001,
      now
    );

    gain.gain.exponentialRampToValueAtTime(
      0.10,
      now + 0.012
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + duration
    );

    osc.connect(gain);
    gain.connect(route.input);
    route.output.connect(ctx.destination);

    const record = {
      source: osc,
      gain,
      route
    };

    this.activeSources.add(record);

    osc.onended = () => {
      try { osc.disconnect(); } catch (e) {}
      try { gain.disconnect(); } catch (e) {}
      try { route.disconnect(); } catch (e) {}

      this.activeSources.delete(record);
    };

    try {
      osc.start(now);
      osc.stop(now + duration);
    } catch (error) {
      try { osc.disconnect(); } catch (e) {}
      try { gain.disconnect(); } catch (e) {}
      try { route.disconnect(); } catch (e) {}

      this.activeSources.delete(record);

      return null;
    }

    console.warn(
      `[AudioEngine] Using dichotic fallback for "${word}" on ${pan === -1 ? 'LEFT' : 'RIGHT'} channel.`
    );

    return record;
  },

  async speak(word) {
    const requestId = ++this._speechRequestId;
    const dichotic = !!this.dichoticEnabled;

    if (dichotic) {
      const normalized =
        this.normalizeWord(word);

      if (!normalized) {
        return null;
      }

      /*
       * Select the ear regardless of whether the MP3 exists.
       * This guarantees that a missing asset cannot break the
       * dichotic sequence.
       */
      const pan =
        this.getNextDichoticPan();

      const url =
        this.getAudioUrl(normalized);

      if (url) {
        const buffer =
          await this.loadAudioBuffer(url);

        if (buffer) {
          if (requestId !== this._speechRequestId) return null;
          return this.playBuffer(
            buffer,
            pan,
            { volume: 0.72 }
          );
        }

        console.warn(
          `[AudioEngine] Falling back because MP3 could not be decoded: ${normalized}`
        );
      } else {
        console.warn(
          `[AudioEngine] No MP3 path resolved for: ${normalized}`
        );
      }

      /*
       * Never leave the auditory modality silent merely because
       * one asset is absent.
       */
      if (requestId !== this._speechRequestId) return null;
      return this.playDichoticFallback(
        normalized,
        pan
      );
    }

    /*
     * The recording, in normal mode too.
     *
     * There are 294 word MP3s in the repository and only dichotic play was
     * using them; everything else went to the synthesiser. A recording of a
     * person saying "abyss" is better than any voice a browser ships, so the
     * file is tried first and speech synthesis is what happens when there is no
     * file — which is the way round it should have been.
     *
     * Centred rather than panned: the ear alternation is the dichotic
     * condition's whole point, and doing it here would quietly turn it on for
     * everybody.
     */
    const normalized = this.normalizeWord(word);
    if (normalized) {
      const url = this.getAudioUrl(normalized);
      if (url) {
        const buffer = await this.loadAudioBuffer(url);
        if (buffer) {
          if (requestId !== this._speechRequestId) return null;
          return this.playBuffer(buffer, 0, { volume: 0.72 });
        }
      }
    }

    /*
     * No recording for this word, so synthesise it.
     */
    if (typeof speechSynthesis !== 'undefined') {
      try {
        const chosen = this.preferredVoice || this.rankedVoices()[0] || null;

        if (chosen || (speechSynthesis.getVoices() || []).length) {
          const msg = new SpeechSynthesisUtterance(word);
          if (chosen) msg.voice = chosen;

          /*
           * Set explicitly, and the same every time.
           *
           * This is a memory task: the voice is a stimulus, so anything that
           * varies between trials is noise the player has to see past. Slightly
           * slower than the 1.1 it was — the words are single and the first
           * syllable was being swallowed at speed — and pitch and volume are
           * stated rather than left to whatever the last utterance used.
           */
          msg.rate = 1.0;
          msg.pitch = 1.0;
          msg.volume = 1.0;
          msg.lang = (chosen && chosen.lang) || 'en-US';

          /*
           * Cancel, yield, then speak.
           *
           * `cancel()` immediately followed by `speak()` is a known Chrome
           * fault: the queue is still tearing down when the new utterance
           * arrives and the first phoneme is clipped, which on single words is
           * most of the difference between "robotic" and "muffled". One turn of
           * the event loop is enough.
           */
          speechSynthesis.cancel();
          setTimeout(() => {
            if (requestId !== this._speechRequestId) return;
            try { speechSynthesis.speak(msg); } catch (e) {}
          }, 0);

          return null;
        }
      } catch (error) {
        console.warn(
          '[AudioEngine] Speech synthesis failed:',
          error
        );
      }
    }

    return null;
  },

  stopAll() {
    this._speechRequestId = (this._speechRequestId || 0) + 1;
    try {
      if (
        typeof speechSynthesis !==
        'undefined'
      ) {
        speechSynthesis.cancel();
      }
    } catch (e) {}

    for (
      const record
      of this.activeSources
    ) {
      try {
        record.source.stop();
      } catch (e) {}

      try {
        record.source.disconnect();
      } catch (e) {}

      try {
        record.gain.disconnect();
      } catch (e) {}

      try {
        record.route.disconnect();
      } catch (e) {}
    }

    this.activeSources.clear();
  },

  async close() {
    this.stopAll();

    if (this.ctx) {
      try {
        await this.ctx.close();
      } catch (e) {}
    }

    this.ctx = null;
    this.bufferCache.clear();
  },

  buzzMiss() {
    const ctx = this.ensureContext();

    if (!ctx) {
      return;
    }

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';

      osc.frequency.setValueAtTime(
        170,
        now
      );

      osc.frequency.exponentialRampToValueAtTime(
        95,
        now + 0.12
      );

      gain.gain.setValueAtTime(
        0.0001,
        now
      );

      gain.gain.exponentialRampToValueAtTime(
        0.12,
        now + 0.008
      );

      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + 0.14
      );

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) {}
  }
};

// ==================== STATS MANAGER ====================
