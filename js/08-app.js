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

const App = {
  engine: new GameEngine(),
  screens: {},
  _initialized: false,

  init() {
    if (this._initialized) return;
    StatsManager.load();
    this.loadSettings();
    this.screens = {
      setup: document.getElementById('screen-setup'),
      game: document.getElementById('screen-game'),
      results: document.getElementById('screen-results')
    };

    // Voice init with retry
    this.engine.initVoices();
    if (typeof speechSynthesis !== 'undefined') {
      speechSynthesis.onvoiceschanged = () => this.engine.initVoices();
    }
    const voiceSel = document.getElementById('sel-voice');
    if (voiceSel) {
      voiceSel.addEventListener('change', (e) => {
        if (this.engine.voices[e.target.value]) {
          this.engine.selectedVoice = this.engine.voices[e.target.value];
          AudioEngine.setVoice(this.engine.selectedVoice);
        }
        this.saveSettings();
      });
    }

    // Native control bindings. These are deliberately registered from JS so the app
    // does not depend on inline handlers or script execution order.
    const bindInput = (id, event, handler) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(event, handler);
    };
    bindInput('rng-start-n', 'input', e => { setText('disp-start-n', e.target.value); this.onVariableNToggle(); });
    bindInput('rng-emo-load', 'input', e => { setText('disp-emo-load', e.target.value + '%'); });
    bindInput('sel-grid-type', 'change', () => this.onGridTypeChange());
    bindInput('rng-3d-speed', 'input', () => this.update3DSpeedDisplay());
    bindInput('chk-variable-n', 'change', () => this.onVariableNToggle());
    bindInput('rng-var-min', 'input', e => { setText('disp-var-min', e.target.value); });
    bindInput('sel-isi-mode', 'change', () => this.onISIModeChange());
    bindInput('rng-isi-fixed', 'input', e => { setText('disp-isi-fixed', e.target.value + 'ms'); });
    bindInput('rng-isi-min', 'input', e => { setText('disp-isi-min', e.target.value + 'ms'); });
    bindInput('rng-isi-max', 'input', e => { setText('disp-isi-max', e.target.value + 'ms'); });
    bindInput('rng-session-duration', 'input', e => { setText('disp-session-duration', e.target.value + ' min'); });
    bindInput('rng-stim-dur', 'input', e => { setText('disp-stim-dur', e.target.value + 'ms'); });
    bindInput('rng-interference', 'input', e => { setText('disp-interference', e.target.value + '%'); });
    bindInput('rng-match-rate', 'input', e => { setText('disp-match-rate', e.target.value + '%'); });
    bindInput('chk-word-interference', 'change', () => this.saveSettings());
    bindInput('chk-dichotic', 'change', e => { AudioEngine.setDichotic(!!e.target.checked); this.saveSettings(); });
    bindInput('chk-pos', 'change', () => this.onStimChange());
    bindInput('chk-aud', 'change', () => this.onStimChange());
    bindInput('chk-shp', 'change', () => this.onStimChange());
    bindInput('chk-col', 'change', () => this.onStimChange());

    // Persist every user-facing configuration control.
    this.bindSettingsPersistence();

    // Mode cards
    const modeDual = document.getElementById('mode-dual');
    const modeQuad = document.getElementById('mode-quad');
    if (modeDual) modeDual.addEventListener('click', () => this.setMode('dual'));
    if (modeQuad) modeQuad.addEventListener('click', () => this.setMode('quad'));

    document.querySelectorAll('[data-stimulus-type]').forEach(card => {
      if (!card) return;

      card.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();

        const stimulusType = card.dataset.stimulusType;

        if (stimulusType !== 'human_faces' && stimulusType !== 'anime_faces' && stimulusType !== 'mix') {
          console.warn('[ATTENTIONAL SHIELD] Unknown stimulus type:', stimulusType);
          return;
        }

        try {
          this.setStimulusType(stimulusType);
        } catch (error) {
          console.error(
            '[ATTENTIONAL SHIELD] Stimulus mode switch failed:',
            stimulusType,
            error
          );
        }
      });
    });

    document.querySelectorAll('[data-anime-mode]').forEach(btn => {
      if (!btn) return;

      btn.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();

        if (btn.disabled || btn.dataset.locked === 'true') return;

        const mode = btn.dataset.animeMode;

        if (!['standard', 'waifu', 'hentai', 'gore', 'porn'].includes(mode)) {
          console.warn('[ATTENTIONAL SHIELD] Invalid Anime subtype:', mode);
          return;
        }

        try {
          // Gore/Hentai are Anime&More submodes. Ensure the parent family is
          // selected before applying the subtype and its age-gate flow.
          if (this.engine.stimulusType !== 'anime_faces') {
            this.setStimulusType('anime_faces', true);
          }
          this.setAnimeMode(mode);
        
        } catch (error) {
          console.error(
            '[ATTENTIONAL SHIELD] Anime subtype switch failed:',
            mode,
            error
          );
        }
      });
    });

    // Main buttons
    const btnInit = document.getElementById('btn-init-session');
    const btnDash = document.getElementById('btn-full-dashboard');
    const btnPause = document.getElementById('btn-pause');
    const btnEnd = document.getElementById('btn-end-session');
    const btnResMenu = document.getElementById('btn-results-menu');
    const btnResAgain = document.getElementById('btn-results-again');
    const btnModalClose = document.getElementById('btn-modal-close');

    if (btnInit) btnInit.addEventListener('click', () => this.startSession());
    if (btnDash) btnDash.addEventListener('click', () => this.showStatsFull());
    if (btnPause) btnPause.addEventListener('click', () => this.togglePause());
    if (btnEnd) btnEnd.addEventListener('click', () => this.endSession());
    if (btnResMenu) btnResMenu.addEventListener('click', () => this.switchScreen('setup'));
    if (btnResAgain) btnResAgain.addEventListener('click', () => this.startSession());
    if (btnModalClose) btnModalClose.addEventListener('click', () => this.closeModal());
    // 18+ age verification controls.
    const ageConfirm = document.getElementById('age-gate-confirm');
    const ageCancel = document.getElementById('age-gate-cancel');
    const ageOverlay = document.getElementById('age-gate');

    if (ageConfirm) ageConfirm.addEventListener('click', () => this.confirmAgeGate());
    if (ageCancel) ageCancel.addEventListener('click', () => this.cancelAgeGate());

    if (ageOverlay) {
    AudioEngine.stopAll();
      ageOverlay.addEventListener('click', (e) => {
        if (e.target === ageOverlay) this.cancelAgeGate();
      });
    }
    // Modal overlay click-to-close
    const modalOverlay = document.getElementById('modal-dashboard');
    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) this.closeModal();
      });
    }

    // Keyboard
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const ageGate = document.getElementById('age-gate');
        if (ageGate?.classList.contains('active')) {
          this.cancelAgeGate();
          return;
        }
      }
      const target = e.target;
      const tag = target && target.tagName ? target.tagName.toUpperCase() : '';
      const isTypingTarget = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || target?.isContentEditable || e.isComposing;
      if (!isTypingTarget && String(e.key).toLowerCase() === 'p' && this.engine.isRunning) {
        e.preventDefault();
        e.stopPropagation();
        this.togglePause();
        return;
      }
      this.handleKeydown(e);
    }, { capture: true });

    // Keep keyboard focus on the gameplay area so responses are never lost
    // after clicking the game, desktop controls, or mobile controls.
    const gameStage = document.getElementById('game-stage');
    if (gameStage) {
      const focusGameStage = () => {
        if (this.screens.game?.classList.contains('active')) {
          gameStage.focus({ preventScroll: true });
        }
      };
      gameStage.addEventListener('pointerdown', () => {
        requestAnimationFrame(focusGameStage);
      });
      gameStage.addEventListener('click', () => {
        requestAnimationFrame(focusGameStage);
      });
      this._focusGameStage = focusGameStage;
    }

    // Initial UI state
    this.setMode(this._savedMode || 'dual', false);
    this.setStimulusType(this._savedStimulusType || 'human_faces', false, { skipAgeGate: true });
    this.setAnimeMode(this._savedAnimeMode || 'standard', false);
    this.refreshSettingDisplays();
    this.updateGlobalStats();
    AudioEngine.setDichotic(getChecked('chk-dichotic', false));
    this.onStimChange();
    this.onVariableNToggle();
    this.onGridTypeChange();
    this.update3DSpeedDisplay();
    this.onISIModeChange();
    this.saveSettings();

    // Preload images non-blocking; never create an unhandled rejection.
    this.engine.preloadImages().catch(error => {
      console.warn(
        '[ATTENTIONAL SHIELD] Background stimulus preload failed:',
        error
      );
    });
    this._initialized = true;
  },

  getPersistentControlIds() {
    return [
      'rng-start-n','rng-emo-load','sel-grid-type','sel-grid-size','rng-3d-speed',
      'chk-variable-n','rng-var-min','inp-var-max','chk-adaptive','sel-isi-mode',
      'rng-isi-fixed','rng-isi-min','rng-isi-max','rng-stim-dur','rng-session-duration',
      'chk-tally','chk-buzzer','chk-feedback','chk-word-interference','chk-dichotic','rng-interference','rng-match-rate','sel-voice',
      'chk-pos','chk-aud','chk-shp','chk-col'
    ];
  },

  saveSettings() {
    try {
      const values = {};
      this.getPersistentControlIds().forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        values[id] = el.type === 'checkbox' ? el.checked : el.value;
      });
      const modeCard = document.querySelector('.mode-card.active');
      const voice = this.engine.selectedVoice || this.engine.voices[document.getElementById('sel-voice')?.value];
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
        values,
        mode: modeCard?.dataset.mode || this.engine.mode || 'dual',
        stimulusType: this.engine.stimulusType || 'human_faces',
        animeMode: this.engine.animeMode || 'standard',
        keys: this.engine.keys,
        voiceName: voice?.name || null
      }));
    } catch(e) {}
  },

  loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      const values = saved?.values || {};
      this.getPersistentControlIds().forEach(id => {
        const el = document.getElementById(id);
        if (!el || !(id in values)) return;
        if (el.type === 'checkbox') el.checked = !!values[id];
        else el.value = values[id];
      });
      if (saved?.keys && typeof saved.keys === 'object') {
        this.engine.keys = Object.assign({}, this.engine.keys, saved.keys);

        // Migrate the older arrow-key defaults to the requested A/L/S/D layout.
        const legacy = {
          pos: 'ArrowLeft',
          aud: 'ArrowRight',
          shp: 'ArrowDown',
          col: 'ArrowUp'
        };
        const modern = { pos:'a', aud:'l', shp:'s', col:'d' };
        Object.keys(legacy).forEach(type => {
          if (this.engine.keys[type] === legacy[type]) {
            this.engine.keys[type] = modern[type];
          }
        });
      }
      this._savedMode = saved?.mode === 'quad' ? 'quad' : 'dual';
      this._savedStimulusType = saved?.stimulusType === 'anime_faces' ? 'anime_faces' : 'human_faces';
      this._savedAnimeMode = ['standard', 'waifu', 'hentai', 'gore', 'porn'].includes(saved?.animeMode)
        ? saved.animeMode
        : 'standard';
      this._savedVoiceName = saved?.voiceName || null;
    } catch(e) {
      this._savedMode = 'dual'; this._savedStimulusType = 'human_faces'; this._savedAnimeMode = 'standard'; this._savedVoiceName = null;
    }
  },

  bindSettingsPersistence() {
    this.getPersistentControlIds().forEach(id => {
      const el = document.getElementById(id);
      if (!el || el.dataset.persistenceBound === '1') return;
      const save = () => this.saveSettings();
      el.addEventListener('change', save);
      el.addEventListener('input', save);
      el.dataset.persistenceBound = '1';
    });
  },

  refreshSettingDisplays() {
    const map = {
      'disp-start-n':['rng-start-n',v=>v], 'disp-emo-load':['rng-emo-load',v=>v+'%'],
      'disp-3d-speed':['rng-3d-speed',v=>v<30?'Slow':v<70?'Normal':'Fast'], 'disp-var-min':['rng-var-min',v=>v],
      'disp-isi-fixed':['rng-isi-fixed',v=>v+'ms'], 'disp-isi-min':['rng-isi-min',v=>v+'ms'],
      'disp-isi-max':['rng-isi-max',v=>v+'ms'], 'disp-stim-dur':['rng-stim-dur',v=>v+'ms'],
      'disp-session-duration':['rng-session-duration',v=>v+' min'], 'disp-interference':['rng-interference',v=>v+'%'],
      'disp-match-rate':['rng-match-rate',v=>v+'%']
    };
    Object.entries(map).forEach(([out,[id,fmt]]) => { const input=document.getElementById(id), display=document.getElementById(out); if(input&&display) display.textContent=fmt(input.value); });
  },

  switchScreen(id) {
    // Leaving the game screen must terminate the previous renderer before
    // another screen becomes visible.
    if (id !== 'game') {
      AudioEngine.stopAll();
      cleanupRenderers();
    }

    Object.values(this.screens).forEach(s => {
      if (s) s.classList.remove('active');
    });

    if (this.screens[id]) {
      this.screens[id].classList.add('active');
    }

    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.style.display = id === 'setup' ? 'inline-flex' : 'none';
    }

    // Settle layouts then query parent dimensions to scale Three.js accurately.
    if (id === 'game') {
      requestAnimationFrame(() => {
        if (this._focusGameStage) this._focusGameStage();
        requestAnimationFrame(() => {
          if (this.engine?.getSettings?.().gridType === '3d') {
            if (typeof ThreeDGrid.fitCameraToMatrix === 'function') {
              ThreeDGrid.fitCameraToMatrix();
            }
          }
        });
      });

      // Defensive layout-settling delayed check
      setTimeout(() => {
        if (this.engine?.getSettings?.().gridType === '3d') {
          if (typeof ThreeDGrid.fitCameraToMatrix === 'function') {
            ThreeDGrid.fitCameraToMatrix();
          }
        }
      }, 150);
    }

    if (id === 'setup') {
      this.updateGlobalStats();
    }
  },

  setMode(mode, persist = true) {
    this.engine.mode = mode;
    const dual = document.getElementById('mode-dual');
    const quad = document.getElementById('mode-quad');
    if (dual) dual.classList.toggle('active', mode === 'dual');
    if (quad) quad.classList.toggle('active', mode === 'quad');
    const isQuad = mode === 'quad';
    const shpWrap = document.getElementById('chk-shp-wrapper');
    const colWrap = document.getElementById('chk-col-wrapper');
    if (shpWrap) shpWrap.style.display = isQuad ? 'flex' : 'none';
    if (colWrap) colWrap.style.display = isQuad ? 'flex' : 'none';
    const shp = document.getElementById('chk-shp');
    const col = document.getElementById('chk-col');
    if (shp) shp.checked = isQuad;
    if (col) col.checked = isQuad;
    this.onStimChange();
    if (persist) this.saveSettings();
  },

  setStimulusType(type, persist = true, options = {}) {
    const normalized = type === 'mix'
      ? 'mix'
      : (type === 'anime_faces' || type === 'anime_standard'
        ? 'anime_faces'
        : 'human_faces');

    // Preserve the selected Anime subtype when switching the visual family.
    if (normalized === 'anime_faces') {
      this.animeMode = ANIME_MODES.includes(this.animeMode)
        ? this.animeMode
        : 'standard';
    }

    this.engine.stimulusType = normalized;
    this.engine.animeMode = this.animeMode || 'standard';
    this.engine._selectedPreloadKey = null;
    this.engine._selectedPreloadResult = null;

    const human = document.getElementById('stimulus-human-card');
    const anime = document.getElementById('stimulus-anime-card');
    const mix = document.getElementById('stimulus-mix-card');
    const panel = document.getElementById('anime-submode-panel');
    const humanActive = normalized === 'human_faces';
    const mixActive = normalized === 'mix';

    if (human) {
      human.classList.toggle('active', humanActive);
      human.setAttribute('aria-pressed', humanActive ? 'true' : 'false');
    }
    if (anime) {
      anime.classList.toggle('active', normalized === 'anime_faces');
      anime.setAttribute('aria-pressed', normalized === 'anime_faces' ? 'true' : 'false');
    }
    if (mix) {
      mix.classList.toggle('active', mixActive);
      mix.setAttribute('aria-pressed', mixActive ? 'true' : 'false');
    }
    if (panel) panel.hidden = humanActive || mixActive;

    this.setAnimeMode(this.animeMode || 'standard', false);

    const status = document.getElementById('stimulus-type-status');
    if (status) {
      const labels = {
        standard: 'Anime&More • Standard',
        waifu: 'Anime&More • Waifu • 56 assets',
        hentai: 'Anime&More • Hentai • ' + HENTAI_COUNT + ' assets',
        gore: 'Anime&More • Gore • Sequential assets',
        porn: 'Anime&More • Porn • Sequential assets'
      };
      status.textContent = humanActive
        ? 'Human Faces • Standard affective faces'
        : mixActive
          ? 'Mix Mode • Random pool from all available visual categories'
          : (labels[this.animeMode] || labels.standard);
    }

    if (persist) this.saveSettings();
  },

  setAnimeMode(mode, persist = true, options = {}) {
    // Hentai and Gore require the same explicit 18+ verification.
    if ((mode === 'hentai' || mode === 'gore' || mode === 'porn') && !options.skipAgeGate && !this.ageVerified) {
      this.pendingAgeAction = { type: 'set-anime-mode', value: mode };
      this.openAgeGate();
      return;
    }

    // All configured Anime visual families are selectable, including Gore.
    const normalized = ANIME_MODES.includes(mode)
      ? mode
      : 'standard';

    this.engine.animeMode = normalized;
    this.animeMode = normalized;
    this.engine._selectedPreloadKey = null;
    this.engine._selectedPreloadResult = null;

    document.querySelectorAll('[data-anime-mode]').forEach(btn => {
      const btnMode = btn.dataset.animeMode;
      const active = btnMode === normalized;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      btn.disabled = false;
      btn.removeAttribute('aria-disabled');
    });

    const status = document.getElementById('stimulus-type-status');
    if (status && this.engine.stimulusType === 'anime_faces') {
      if (normalized === 'waifu') {
        status.textContent = 'Anime&More • Waifu • 56 assets';
      } else if (normalized === 'hentai') {
        status.textContent = 'Anime&More • Hentai • ' + HENTAI_COUNT + ' assets';
      } else if (normalized === 'gore') {
        status.textContent = 'Anime&More • Gore • Sequential assets from assets/stimuli/gore/';
      } else if (normalized === 'porn') {
        status.textContent = 'Anime&More • Porn • Sequential assets from assets/stimuli/porn/';
      } else {
        status.textContent = 'Anime&More • Standard';
      }
    }

    if (persist) this.saveSettings();
  },

  onGridTypeChange() {
    const sel = document.getElementById('sel-grid-type');
    const is3d = sel ? sel.value === '3d' : false;
    const r2d = document.getElementById('row-2d-size');
    const r3d = document.getElementById('row-3d-speed');
    if (r2d) r2d.style.display = is3d ? 'none' : 'flex';
    if (r3d) r3d.style.display = is3d ? 'flex' : 'none';
  },

  update3DSpeedDisplay() {
    const rng = document.getElementById('rng-3d-speed');
    const disp = document.getElementById('disp-3d-speed');
    if (rng && disp) {
      const v = parseInt(rng.value);
      disp.textContent = v < 30 ? 'Slow' : v < 70 ? 'Normal' : 'Fast';
      ThreeDGrid.setRotationSpeed(v);
      this.saveSettings();
    }
  },

  onVariableNToggle() {
    const chk = document.getElementById('chk-variable-n');
    const el = document.getElementById('variable-n-controls');
    const on = chk ? chk.checked : false;
    if (el) {
      el.style.opacity = on ? '1' : '0.4';
      el.style.pointerEvents = on ? 'auto' : 'none';
    }
    const nVal = parseInt(document.getElementById('rng-start-n')?.value) || 1;
    const minRng = document.getElementById('rng-var-min');
    if (minRng) {
      minRng.max = Math.max(1, nVal - 1);
      if (parseInt(minRng.value) > parseInt(minRng.max)) minRng.value = minRng.max;
      const disp = document.getElementById('disp-var-min');
      if (disp) disp.textContent = minRng.value;
    }
  },

  onISIModeChange() {
    const sel = document.getElementById('sel-isi-mode');
    const mode = sel ? sel.value : 'fixed';
    const fixedCtrl = document.getElementById('isi-fixed-controls');
    const varCtrl = document.getElementById('isi-variable-controls');
    if (fixedCtrl) fixedCtrl.style.display = mode === 'fixed' ? 'block' : 'none';
    if (varCtrl) varCtrl.style.display = mode === 'variable' ? 'block' : 'none';
  },

  onStimChange() {
    this.engine.setActiveStimuli();
    const grid = document.getElementById('keybind-grid');
    if (!grid) return;
    grid.innerHTML = '';
    this.engine.activeStimuli.forEach(stim => {
      const label = document.createElement('div');
      label.className = 'kb-label';
      label.textContent = MOD_LABELS[stim];
      const btn = document.createElement('button');
      btn.className = 'keybind-btn';
      btn.dataset.type = stim;
      btn.textContent = formatKey(this.engine.keys[stim]);
      btn.addEventListener('click', () => this.startBind(btn));
      grid.appendChild(label);
      grid.appendChild(btn);
    });
  },

  startBind(btn) {
    if (this.engine.listeningBind) {
      const old = document.querySelector('.keybind-btn.listening');
      if (old) {
        old.classList.remove('listening');
        old.textContent = formatKey(this.engine.keys[old.dataset.type]);
      }
    }
    this.engine.listeningBind = btn.dataset.type;
    btn.textContent = 'Press...';
    btn.classList.add('listening');
  },

  handleKeydown(e) {
    // Key-binding capture mode must work before any gameplay/focus checks.
    if (this.engine.listeningBind) {
      e.preventDefault();
      e.stopPropagation();
      this.engine.keys[this.engine.listeningBind] = e.key;
      this.engine.listeningBind = null;
      this.onStimChange();
      this.saveSettings();
      return;
    }

    // Ignore keyboard input only when the user is actually typing in a form field.
    const target = e.target;
    const tag = target && target.tagName ? target.tagName.toUpperCase() : '';
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || target?.isContentEditable || e.isComposing) return;

    if (!this.engine.isRunning || this.engine.isPaused || !this.engine.isTrialActive) return;
    if (this.engine.currentTrial < 0 || this.engine.currentTrial >= this.engine.blockTrials) return;

    const normalizeKey = (value) => {
      const raw = String(value ?? '');
      const lower = raw.toLowerCase();
      if (lower === ' ' || lower === 'space' || lower === 'spacebar') return 'space';
      if (lower === 'esc') return 'escape';
      if (lower === 'return') return 'enter';
      return lower;
    };

    const pressedKey = normalizeKey(e.key);
    const pressedCode = normalizeKey(e.code);

    // During an active trial, navigation/scroll keys must never reach the browser.
    const browserControlKeys = new Set([
      'space', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
      'pageup', 'pagedown', 'home', 'end'
    ]);

    if (browserControlKeys.has(pressedKey) || browserControlKeys.has(pressedCode)) {
      e.preventDefault();
    }

    for (const type of this.engine.activeStimuli) {
      const boundRaw = String(this.engine.keys[type] ?? '');
      const boundKey = normalizeKey(boundRaw);
      if (!boundKey) continue;

      // Compare the configured e.key value AND e.code, so bindings remain
      // reliable for letters, numbers, arrows, Space, and other special keys.
      const boundCode = normalizeKey(boundRaw);
      const physicalCode = pressedCode;
      const keyMatch = pressedKey === boundKey;
      const codeMatch = physicalCode === boundCode;

      // Also accept KeyX/DigitX when a binding was saved as just x/1.
      const keyCodeMatch =
        (boundKey.length === 1 && /^[a-z]$/.test(boundKey) && physicalCode === 'key' + boundKey) ||
        (boundKey.length === 1 && /^[0-9]$/.test(boundKey) && physicalCode === 'digit' + boundKey);

      if (keyMatch || codeMatch || keyCodeMatch) {
        e.preventDefault();
        e.stopPropagation();
        this.handleModalityResponse(type);
        return;
      }
    }

    if (this.engine.getSettings().tally && pressedKey === 'space') {
      e.preventDefault();
      e.stopPropagation();
      this.advanceTally();
    }
  },

  toggleAccordion(id) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('open');
  },

  isRestrictedStimulusSelection() {
    return this.engine.stimulusType === 'mix' || (this.engine.stimulusType === 'anime_faces' && (this.engine.animeMode === 'hentai' || this.engine.animeMode === 'gore' || this.engine.animeMode === 'porn'));
  },

  openAgeGate() {
    const overlay = document.getElementById('age-gate');
    const error = document.getElementById('age-gate-error');
    if (!overlay) return;

    if (error) error.style.display = 'none';

    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');

    setTimeout(() => {
      document.getElementById('age-gate-confirm')?.focus();
    }, 0);
  },

  closeAgeGate() {
    const overlay = document.getElementById('age-gate');
    if (!overlay) return;

    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');

    const error = document.getElementById('age-gate-error');
    if (error) error.style.display = 'none';

    this.pendingAgeAction = null;
  },

  confirmAgeGate() {
    this.ageVerified = true;
    try { sessionStorage.setItem('age_verified', '1'); } catch (e) {}

    const pending = this.pendingAgeAction;
    this.closeAgeGate();

    if (!pending) return;

    if (pending.type === 'set-stimulus-type') {
      this.setStimulusType(pending.value, true, { skipAgeGate: true });
    } else if (pending.type === 'set-anime-mode') {
      this.setAnimeMode(pending.value, true, { skipAgeGate: true });
    } else if (pending.type === 'start-session') {
      this.startSession({ skipAgeGate: true });
    }
  },

  cancelAgeGate() {
    // Do not change the selected dataset and do not start a session.
    this.closeAgeGate();
  },

  async startSession(options = {}) {
    cleanupRenderers();

    if (!options.skipAgeGate && this.isRestrictedStimulusSelection()) {
      this.pendingAgeAction = { type: 'start-session' };
      this.openAgeGate();
      return;
    }

    const s = this.engine.getSettings();
    const loading = document.getElementById('asset-loading-overlay');
    const startButton = document.getElementById('btn-init-session');

    const setLoading = (active, message = 'LOADING ASSETS...') => {
      if (!loading) return;
      loading.classList.toggle('active', active);
      loading.setAttribute('aria-hidden', active ? 'false' : 'true');
      const label = loading.querySelector('.asset-loading-label');
      if (label) label.textContent = message;
    };

    const waitFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

    const waitForContainerSize = async (container, attempts = 10) => {
      if (!container) return false;
      for (let i = 0; i < attempts; i++) {
        const width = container.clientWidth || container.getBoundingClientRect().width;
        const height = container.clientHeight || container.getBoundingClientRect().height;
        if (width > 0 && height > 0) return true;
        void container.offsetWidth;
        void container.offsetHeight;
        await waitFrame();
      }
      return false;
    };

    const preloadWithTimeout = (timeoutMs = 8000) => {
      let timer = null;
      const timeout = new Promise(resolve => {
        timer = setTimeout(() => resolve({ timedOut: true, loaded: false }), timeoutMs);
      });
      const preload = Promise.resolve()
        .then(() => this.engine.preloadImages())
        .then(result => ({ timedOut: false, loaded: true, result }))
        .catch(error => ({ timedOut: false, loaded: false, error }));
      return Promise.race([preload, timeout]).finally(() => { if (timer) clearTimeout(timer); });
    };

    if (startButton) startButton.disabled = true;
    setLoading(true);

    try {
      this.engine.reset();
      this.engine.mode = document.querySelector('.mode-card.active')?.dataset.mode || 'dual';
      this.engine.stimulusType = s.stimulusType === 'mix'
        ? 'mix'
        : (s.stimulusType === 'anime_faces' ? 'anime_faces' : 'human_faces');
      this.engine.animeMode = ['standard', 'waifu', 'hentai', 'gore', 'porn'].includes(s.animeMode) ? s.animeMode : 'standard';

      const preloadResult = await preloadWithTimeout(8000);
      if (preloadResult.timedOut) {
        console.warn('[ATTENTIONAL SHIELD] Asset preload timed out; continuing with available assets.');
      } else if (!preloadResult.loaded) {
        console.warn('[ATTENTIONAL SHIELD] Asset preload failed; continuing with available assets.', preloadResult.error);
      } else {
        console.info('[ATTENTIONAL SHIELD] Selected assets ready:', preloadResult.result);
      }

      this.engine.setActiveStimuli();
      this.engine.currentN = s.startN;
      this.engine.highestN = s.startN;
      this.engine.sessionStart = Date.now();
      this.engine.lastTick = Date.now();
      this.engine.sessionLimitMs = Math.max(1, Number(s.sessionDurationMin) || 10) * 60000;
      this.engine.sessionTrialsCompleted = 0;

      const estimatedIsi = s.isiMode === 'fixed'
        ? Math.max(500, Number(s.isiFixed) || DEFAULT_ISI)
        : (Math.max(500, Number(s.isiMin) || 1300) + Math.max(500, Number(s.isiMax) || 3000)) / 2;
      const estimatedTrialMs = Math.max(500, Number(s.stimDur) || TRIAL_TIMING.stimulusMs) + estimatedIsi;
      this.engine.sessionTotalTrials = Math.max(1, Math.floor(this.engine.sessionLimitMs / estimatedTrialMs));
      this.engine.isRunning = true;

      AudioEngine.init();
      AudioEngine.resetDichoticSequence();
      AudioEngine.stopAll();
      AudioEngine.setDichotic(!!s.dichoticAudio);
      if (AudioEngine.ctx?.state === 'suspended') AudioEngine.ctx.resume().catch(() => {});

      // IMPORTANT: make the game screen visible BEFORE initializing
      // Three.js. #scene-3d can otherwise report 0x0 while display:none.
      this.switchScreen('game');
      await waitFrame();

      this.buildGrid();
      this.buildSideControls();

      // Allow the newly-visible flex/grid layout to settle before the
      // first renderer sizing pass.
      await waitFrame();

      const scene3d = document.getElementById('scene-3d');
      if (s.gridType === '3d' && scene3d) {
        const sized = await waitForContainerSize(scene3d);
        if (!sized) {
          const width = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 800);
          const height = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 600);
          scene3d.style.width = `${width}px`;
          scene3d.style.height = `${height}px`;
          void scene3d.offsetWidth;
          void scene3d.offsetHeight;
        }
        if (typeof ThreeDGrid.fitCameraToMatrix === 'function') {
          ThreeDGrid.fitCameraToMatrix();
        }
        
        // Final fallback timeout for safe rendering pass
        setTimeout(() => {
          if (typeof ThreeDGrid.fitCameraToMatrix === 'function') {
            ThreeDGrid.fitCameraToMatrix();
          }
        }, 100);
      }

      this.showInterMsg('GET READY', 800);

      if (this.engine.timerInterval) clearInterval(this.engine.timerInterval);
      this.engine.timerInterval = setInterval(() => this.updateTimer(), 100);

      await waitFrame();
      if (!this.engine.isRunning || this.engine.isPaused) return;

      try {
        this.startBlock();
      } catch (error) {
        console.error('[ATTENTIONAL SHIELD] Block initialization failed:', error);
        this.endSession('error');
      }
    } catch (error) {
      console.error('[ATTENTIONAL SHIELD] Session initialization failed:', error);
      this.engine.isRunning = false;
      this.engine.isTrialActive = false;
      if (this.engine.trialTimeout) clearTimeout(this.engine.trialTimeout);
      if (this.engine.trialAdvanceTimeout) clearTimeout(this.engine.trialAdvanceTimeout);
      if (this.engine.timerInterval) clearInterval(this.engine.timerInterval);
      this.engine.trialTimeout = null;
      this.engine.trialAdvanceTimeout = null;
      this.engine.timerInterval = null;
      cleanupRenderers();
      const msg = document.getElementById('inter-msg');
      if (msg) { msg.textContent = 'SESSION INITIALIZATION FAILED — PLEASE TRY AGAIN'; msg.classList.add('active'); }
    } finally {
      setLoading(false);
      if (startButton) startButton.disabled = false;
    }
  },

  updateLevelHUD() {
    const el = document.getElementById('hud-nlevel');
    if (!el) return;
    const n = Number(this.engine.currentN) || 1;
    el.textContent = 'N-BACK: ' + n;
    el.setAttribute('aria-label', 'Current N-back level ' + n);
  },

  updateTimer() {
    if (!this.engine.isRunning || this.engine.isPaused) return;
    const now = Date.now();
    this.engine.sessionMs += (now - this.engine.lastTick);
    this.engine.lastTick = now;
    const limit = this.engine.sessionLimitMs || 0;
    if (limit > 0 && this.engine.sessionMs >= limit) {
      this.engine.sessionMs = limit;
      const el = document.getElementById('hud-timer');
      if (el) el.textContent = formatTime(this.engine.sessionMs);
      this.endSession('duration');
      return;
    }
    const el = document.getElementById('hud-timer');
    if (el) el.textContent = formatTime(this.engine.sessionMs);
  },

  buildGrid() {
    const s = this.engine.getSettings();
    cleanupRenderers();

    const g2d = document.getElementById('grid-2d');
    const s3d = document.getElementById('scene-3d');

    if (s.gridType === '3d') {
      if (!s3d) { console.error('[ATTENTIONAL SHIELD] #scene-3d is missing.'); return; }
      activate3DRenderer();
      if (!ThreeDGrid.init(s3d)) {
        console.error('[ATTENTIONAL SHIELD] Three.js initialization failed.');
        activate2DRenderer();
        return;
      }
      ThreeDGrid.setRotationSpeed(document.getElementById('rng-3d-speed')?.value || 40);
      requestAnimationFrame(() => { if (typeof ThreeDGrid.fitCameraToMatrix === 'function') ThreeDGrid.fitCameraToMatrix(); });
      return;
    }

    activate2DRenderer();
    if (!g2d) return;

    // Hard reset: remove all previous descendants and every stale inline style.
    g2d.replaceChildren();
    g2d.removeAttribute('style');

    const sz = Math.max(1, Math.min(4, Number(s.gridSize) || 3));
    g2d.style.display = 'grid';
    g2d.style.gridTemplateColumns = `repeat(${sz}, minmax(0, 1fr))`;
    g2d.style.gridTemplateRows = `repeat(${sz}, minmax(0, 1fr))`;
    g2d.style.aspectRatio = '1 / 1';
    g2d.style.flexShrink = '0';
    g2d.style.minWidth = '0';
    g2d.style.minHeight = '0';
    g2d.style.maxWidth = '100%';
    g2d.style.maxHeight = '100%';
    g2d.style.boxSizing = 'border-box';
    g2d.style.overflow = 'hidden';

    const fragment = document.createDocumentFragment();

    for (let i = 0; i < sz * sz; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell-2d';
      cell.id = 'pos-' + i;
      cell.removeAttribute('style');

      const img = document.createElement('img');
      img.className = 'face-img stimulus-image';
      img.alt = '';
      img.removeAttribute('src');
      img.removeAttribute('width');
      img.removeAttribute('height');
      img.style.display = 'none';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.style.pointerEvents = 'none';
      img.style.boxSizing = 'border-box';

      const fallback = document.createElement('div');
      fallback.className = 'face-fallback';
      fallback.textContent = '';
      fallback.style.display = 'none';

      const overlay = document.createElement('div');
      overlay.className = 'cell-overlay';

      /*
       * The shape and colour, drawn inside the cell that holds the picture.
       *
       * They used to be a strip above the grid, which made every trial two
       * places to look: the face in one square and its shape somewhere over the
       * top of everything. Same square means one fixation instead of a saccade,
       * and it is the arrangement the modalities are meant to be bound in — a
       * shape *of* this trial rather than beside it.
       */
      const shape = document.createElement('div');
      shape.className = 'cell-shape';

      cell.append(img, fallback, overlay, shape);
      fragment.appendChild(cell);
    }

    g2d.appendChild(fragment);
    void g2d.offsetWidth;
    void g2d.offsetHeight;
  },

  buildSideControls() {
    const left = document.getElementById('side-left');
    const right = document.getElementById('side-right');
    const mobile = document.getElementById('mobile-response-controls');
    if (left) left.innerHTML = '';
    if (right) right.innerHTML = '';
    if (mobile) mobile.innerHTML = '';

    const stims = this.engine.activeStimuli;
    const makeBtn = (type, idSuffix = '') => {
      const d = document.createElement('div');
      d.className = 'modality-btn';
      d.id = 'ind-' + type + idSuffix;
      d.dataset.type = type;
      d.setAttribute('role', 'button');
      d.setAttribute('aria-label', MOD_LABELS[type] + ' response');
      d.style.setProperty('--mod', MOD_COLORS[type] || 'var(--cyan)');
      d.innerHTML =
        '<svg class="mod-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">'
          + (MOD_ICONS[type] || '') + '</svg>'
        + '<span class="mod-name">' + MOD_LABELS[type] + '</span>'
        + '<kbd class="mod-key">' + formatKey(this.engine.keys[type]) + '</kbd>'
        + '<span class="mod-mark" aria-hidden="true"></span>';
      d.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleModalityResponse(type);
      });
      d.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleModalityResponse(type);
      });
      return d;
    };

    let leftStims = [], rightStims = [];
    if (stims.length >= 4) { leftStims = stims.slice(0, 2); rightStims = stims.slice(2); }
    else if (stims.length === 3) { leftStims = stims.slice(0, 2); rightStims = stims.slice(2); }
    else if (stims.length === 2) { leftStims = [stims[0]]; rightStims = [stims[1]]; }
    else { leftStims = stims; }
    leftStims.forEach(t => { if (left) left.appendChild(makeBtn(t)); });
    rightStims.forEach(t => { if (right) right.appendChild(makeBtn(t)); });
    if (mobile) stims.forEach(t => mobile.appendChild(makeBtn(t, '-mobile')));
  },

  handleModalityResponse(type) {
    if (!this.engine.isRunning || !this.engine.isTrialActive || this.engine.isPaused) return;
    if (this.engine.currentTrial >= this.engine.blockTrials) return;
    if (!this.engine.responses[type]) this.engine.responses[type] = [];
    if (!this.engine.responses[type][this.engine.currentTrial]) {
      this.processFeedback(type);
    }
  },

  tapFeedback(type) {
    this.handleModalityResponse(type);
  },

  renderWordInterference(word, targetEl, gridType) {
    this.clearWordInterference();
    if (!word) return;
    const label = document.createElement('div');
    label.className = 'word-interference';
    label.textContent = word;
    label.setAttribute('aria-hidden', 'true');
    label.dataset.passiveDistractor = 'true';
    if (gridType === '3d') {
      const scene = document.getElementById('scene-3d');
      if (!scene) return;
      label.classList.add('word-interference-3d');
      scene.appendChild(label);
    } else if (targetEl) {
      targetEl.appendChild(label);
    }
  },

  clearWordInterference() {
    document.querySelectorAll('.word-interference').forEach(el => el.remove());
  },

  showBlockCompletionOverlay(transition) {
    const overlay = document.getElementById('block-transition');
    if (!overlay) return new Promise(resolve => setTimeout(resolve, 2500));
    const level = overlay.querySelector('[data-transition-level]');
    const button = overlay.querySelector('[data-transition-start]');
    const nextN = transition?.nextN ?? this.engine.currentN;
    const action = transition?.action || 'maintaining';
    if (level) {
      if (action === 'advancing') level.textContent = 'Advancing to ' + nextN + '-Back';
      else if (action === 'dropping') level.textContent = 'Dropping to ' + nextN + '-Back';
      else level.textContent = 'Maintaining ' + nextN + '-Back';
    }
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    return new Promise(resolve => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if (button) button.removeEventListener('click', finish);
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
        resolve();
      };
      if (button) button.addEventListener('click', finish);
      const timer = setTimeout(finish, 2500);
    });
  },

  showInterMsg(text, duration) {
    const el = document.getElementById('inter-msg');
    if (!el) return;
    el.textContent = text;
    el.classList.add('active');
    setTimeout(() => el.classList.remove('active'), duration);
  },

  startBlock() {
    this.engine.generateBlock();
    this.updateHUD();
    this.updateLevelHUD();
    this.runTrial();
  },

  runTrial() {
    if (!this.engine.isRunning || this.engine.isPaused) return;
    if (this.engine.currentTrial >= this.engine.blockTrials) {
      this.evaluateBlock();
      if (this.engine.isRunning && !this.engine.isPaused) {
        this.engine.isTrialActive = false;
        this.clearGrid();
        const transition = this.engine._lastBlockTransition || { action:'maintaining', nextN:this.engine.currentN };
        this.showBlockCompletionOverlay(transition).then(() => {
          if (this.engine.isRunning && !this.engine.isPaused) this.startBlock();
        });
      }
      return;
    }

    const trial = this.engine.trials[this.engine.currentTrial];
    const k = this.engine.kSeq[this.engine.currentTrial];
    const s = this.engine.getSettings();
    this.engine.isTrialActive = true;

    const hudTrial = document.getElementById('hud-trial');
    if (hudTrial) {
      const sessionIndex = this.engine.sessionTrialsCompleted + this.engine.currentTrial + 1;
      const total = this.engine.sessionTotalTrials || this.engine.blockTrials;
      hudTrial.textContent = sessionIndex + ' / ' + total;
    }
    this.clearGrid();

    // Position stimulus
    if (this.engine.activeStimuli.includes('pos')) {
      const targetEl = document.getElementById('pos-' + trial.pos);
      const isAnime = trial.visualType === 'anime_faces';
      const animeMode = isAnime && ANIME_MODES.includes(trial.animeMode) ? trial.animeMode : 'standard';
      const imageCache = isAnime ? (ANIME_IMAGE_CACHE[animeMode] || {}) : this.engine.imageCache;
      const imagePath = trial.face;
      const preloadedImage = getPreloadedImage(imagePath, isAnime ? 'anime_faces' : 'human_faces', animeMode);

      const showFallback = (label) => {
        if (s.gridType === '3d') {
          ThreeDGrid.setActiveCell(trial.pos, null);
          return;
        }
        if (!targetEl) return;
        const img = targetEl.querySelector('.face-img');
        const fb = targetEl.querySelector('.face-fallback');
        if (img) img.style.display = 'none';
        if (fb) { fb.textContent = label; fb.style.display = 'flex'; }
        targetEl.classList.add('active');
      };

      if (imagePath && !(preloadedImage instanceof HTMLImageElement && preloadedImage.naturalWidth > 0)) {
        console.error('Failed to load anime face path:', imagePath);
        showFallback('ANIME');
      } else if (s.gridType === '3d') {
        ThreeDGrid.setActiveCell(trial.pos, preloadedImage || imagePath || null);
      } else if (targetEl) {
        const img = targetEl.querySelector('.face-img');
        const fb = targetEl.querySelector('.face-fallback');
        if (imagePath && img) {
          img.className = 'face-img stimulus-image';
          img.alt = isAnime ? 'Anime face visual stimulus' : trial.faceEmotion + ' emotional face';
          img.decoding = 'async'; img.loading = 'eager';
          img.style.width = '100%'; img.style.height = '100%'; img.style.objectFit = 'cover'; img.style.display = 'block'; img.style.maxWidth = '100%'; img.style.maxHeight = '100%'; img.style.pointerEvents = 'none';
          img.onerror = () => {
            if (isAnime) console.error('Failed to load anime face path:', imagePath);
            img.style.display = 'none';
            if (fb) { fb.textContent = isAnime ? 'ANIME' : String(trial.faceEmotion || 'FACE')[0].toUpperCase(); fb.style.display = 'flex'; }
          };
          img.src = preloadedImage instanceof HTMLImageElement
            ? (preloadedImage.currentSrc || preloadedImage.src)
            : imagePath;
          if (fb) fb.style.display = 'none';
        } else {
          showFallback(isAnime ? 'ANIME' : String(trial.faceEmotion || 'FACE')[0].toUpperCase());
        }
        targetEl.classList.add('active');
      }
    }

    if (s.wordInterference && trial.wordInterference && this.engine.activeStimuli.includes('pos')) {
      this.renderWordInterference(
        trial.wordInterference,
        s.gridType === '3d' ? document.getElementById('scene-3d') : document.getElementById('pos-' + trial.pos),
        s.gridType
      );
    }

    /*
     * Shape and colour, in the cell the picture is in.
     *
     * The strip above the grid stays as the fallback and is still needed: with
     * position switched off there is no active cell to draw into, and the 3D
     * grid is a WebGL scene with no DOM cell to hold an SVG. Both fall back
     * rather than losing the stimulus.
     */
    const shapeDisp = document.getElementById('shape-display');
    const wantsShape = this.engine.activeStimuli.includes('col')
      || this.engine.activeStimuli.includes('shp')
      || this.engine.activeStimuli.includes('aud');

    const inCell = s.gridType !== '3d'
      && this.engine.activeStimuli.includes('pos')
      && document.getElementById('pos-' + trial.pos);

    // Whatever was drawn last trial, wherever it was drawn.
    document.querySelectorAll('.cell-shape').forEach(el => { el.innerHTML = ''; });

    if (wantsShape) {
      const fillColor = this.engine.activeStimuli.includes('col') ? COLORS[trial.col] : 'rgba(255,255,255,0.06)';
      const strokeColor = this.engine.activeStimuli.includes('col') ? COLORS[trial.col] : '#4b5563';

      let markup = '';
      if (this.engine.activeStimuli.includes('shp')) {
        markup = SHAPES_SVG[trial.shp].replace(/FILL/g, fillColor).replace(/STROKE/g, strokeColor);
      } else if (this.engine.activeStimuli.includes('col')) {
        markup = '<rect x="10" y="10" width="80" height="80" rx="14" fill="' + fillColor + '" stroke="' + strokeColor + '" stroke-width="4"/>';
      }

      const host = inCell ? inCell.querySelector('.cell-shape') : null;
      if (host) {
        host.innerHTML = markup
          ? '<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">' + markup + '</svg>'
          : '';
        if (shapeDisp) shapeDisp.style.visibility = 'hidden';
      } else {
        const svg = document.getElementById('shape-svg');
        if (svg) svg.innerHTML = markup;
        if (shapeDisp) shapeDisp.style.visibility = 'visible';
      }
    } else {
      if (shapeDisp) shapeDisp.style.visibility = 'hidden';
    }

    // Audio: terminate any previous trial's audio before presenting the next stimulus.
    AudioEngine.stopAll();

    // Audio
    if (this.engine.activeStimuli.includes('aud')) {
      AudioEngine.stopAll();
      AudioEngine.speak(trial.audWord);
    }

    // Fixed timeline: stimulus removal and trial advancement are both
    // scheduled from the same trial start. Audio playback never controls timing.
    const stimulusMs = Math.max(500, Math.min(800, s.stimDur || TRIAL_TIMING.stimulusMs));
    const isiMs = this.engine.getISI();
    const totalMs = stimulusMs + isiMs;
    const trialStartedAt = performance.now();

    const hideStimulus = () => {
      if (!this.engine.isRunning || this.engine.isPaused) return;
      this.clearGrid();
    };

    const advanceTrial = () => {
      if (!this.engine.isRunning || this.engine.isPaused) return;
      const remaining = Math.max(0, totalMs - (performance.now() - trialStartedAt));
      if (remaining > 8) {
        this.engine.trialAdvanceTimeout = setTimeout(advanceTrial, remaining);
        return;
      }
      this.clearGrid();
      if (s.tally) {
        const inter = document.getElementById('inter-msg');
        if (inter) { inter.textContent = 'PRESS SPACE'; inter.classList.add('active'); }
        this.engine.isTrialActive = false;
        return;
      }
      this.showMissedFeedback();
      this.engine.currentTrial++;
      this.engine.trialTimeout = null;
      this.engine.trialAdvanceTimeout = null;
      this.runTrial();
    };

    this.engine.trialTimeout = setTimeout(hideStimulus, stimulusMs);
    this.engine.trialAdvanceTimeout = setTimeout(advanceTrial, totalMs);
  },

  advanceTally() {
    const inter = document.getElementById('inter-msg');
    if (inter) inter.classList.remove('active');
    this.showMissedFeedback();
    this.engine.currentTrial++;
    this.runTrial();
  },

  clearGrid() {
    this.clearWordInterference();
    const s = this.engine.getSettings();
    if (s.gridType === '3d') {
      ThreeDGrid.clearStimulus();
    } else {
      document.querySelectorAll('.cell-2d').forEach(c => {
        c.classList.remove('active');
        const img = c.querySelector('.face-img');
        const fb = c.querySelector('.face-fallback');
        if (img) { img.style.display = 'none'; }
        if (fb) fb.style.display = 'none';
      });
    }
    const shapeDisp = document.getElementById('shape-display');
    if (shapeDisp) shapeDisp.style.visibility = 'hidden';
  },

  processFeedback(type) {
    this.engine.responses[type][this.engine.currentTrial] = true;
    const k = this.engine.kSeq[this.engine.currentTrial];
    let isTarget = false;
    if (this.engine.currentTrial >= k) {
      const current = this.engine.trials[this.engine.currentTrial];
      const previous = this.engine.trials[this.engine.currentTrial - k];
      if (type === 'aud') isTarget = current.audWord === previous.audWord;
      else if (type === 'pos') isTarget = current.pos === previous.pos;
      else if (type === 'shp') isTarget = current.shp === previous.shp;
      else if (type === 'col') isTarget = current.col === previous.col;
    }
    this.flashIndicator(type, isTarget ? 'correct' : 'wrong');
    this.updateAccuracyHUD();
  },

  showMissedFeedback() {
    const k = this.engine.kSeq[this.engine.currentTrial];
    if (this.engine.currentTrial < k) return;
    let missedTarget = false;
    this.engine.activeStimuli.forEach(type => {
      const current = this.engine.trials[this.engine.currentTrial];
      const previous = this.engine.trials[this.engine.currentTrial - k];
      let isTarget = false;
      if (type === 'aud') isTarget = current.audWord === previous.audWord;
      else if (type === 'pos') isTarget = current.pos === previous.pos;
      else if (type === 'shp') isTarget = current.shp === previous.shp;
      else if (type === 'col') isTarget = current.col === previous.col;
      if (isTarget && !this.engine.responses[type][this.engine.currentTrial]) {
        missedTarget = true;
        // Its own status: a missed target and a false alarm are different
        // mistakes, and the button now says which one happened.
        this.flashIndicator(type, 'missed');
      }
    });
    if (missedTarget && this.engine.getSettings().buzzerOnMiss) AudioEngine.buzzMiss();
    this.updateAccuracyHUD();
  },

  flashIndicator(type, status) {
    if (!this.engine.getSettings().feedbackEnabled) return;

    // There are desktop and mobile copies of each response control. Apply
    // feedback to every matching control so the visible one always flashes.
    const controls = Array.from(document.querySelectorAll('.modality-btn[data-type="' + type + '"]'));
    if (!controls.length) return;

    controls.forEach(el => {
      el.classList.remove('correct', 'wrong', 'neutral', 'missed');
      void el.offsetWidth;
      el.classList.add(status);
    });

    setTimeout(() => {
      controls.forEach(el => el.classList.remove('correct', 'wrong', 'neutral', 'missed'));
    }, 350);
  },

  evaluateBlock() {
    const s = this.engine.getSettings();
    let blockHits = 0, blockMisses = 0, blockFA = 0, blockCR = 0;
    this.engine.activeStimuli.forEach(type => {
      const st = this.engine.stats[type];
      for (let i = 0; i < this.engine.blockTrials; i++) {
        const k = this.engine.kSeq[i];
        if (i < k) continue;
        const current = this.engine.trials[i];
        const previous = this.engine.trials[i - k];
        let isTarget = false;
        if (type === 'aud') isTarget = current.audWord === previous.audWord;
        else if (type === 'pos') isTarget = current.pos === previous.pos;
        else if (type === 'shp') isTarget = current.shp === previous.shp;
        else if (type === 'col') isTarget = current.col === previous.col;
        const responded = this.engine.responses[type][i];
        if (isTarget && responded) { st.hits++; blockHits++; }
        else if (isTarget && !responded) { st.misses++; blockMisses++; }
        else if (!isTarget && responded) { st.falseAlarms++; blockFA++; }
        else { st.correctRejects++; blockCR++; }
      }
    });

    const totalTargets = blockHits + blockMisses;
    const totalLures = blockFA + blockCR;
    let blockD = 0;
    if (totalTargets > 0 && totalLures > 0) {
      let hr = blockHits / totalTargets, far = blockFA / totalLures;
      if (hr >= 1) hr = 1 - 1/(2*totalTargets); if (hr <= 0) hr = 1/(2*totalTargets);
      if (far >= 1) far = 1 - 1/(2*totalLures); if (far <= 0) far = 1/(2*totalLures);
      blockD = inverseNormalCDF(hr) - inverseNormalCDF(far);
    }

    const hudD = document.getElementById('hud-dprime');
    if (hudD) hudD.textContent = blockD.toFixed(2);

    let transitionAction = 'maintaining';
    const previousN = this.engine.currentN;
    if (s.adaptive) {
      if (blockD > 2.2 && this.engine.currentN < 9) {
        this.engine.currentN++;
        transitionAction = 'advancing';
        if (this.engine.currentN > this.engine.highestN) this.engine.highestN = this.engine.currentN;
      } else if (blockD < 1.0 && this.engine.currentN > 1) {
        this.engine.currentN--;
        transitionAction = 'dropping';
      }
    }
    this.engine._lastBlockTransition = { action: transitionAction, previousN, nextN: this.engine.currentN, blockD };
    return this.engine._lastBlockTransition;
  },

  updateHUD() {
    const trial = document.getElementById('hud-trial');
    const dprime = document.getElementById('hud-dprime');
    const acc = document.getElementById('hud-acc');
    if (trial) trial.textContent = '0 / ' + this.engine.blockTrials;
    if (dprime) dprime.textContent = '0.00';
    if (acc) acc.textContent = '\u2014';
    this.updateLevelHUD();
  },

  /**
   * Accuracy so far, live, rather than only at the end of a block.
   *
   * D' is the honest measure and it is what the HUD had, but it only lands when
   * a block closes — so for the length of a block there was nothing to say how
   * it was going. Accuracy is coarser and available every trial, which is the
   * trade worth making for a number you glance at rather than analyse.
   *
   * Recomputed from the trials, the responses and the k for each one rather
   * than accumulated in counters, so it cannot drift from the block scoring:
   * it is the same definition applied to the same data, and there is only one
   * place the definition lives. A run is 240 trials, so the cost of doing it
   * from scratch each time is nothing.
   *
   * `hits / (hits + misses + false alarms)` — the formula the results screen
   * uses, so the number you watched during the run is the number you are shown
   * after it. Correct rejections are left out on purpose: with matches rare,
   * counting every trial you correctly said nothing about would sit the figure
   * near 90% and never move.
   */
  updateAccuracyHUD() {
    const el = document.getElementById('hud-acc');
    if (!el) return;

    let hits = 0, misses = 0, falseAlarms = 0;
    const upto = Math.min(this.engine.currentTrial + 1, this.engine.trials.length);

    for (let i = 0; i < upto; i++) {
      const k = this.engine.kSeq[i];
      if (i < k) continue;
      const current = this.engine.trials[i];
      const previous = this.engine.trials[i - k];
      if (!current || !previous) continue;

      this.engine.activeStimuli.forEach(type => {
        let isTarget = false;
        if (type === 'aud') isTarget = current.audWord === previous.audWord;
        else if (type === 'pos') isTarget = current.pos === previous.pos;
        else if (type === 'shp') isTarget = current.shp === previous.shp;
        else if (type === 'col') isTarget = current.col === previous.col;

        const responded = !!(this.engine.responses[type] && this.engine.responses[type][i]);
        if (isTarget && responded) hits++;
        else if (isTarget) misses++;
        else if (responded) falseAlarms++;
      });
    }

    const answered = hits + misses + falseAlarms;
    el.textContent = answered ? Math.round((100 * hits) / answered) + '%' : '\u2014';
  },

  togglePause() {
    if (!this.engine.isRunning) return;
    const btn = document.getElementById('btn-pause');
    if (!this.engine.isPaused) {
      this.engine.isPaused = true;
      this.engine.lastTick = Date.now();
      clearTimeout(this.engine.trialTimeout);
      clearTimeout(this.engine.trialAdvanceTimeout);
      try { window.speechSynthesis.cancel(); } catch(e) {}
      AudioEngine.stopAll();
      if (btn) btn.textContent = 'RESUME';
      this.clearGrid();
      this.showInterMsg('PAUSED', 999999);
    } else {
      this.engine.isPaused = false;
      this.engine.lastTick = Date.now();
      if (btn) btn.textContent = 'PAUSE';
      const inter = document.getElementById('inter-msg');
      if (inter) inter.classList.remove('active');
      this.engine.activeStimuli.forEach(t => { if (this.engine.responses[t][this.engine.currentTrial]) this.engine.responses[t][this.engine.currentTrial] = false; });
      this.runTrial();
    }
  },

  endSession(reason = 'manual') {
    // Stop WebGL immediately, not after the results screen appears.
    cleanupRenderers();

    this.engine.isRunning = false;
    this.engine.isTrialActive = false;
    clearTimeout(this.engine.trialTimeout);
    clearTimeout(this.engine.trialAdvanceTimeout);
    clearInterval(this.engine.timerInterval);
    try { window.speechSynthesis.cancel(); } catch(e) {}
    AudioEngine.stopAll();

    const now = Date.now();
    this.engine.sessionMs += (now - this.engine.lastTick);

    let totalHits = 0, totalMisses = 0, totalFA = 0, totalCR = 0;
    const modalityStats = [];
    this.engine.activeStimuli.forEach(type => {
      const st = this.engine.stats[type];
      totalHits += st.hits; totalMisses += st.misses;
      totalFA += st.falseAlarms; totalCR += st.correctRejects;
      const d = calculateDPrime(st.hits, st.misses, st.falseAlarms, st.correctRejects);
      const targets = st.hits + st.misses;
      const acc = targets > 0 ? (st.hits / (st.hits + st.falseAlarms + st.misses)) * 100 : 0;
      modalityStats.push({type: type, d: d, acc: acc, hits: st.hits, fa: st.falseAlarms, miss: st.misses});
    });

    const overallD = calculateDPrime(totalHits, totalMisses, totalFA, totalCR);
    const totalTargets = totalHits + totalMisses;
    const overallAcc = totalTargets > 0 ? (totalHits / (totalHits + totalFA + totalMisses)) * 100 : 0;

    StatsManager.addSession({
      timestamp: Date.now(),
      durationMs: this.engine.sessionMs,
      bestN: this.engine.highestN,
      overallDPrime: overallD,
      overallAccuracy: overallAcc,
      modalityStats: modalityStats,
      trialsCompleted: this.engine.sessionTrialsCompleted + this.engine.currentTrial,
      settings: this.engine.getSettings()
    });

    const resTime = document.getElementById('res-time');
    const resBestN = document.getElementById('res-best-n');
    const resD = document.getElementById('res-dprime');
    const resTrials = document.getElementById('res-trials');
    if (resTime) resTime.textContent = formatTime(this.engine.sessionMs);
    if (resBestN) resBestN.textContent = this.engine.highestN;
    if (resD) resD.textContent = overallD.toFixed(2);
    if (resTrials) resTrials.textContent = this.engine.sessionTrialsCompleted + this.engine.currentTrial;

    const breakdown = document.getElementById('modality-breakdown');
    if (breakdown) {
      /*
       * Misses get a column of their own.
       *
       * The table showed hits and false alarms, so a target you never answered
       * simply vanished from it — and that is the error worth seeing, because
       * it is the one that says the memory did not reach back far enough. A
       * false alarm says something different: the trigger was too light.
       */
      let html = `<div class="break-header"><span>Modality</span><span>D'</span><span>Acc%</span><span>Hits</span><span>Miss</span><span>FA</span></div>`;
      modalityStats.forEach(m => {
        /*
         * The same colour and glyph the button wore during the run, so a row
         * here is recognisably the thing you were pressing rather than a word
         * you have to map back onto it.
         */
        html += '<div class="break-row" style="--mod:' + (MOD_COLORS[m.type] || 'var(--cyan)') + '">'
          + '<span class="mod-name">'
            + '<svg class="mod-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">'
            + (MOD_ICONS[m.type] || '') + '</svg>'
            + MOD_LABELS[m.type]
          + '</span>'
          + '<span class="mod-dp">' + m.d.toFixed(2) + '</span>'
          + '<span class="mod-acc">' + Math.round(m.acc) + '%</span>'
          + '<span class="mod-hits">' + m.hits + '</span>'
          + '<span class="mod-miss">' + m.miss + '</span>'
          + '<span class="mod-fa">' + m.fa + '</span></div>';
      });
      /*
       * What to do about it, in a sentence.
       *
       * Four numbers per modality is a table you have to read across before it
       * says anything, and after a session nobody does. The strongest and
       * weakest by d' — which is the measure that already accounts for how
       * trigger-happy you were — plus which kind of error dominated, is the
       * part somebody would act on.
       */
      if (modalityStats.length > 1) {
        const ranked = modalityStats.slice().sort((a, b) => b.d - a.d);
        const best = ranked[0], worst = ranked[ranked.length - 1];
        const misses = modalityStats.reduce((n, m) => n + m.miss, 0);
        const fas = modalityStats.reduce((n, m) => n + m.fa, 0);

        let lean = '';
        if (misses + fas >= 4) {
          if (misses > fas * 1.6) lean = ' Most of your errors were <b>missed targets</b> — the reach back, not the trigger.';
          else if (fas > misses * 1.6) lean = ' Most of your errors were <b>false alarms</b> — the trigger, not the reach back.';
          else lean = ' Misses and false alarms were about even.';
        }

        html += '<div class="break-verdict">'
          + '<b style="color:' + (MOD_COLORS[best.type] || 'inherit') + '">' + MOD_LABELS[best.type] + '</b>'
          + " held up best (d' " + best.d.toFixed(2) + '), '
          + '<b style="color:' + (MOD_COLORS[worst.type] || 'inherit') + '">' + MOD_LABELS[worst.type] + '</b>'
          + " weakest (d' " + worst.d.toFixed(2) + ').' + lean + '</div>';
      }

      breakdown.innerHTML = html;
    }

    this.switchScreen('results');
    if (reason === 'duration') {
      const title = document.querySelector('#screen-results .results-panel h2');
      if (title) title.textContent = 'SESSION COMPLETE // TIME LIMIT';
    }
  },

  updateGlobalStats() {
    const d = StatsManager.data;
    const elTime = document.getElementById('stat-total-time');
    const elSess = document.getElementById('stat-sessions');
    const elBest = document.getElementById('stat-best-n');
    const elAvg = document.getElementById('stat-avg-d');
    if (elTime) elTime.textContent = Math.floor(d.totalMs / 60000);
    if (elSess) elSess.textContent = d.sessions.length;
    if (elBest) elBest.textContent = d.bestN;
    if (elAvg) elAvg.textContent = StatsManager.getAvgDPrime().toFixed(1);
  },

  showStatsFull() {
    const modal = document.getElementById('modal-dashboard');
    if (!modal) return;
    modal.classList.add('active');

    // Render heatmap
    const heatmap = document.getElementById('modal-heatmap');
    if (heatmap) {
      heatmap.innerHTML = '';
      StatsManager.getHeatmapData().forEach(d => {
        const cell = document.createElement('div');
        cell.className = 'heatmap-cell';
        cell.dataset.level = d.level;
        cell.title = d.date + ': ' + (d.level > 0 ? d.level + ' sessions' : 'No training');
        heatmap.appendChild(cell);
      });
    }

    // Render charts after modal is visible so canvas has size
    requestAnimationFrame(() => {
      const sessions = StatsManager.data.sessions;
      const dprimeData = sessions.slice(-20).map((s, i) => ({x: (i+1).toString(), y: s.overallDPrime || 0}));
      ChartRenderer.drawLine(document.getElementById('chart-dprime'), dprimeData, '#00f0ff', true);

      const modTotals = {pos:{hits:0, fa:0}, col:{hits:0, fa:0}, aud:{hits:0, fa:0}, shp:{hits:0, fa:0}};
      sessions.forEach(s => {
        if (s.modalityStats) {
          s.modalityStats.forEach(m => {
            if (modTotals[m.type]) { modTotals[m.type].hits += m.hits || 0; modTotals[m.type].fa += m.fa || 0; }
          });
        }
      });
      const modLabels = Object.keys(modTotals).filter(k => modTotals[k].hits + modTotals[k].fa > 0);
      const modAccs = modLabels.map(k => {
        const t = modTotals[k];
        const total = t.hits + t.fa;
        return total > 0 ? (t.hits / total) * 100 : 0;
      });
      ChartRenderer.drawBars(document.getElementById('chart-modality'), modLabels.map(k => MOD_LABELS[k] || k), modAccs, ['#00f0ff', '#ff006e', '#00ff88', '#ffaa00']);

      const tod = StatsManager.getTimeOfDayData();
      ChartRenderer.drawBars(document.getElementById('chart-tod'), ['Night', 'Morning', 'Afternoon', 'Evening'], tod, ['#4b5563', '#00f0ff', '#ffaa00', '#ff006e']);

      const nData = sessions.slice(-20).map((s, i) => ({x: (i+1).toString(), y: s.bestN || 1}));
      ChartRenderer.drawLine(document.getElementById('chart-nlevel'), nData, '#ff006e', false);
    });
  },

  closeModal() {
    const modal = document.getElementById('modal-dashboard');
    if (modal) modal.classList.remove('active');
  }
};

// Expose the controller globally for legacy inline handlers and debugging.
window.App = App;

// ==================== DOM READY ====================
const boot = () => {
  try { App.init(); } catch (error) {
    console.error('[ATTENTIONAL SHIELD] Initialization failed:', error);
    const msg = document.getElementById('inter-msg');
    if (msg) { msg.textContent = 'INITIALIZATION ERROR — OPEN CONSOLE'; msg.classList.add('active'); }
  }
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
else boot();
