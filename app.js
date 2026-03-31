(function () {
  const data = window.GoodVibesData || {};
  const FREQUENCY_TRACKS = Array.isArray(data.FREQUENCY_TRACKS) ? data.FREQUENCY_TRACKS : [];
  const AMBIENCE_TRACKS = Array.isArray(data.AMBIENCE_TRACKS) ? data.AMBIENCE_TRACKS : [];

  const frequencyById = new Map(FREQUENCY_TRACKS.map((track) => [track.id, track]));
  const ambienceById = new Map(AMBIENCE_TRACKS.map((track) => [track.id, track]));
  const audioBufferCache = new Map();
  const audioLoadPromises = new Map();
  const assetStates = new Map();

  const state = {
    searchQuery: '',
    selectedFrequencyId: FREQUENCY_TRACKS[0] ? FREQUENCY_TRACKS[0].id : null,
    selectedAmbienceId: AMBIENCE_TRACKS[0] ? AMBIENCE_TRACKS[0].id : null,
    ambienceEnabled: false,
    mainVolume: 0.9,
    ambienceVolume: 0.35,
    statusMessage: 'Ready when you are.',
    statusTone: 'neutral'
  };

  const dom = {};

  /* ── Landscape atmosphere (full-screen canvas on phone rotate) ── */
  var vizCanvas = null;
  var vizCtx = null;
  var vizRafId = 0;

  var LANDSCAPE_PALETTE = [
    { h: 186, s: 32, l: 45 },
    { h: 166, s: 23, l: 52 },
    { h: 201, s: 24, l: 39 },
    { h: 42, s: 34, l: 68 },
    { h: 26, s: 33, l: 60 },
    { h: 214, s: 22, l: 36 }
  ];

  function isMobileDevice() {
    try {
      if ('ontouchstart' in window && navigator.maxTouchPoints > 0) {
        var w = screen.width || window.innerWidth;
        if (w < 1024) return true;
      }
      return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
    } catch (e) {}
    return false;
  }

  function isLandscape() {
    try {
      if (window.matchMedia) {
        return window.matchMedia('(orientation: landscape)').matches;
      }
    } catch (e) {}
    return window.innerWidth > window.innerHeight;
  }

  function ensureVizCanvas() {
    if (!vizCanvas) vizCanvas = document.getElementById('viz');
    if (vizCanvas && !vizCtx) vizCtx = vizCanvas.getContext('2d');
  }

  function resizeVizCanvas() {
    ensureVizCanvas();
    if (!vizCanvas || !vizCtx) return;

    var dpr = window.devicePixelRatio || 1;
    var cssWidth = Math.max(1, window.innerWidth);
    var cssHeight = Math.max(1, window.innerHeight);
    var pixelWidth = Math.max(1, Math.floor(cssWidth * dpr));
    var pixelHeight = Math.max(1, Math.floor(cssHeight * dpr));

    if (vizCanvas.width !== pixelWidth) vizCanvas.width = pixelWidth;
    if (vizCanvas.height !== pixelHeight) vizCanvas.height = pixelHeight;

    vizCtx.setTransform(1, 0, 0, 1, 0, 0);
    vizCtx.scale(dpr, dpr);
  }

  function lerpColor(a, b, t) {
    return {
      h: a.h + ((((b.h - a.h) + 540) % 360) - 180) * t,
      s: a.s + (b.s - a.s) * t,
      l: a.l + (b.l - a.l) * t
    };
  }

  function paletteAt(pos) {
    var n = LANDSCAPE_PALETTE.length;
    var p = ((pos % n) + n) % n;
    var i = Math.floor(p);
    return lerpColor(LANDSCAPE_PALETTE[i], LANDSCAPE_PALETTE[(i + 1) % n], p - i);
  }

  function hsla(c, a) {
    return 'hsla(' + c.h.toFixed(1) + ',' + c.s.toFixed(1) + '%,' + c.l.toFixed(1) + '%,' + a.toFixed(3) + ')';
  }

  function drawMeditationFrame(ctx, width, height, timeMs) {
    var t = timeMs * 0.00025;

    ctx.clearRect(0, 0, width, height);

    /* Dark meditation background gradient */
    var bg = ctx.createLinearGradient(0, 0, 0, height);
    var bgA = paletteAt(t * 0.12);
    var bgB = paletteAt(t * 0.12 + 2);
    bg.addColorStop(0, hsla({ h: bgA.h, s: bgA.s * 0.4, l: 8 }, 1));
    bg.addColorStop(0.55, hsla({ h: (bgA.h + bgB.h) / 2, s: 18, l: 13 }, 1));
    bg.addColorStop(1, hsla({ h: bgB.h, s: bgB.s * 0.5, l: 17 }, 1));
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    /* Smoke / cloud wisps — soft wave layers */
    ctx.save();
    ctx.globalAlpha = 0.2;

    for (var i = 0; i < 5; i += 1) {
      var baseY = height * (0.18 + i * 0.15);
      var amplitude = 24 + i * 10;
      var frequency = 0.006 + i * 0.0012;
      var speed = 0.7 + i * 0.18;
      var phase = i * 1.7;
      var waveColor = paletteAt(t * 0.15 + i * 0.9);

      ctx.beginPath();
      ctx.moveTo(0, height);

      for (var x = 0; x <= width + 12; x += 12) {
        var y = baseY + Math.sin(x * frequency + t * speed + phase) * amplitude;
        ctx.lineTo(x, y);
      }

      ctx.lineTo(width, height);
      ctx.closePath();

      var fill = ctx.createLinearGradient(0, baseY - amplitude, 0, height);
      fill.addColorStop(0, hsla(waveColor, 0.35));
      fill.addColorStop(1, hsla(waveColor, 0));
      ctx.fillStyle = fill;
      ctx.fill();
    }

    ctx.restore();

    /* Radial glow orbs — drifting meditation lights */
    ctx.save();
    ctx.globalAlpha = 0.14;

    for (var j = 0; j < 12; j += 1) {
      var orbX = ((j * 137.5) + timeMs * (0.01 + j * 0.0008)) % (width + 240) - 120;
      var orbY = height * (0.15 + ((j * 0.073) % 0.7));
      var radius = 80 + (j % 4) * 28;
      var orbColor = paletteAt(t * 0.1 + j * 0.5);

      var glow = ctx.createRadialGradient(orbX, orbY, 0, orbX, orbY, radius);
      glow.addColorStop(0, hsla({ h: orbColor.h, s: orbColor.s, l: orbColor.l + 20 }, 0.55));
      glow.addColorStop(1, hsla(orbColor, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(orbX, orbY, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function startViz() {
    ensureVizCanvas();
    if (!vizCanvas || !vizCtx) return;
    if (vizRafId) return;

    var draw = function (timeMs) {
      if (!isLandscape()) {
        vizRafId = 0;
        return;
      }

      resizeVizCanvas();

      var w = window.innerWidth;
      var h = window.innerHeight;
      if (!w || !h) {
        vizRafId = requestAnimationFrame(draw);
        return;
      }

      drawMeditationFrame(vizCtx, w, h, timeMs);
      vizRafId = requestAnimationFrame(draw);
    };

    vizRafId = requestAnimationFrame(draw);
  }

  function stopViz() {
    if (vizRafId) {
      cancelAnimationFrame(vizRafId);
      vizRafId = 0;
    }
    ensureVizCanvas();
    if (vizCanvas && vizCtx) {
      vizCtx.clearRect(0, 0, vizCanvas.width, vizCanvas.height);
    }
  }

  function updateLandscapeState() {
    var shell = document.querySelector('.app-shell');

    if (!isMobileDevice()) {
      document.documentElement.classList.remove('landscape');
      if (shell) shell.removeAttribute('aria-hidden');
      stopViz();
      return;
    }

    var landscape = isLandscape();
    document.documentElement.classList.toggle('landscape', landscape);

    if (shell) {
      if (landscape) shell.setAttribute('aria-hidden', 'true');
      else shell.removeAttribute('aria-hidden');
    }

    if (landscape) startViz();
    else stopViz();
  }

  function queueLandscapeUpdate(delayMs) {
    setTimeout(function () { updateLandscapeState(); }, delayMs || 50);
  }

  function initLandscapeViz() {
    window.addEventListener('resize', function () { updateLandscapeState(); });
    window.addEventListener('orientationchange', function () { queueLandscapeUpdate(50); });
    window.addEventListener('pageshow', function () { queueLandscapeUpdate(0); });
    window.addEventListener('focus', function () { queueLandscapeUpdate(0); });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) queueLandscapeUpdate(0);
    });
    queueLandscapeUpdate(0);
  }
  /* ── End landscape atmosphere ── */

  let mainTrackId = null;
  let ambienceTrackId = null;
  let mainLoadToken = 0;
  let ambienceLoadToken = 0;

  let audioCtx;
  let master;
  let mediaDest;
  let audioOut;
  let mediaSessionHandlersSet = false;
  let audioOutRecoveryHandlersSet = false;
  let audioEnvironmentRecoveryHandlersSet = false;

  let mediaPlaybackIntent = {
    kind: 'none',
    frequencyId: null,
    ambienceId: null
  };

  let mainSource = null;
  let mainGain = null;
  let ambienceSource = null;
  let ambienceGain = null;

  function ensureAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      master = audioCtx.createGain();
      master.gain.value = 0;
      mediaDest = audioCtx.createMediaStreamDestination();
      master.connect(mediaDest);

      audioOut = document.getElementById('audioOut');
      if (audioOut) {
        audioOut.srcObject = mediaDest.stream;
        audioOut.autoplay = true;
        audioOut.preload = 'auto';
        audioOut.playsInline = true;
        audioOut.setAttribute('playsinline', '');
        audioOut.setAttribute('webkit-playsinline', 'true');
        attachAudioOutputRecoveryHandlers();
      }

      attachAudioEnvironmentRecoveryHandlers();
      ensureMediaSessionHandlers();
    }
  }

  function startOutputIfNeeded() {
    if (!audioOut) return;
    const playback = audioOut.play();
    if (playback && playback.catch) playback.catch(() => {});
  }

  function rememberMediaPlaybackIntent(kind, { frequencyId = null, ambienceId = null } = {}) {
    mediaPlaybackIntent = {
      kind: String(kind || 'none'),
      frequencyId,
      ambienceId
    };
  }

  function hasManagedPlayback({ ignoreMain = false, ignoreAmbience = false } = {}) {
    const mainActive = !ignoreMain && !!mainSource;
    const ambienceActive = !ignoreAmbience && !!ambienceSource;
    return mainActive || ambienceActive;
  }

  function syncMasterOutputLevel({ ramp = 0.03, ignoreMain = false, ignoreAmbience = false } = {}) {
    if (!audioCtx || !master) return;
    const target = hasManagedPlayback({ ignoreMain, ignoreAmbience }) ? 1 : 0;
    const now = audioCtx.currentTime;
    try {
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      if (!ramp || ramp <= 0) master.gain.setValueAtTime(target, now);
      else master.gain.linearRampToValueAtTime(target, now + Math.max(0, ramp));
    } catch {}
  }

  function pauseAudioOutputIfIdle() {
    if (!audioOut) return;
    if (hasManagedPlayback()) {
      startOutputIfNeeded();
      return;
    }
    try {
      audioOut.pause();
    } catch {}
  }

  function recoverAudioOutputIfNeeded({ resumeContext = false } = {}) {
    if (!audioOut) return;
    if (resumeContext && audioCtx && audioCtx.state === 'suspended') {
      try {
        const playback = audioCtx.resume();
        if (playback && playback.catch) playback.catch(() => {});
      } catch {}
    }
    if (hasManagedPlayback()) startOutputIfNeeded();
  }

  function scheduleAudioOutputIdleCheck(delayMs) {
    setTimeout(() => {
      syncMasterOutputLevel({ ramp: 0.02 });
      pauseAudioOutputIfIdle();
      syncMediaSessionPlaybackState();
    }, Math.max(0, delayMs || 0));
  }

  function attachAudioOutputRecoveryHandlers() {
    if (audioOutRecoveryHandlersSet || !audioOut) return;
    const recover = () => {
      if (!hasManagedPlayback()) return;
      recoverAudioOutputIfNeeded({ resumeContext: true });
    };
    ['pause', 'ended', 'stalled', 'waiting', 'suspend', 'emptied'].forEach((eventName) => {
      audioOut.addEventListener(eventName, recover);
    });
    audioOutRecoveryHandlersSet = true;
  }

  function attachAudioEnvironmentRecoveryHandlers() {
    if (audioEnvironmentRecoveryHandlersSet || !audioCtx) return;

    const recoverLater = (delayMs) => {
      setTimeout(() => {
        if (!hasManagedPlayback()) return;
        recoverAudioOutputIfNeeded({ resumeContext: true });
      }, Math.max(0, delayMs || 0));
    };

    const handleStateChange = () => {
      if (!audioCtx || !hasManagedPlayback()) return;
      if (audioCtx.state === 'running') {
        recoverLater(0);
        return;
      }
      if (audioCtx.state === 'suspended') recoverLater(120);
    };

    try {
      if (audioCtx.addEventListener) audioCtx.addEventListener('statechange', handleStateChange);
      else audioCtx.onstatechange = handleStateChange;
    } catch {}

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
        navigator.mediaDevices.addEventListener('devicechange', () => recoverLater(160));
      }
    } catch {}

    audioEnvironmentRecoveryHandlersSet = true;
  }

  document.addEventListener('visibilitychange', () => {
    recoverAudioOutputIfNeeded({ resumeContext: true });
  });

  window.addEventListener('pageshow', () => {
    recoverAudioOutputIfNeeded({ resumeContext: true });
  });

  window.addEventListener('focus', () => {
    recoverAudioOutputIfNeeded({ resumeContext: true });
  });

  window.addEventListener('pagehide', () => {
    if (hasManagedPlayback()) recoverAudioOutputIfNeeded({ resumeContext: false });
  });

  function ensureMediaSessionHandlers() {
    if (mediaSessionHandlersSet || !('mediaSession' in navigator)) return;
    const mediaSession = navigator.mediaSession;

    const setHandler = (action, handler) => {
      try {
        mediaSession.setActionHandler(action, handler);
      } catch {}
    };

    setHandler('play', () => {
      resumePlaybackFromIntent();
    });

    setHandler('pause', () => {
      pauseAllPlayback();
    });

    setHandler('stop', () => {
      stopAllPlayback({ clearIntent: true });
    });

    mediaSessionHandlersSet = true;
  }

  function syncMediaSessionMetadata() {
    if (!('mediaSession' in navigator) || !window.MediaMetadata) return;

    const selectedFrequency = frequencyById.get(mainTrackId || state.selectedFrequencyId || '');
    const selectedAmbience = ambienceById.get(ambienceTrackId || state.selectedAmbienceId || '');

    let title = 'GoodVibes';
    let artist = 'Seamless frequency playback';

    if (mainSource && selectedFrequency && ambienceSource && selectedAmbience) {
      title = selectedFrequency.title;
      artist = 'With ' + selectedAmbience.title;
    } else if (mainSource && selectedFrequency) {
      title = selectedFrequency.title;
      artist = 'Frequency playback';
    } else if (ambienceSource && selectedAmbience) {
      title = selectedAmbience.title;
      artist = 'Optional ambience layer';
    } else if (selectedFrequency) {
      title = selectedFrequency.title;
      artist = 'Ready to play';
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
      album: 'GoodVibes',
      artwork: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
      ]
    });
  }

  function syncMediaSessionPlaybackState() {
    if (!('mediaSession' in navigator)) return;
    if (hasManagedPlayback()) {
      navigator.mediaSession.playbackState = 'playing';
      return;
    }
    navigator.mediaSession.playbackState = mediaPlaybackIntent.kind === 'none' ? 'none' : 'paused';
  }

  function setStatusMessage(message, tone) {
    state.statusMessage = message;
    state.statusTone = tone || 'neutral';
  }

  function getAssetState(trackId) {
    return assetStates.get(trackId) || { state: 'idle', message: '' };
  }

  function setAssetState(trackId, nextState, message) {
    assetStates.set(trackId, {
      state: nextState,
      message: message || ''
    });
  }

  function formatPercent(value) {
    return Math.round(value * 100) + '%';
  }

  function getSelectedFrequency() {
    return frequencyById.get(state.selectedFrequencyId || '') || null;
  }

  function getSelectedAmbience() {
    return ambienceById.get(state.selectedAmbienceId || '') || null;
  }

  function getFrequencyAvailabilityLabel(track) {
    if (!track) return 'Waiting to load';
    const asset = getAssetState(track.id);
    if (asset.state === 'ready') return 'Loaded on demand';
    if (asset.state === 'loading') return 'Loading';
    if (asset.state === 'missing') return 'Asset missing until the file is added';
    if (asset.state === 'error') return 'Could not decode the file';
    return 'Waiting to load';
  }

  function getPlaybackModeLabel() {
    if (mainSource && ambienceSource) return 'Frequency + ambience';
    if (mainSource) return 'Frequency only';
    if (ambienceSource) return 'Ambience only';
    return 'Idle';
  }

  function getPlayerStateLabel() {
    if (mainSource && mainTrackId) {
      const track = frequencyById.get(mainTrackId);
      return track ? track.title + ' playing' : 'Frequency playing';
    }
    return state.selectedFrequencyId ? 'Ready to play' : 'Choose a frequency';
  }

  function getAmbienceStateLabel() {
    if (ambienceSource && ambienceTrackId) {
      const track = ambienceById.get(ambienceTrackId);
      return track ? track.title + ' active' : 'Ambience active';
    }
    if (state.ambienceEnabled && state.selectedAmbienceId) return 'Enabled, waiting for playback';
    return 'Disabled';
  }

  function getPairingLabel() {
    const selectedAmbience = getSelectedAmbience();
    if (ambienceSource && selectedAmbience) return 'Currently layered with ' + selectedAmbience.title + '.';
    if (state.ambienceEnabled && selectedAmbience) return 'Ready to layer with ' + selectedAmbience.title + '.';
    return 'Optional ambience can be layered underneath.';
  }

  function getFilteredFrequencyTracks() {
    const query = state.searchQuery.trim().toLowerCase();
    if (!query) return FREQUENCY_TRACKS;

    return FREQUENCY_TRACKS.filter((track) => {
      const searchable = [track.title, track.id, track.description].join(' ').toLowerCase();
      return searchable.includes(query);
    });
  }

  function deriveIntentFromSources() {
    if (mainSource && ambienceSource) {
      return {
        kind: 'combo',
        frequencyId: mainTrackId,
        ambienceId: ambienceTrackId
      };
    }
    if (mainSource) {
      return {
        kind: 'main',
        frequencyId: mainTrackId,
        ambienceId: null
      };
    }
    if (ambienceSource) {
      return {
        kind: 'ambience',
        frequencyId: null,
        ambienceId: ambienceTrackId
      };
    }
    return {
      kind: 'none',
      frequencyId: null,
      ambienceId: null
    };
  }

  function syncPlaybackIntentFromSources() {
    const nextIntent = deriveIntentFromSources();
    rememberMediaPlaybackIntent(nextIntent.kind, nextIntent);
  }

  function decodeAudioDataAsync(context, arrayBuffer) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const complete = (callback, value) => {
        if (settled) return;
        settled = true;
        callback(value);
      };

      const sourceBuffer = arrayBuffer.slice ? arrayBuffer.slice(0) : arrayBuffer;

      try {
        const decodeResult = context.decodeAudioData(
          sourceBuffer,
          (decoded) => complete(resolve, decoded),
          (error) => complete(reject, error)
        );
        if (decodeResult && typeof decodeResult.then === 'function') {
          decodeResult.then((decoded) => complete(resolve, decoded)).catch((error) => complete(reject, error));
        }
      } catch (error) {
        complete(reject, error);
      }
    });
  }

  async function loadAudioBuffer(track) {
    ensureAudio();
    if (!track || !track.file) {
      const invalidError = new Error('Track metadata is incomplete.');
      invalidError.code = 'invalid';
      throw invalidError;
    }

    if (audioBufferCache.has(track.file)) return audioBufferCache.get(track.file);
    if (audioLoadPromises.has(track.file)) return audioLoadPromises.get(track.file);

    setAssetState(track.id, 'loading', 'Loading audio...');

    const loadPromise = (async () => {
      const response = await fetch(track.file, { cache: 'no-store' });
      if (!response.ok) {
        const missingError = new Error('Audio asset unavailable.');
        missingError.code = 'missing';
        throw missingError;
      }

      const audioData = await response.arrayBuffer();
      const buffer = await decodeAudioDataAsync(audioCtx, audioData);
      if (!buffer || !buffer.duration) {
        const decodeError = new Error('Audio asset could not be decoded.');
        decodeError.code = 'decode';
        throw decodeError;
      }

      audioBufferCache.set(track.file, buffer);
      setAssetState(track.id, 'ready', '');
      return buffer;
    })().catch((error) => {
      if (error && error.code === 'missing') {
        setAssetState(track.id, 'missing', track.title + ' is unavailable. Add ' + track.file + ' and try again.');
      } else {
        setAssetState(track.id, 'error', track.title + ' could not be decoded.');
      }
      throw error;
    }).finally(() => {
      audioLoadPromises.delete(track.file);
    });

    audioLoadPromises.set(track.file, loadPromise);
    return loadPromise;
  }

  async function resumeAudioContextIfNeeded() {
    ensureAudio();
    if (audioCtx && audioCtx.state === 'suspended') {
      try {
        await audioCtx.resume();
      } catch {}
    }
    startOutputIfNeeded();
  }

  function setGainVolume(gainNode, value, ramp) {
    if (!audioCtx || !gainNode) return;
    const now = audioCtx.currentTime;
    const duration = typeof ramp === 'number' ? ramp : 0.03;
    try {
      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setValueAtTime(gainNode.gain.value, now);
      if (duration <= 0) gainNode.gain.setValueAtTime(value, now);
      else gainNode.gain.linearRampToValueAtTime(value, now + duration);
    } catch {}
  }

  function fadeOutAndStopSource(sourceNode, gainNode, duration) {
    if (!audioCtx || !sourceNode) return;
    const fadeDuration = typeof duration === 'number' ? duration : 0.08;
    const now = audioCtx.currentTime;
    if (gainNode) {
      try {
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.linearRampToValueAtTime(0, now + fadeDuration);
      } catch {}
    }
    try {
      sourceNode.stop(now + fadeDuration + 0.01);
    } catch {}
    setTimeout(() => {
      try {
        sourceNode.disconnect();
      } catch {}
      if (gainNode) {
        try {
          gainNode.disconnect();
        } catch {}
      }
    }, Math.ceil((fadeDuration + 0.08) * 1000));
  }

  function createLoopingSource(buffer, targetVolume) {
    const sourceNode = audioCtx.createBufferSource();
    const gainNode = audioCtx.createGain();
    const now = audioCtx.currentTime;

    sourceNode.buffer = buffer;
    sourceNode.loop = true;

    gainNode.gain.setValueAtTime(0, now);
    sourceNode.connect(gainNode);
    gainNode.connect(master);

    sourceNode.start();
    gainNode.gain.linearRampToValueAtTime(targetVolume, now + 0.06);

    return { sourceNode, gainNode };
  }

  async function playFrequencyTrack(frequencyId, options) {
    const settings = options || {};
    const track = frequencyById.get(frequencyId || state.selectedFrequencyId || '');
    if (!track) {
      setStatusMessage('Choose a frequency to begin.', 'error');
      render();
      return false;
    }

    const previousSelectedId = state.selectedFrequencyId;
    const previousActiveId = mainTrackId;
    const requestToken = ++mainLoadToken;

    state.selectedFrequencyId = track.id;
    ensureAudio();
    if (settings.initiatedByUser) await resumeAudioContextIfNeeded();

    if (mainSource && mainTrackId === track.id) {
      recoverAudioOutputIfNeeded({ resumeContext: true });
      syncPlaybackIntentFromSources();
      syncMediaSessionMetadata();
      syncMediaSessionPlaybackState();
      if (!settings.suppressStatus) {
        setStatusMessage(track.title + ' is already playing.', 'neutral');
      }
      render();
      return true;
    }

    if (!settings.suppressStatus) {
      setStatusMessage('Loading ' + track.title + '...', 'neutral');
    }
    render();

    try {
      const buffer = await loadAudioBuffer(track);
      if (requestToken !== mainLoadToken) return false;

      ensureAudio();
      if (settings.initiatedByUser) await resumeAudioContextIfNeeded();

      const previousSource = mainSource;
      const previousGain = mainGain;
      const nextPlayback = createLoopingSource(buffer, state.mainVolume);

      mainSource = nextPlayback.sourceNode;
      mainGain = nextPlayback.gainNode;
      mainTrackId = track.id;

      mainSource.onended = () => {
        if (mainSource !== nextPlayback.sourceNode) return;
        mainSource = null;
        mainGain = null;
        mainTrackId = null;
        scheduleAudioOutputIdleCheck(20);
        render();
      };

      syncMasterOutputLevel({ ramp: 0.03 });
      startOutputIfNeeded();

      fadeOutAndStopSource(previousSource, previousGain, 0.08);
      syncPlaybackIntentFromSources();
      syncMediaSessionMetadata();
      syncMediaSessionPlaybackState();

      if (!settings.suppressStatus) {
        setStatusMessage(
          ambienceSource ? track.title + ' is playing with ambience.' : track.title + ' is playing.',
          'neutral'
        );
      }
      render();
      return true;
    } catch (error) {
      if (requestToken !== mainLoadToken) return false;
      if (previousActiveId && previousActiveId !== track.id && mainSource && mainTrackId === previousActiveId) {
        state.selectedFrequencyId = previousActiveId;
      } else if (previousSelectedId) {
        state.selectedFrequencyId = previousSelectedId;
      }

      const failureMessage = getAssetState(track.id).message || track.title + ' could not be loaded.';
      if (!settings.suppressStatus) setStatusMessage(failureMessage, 'error');
      syncPlaybackIntentFromSources();
      syncMediaSessionMetadata();
      syncMediaSessionPlaybackState();
      render();
      return false;
    }
  }

  async function playAmbienceTrack(ambienceId, options) {
    const settings = options || {};
    const track = ambienceById.get(ambienceId || state.selectedAmbienceId || '');
    if (!track) {
      setStatusMessage('Choose an ambience track to start the layer.', 'error');
      render();
      return false;
    }

    const previousSelectedId = state.selectedAmbienceId;
    const previousActiveId = ambienceTrackId;
    const requestToken = ++ambienceLoadToken;

    state.selectedAmbienceId = track.id;
    state.ambienceEnabled = true;
    ensureAudio();
    if (settings.initiatedByUser) await resumeAudioContextIfNeeded();

    if (ambienceSource && ambienceTrackId === track.id) {
      recoverAudioOutputIfNeeded({ resumeContext: true });
      syncPlaybackIntentFromSources();
      syncMediaSessionMetadata();
      syncMediaSessionPlaybackState();
      if (!settings.suppressStatus) {
        setStatusMessage(
          mainSource ? track.title + ' ambience is supporting the current frequency.' : track.title + ' ambience is playing.',
          'neutral'
        );
      }
      render();
      return true;
    }

    if (!settings.suppressStatus) {
      setStatusMessage('Loading ' + track.title + ' ambience...', 'neutral');
    }
    render();

    try {
      const buffer = await loadAudioBuffer(track);
      if (requestToken !== ambienceLoadToken || !state.ambienceEnabled) return false;

      ensureAudio();
      if (settings.initiatedByUser) await resumeAudioContextIfNeeded();

      const previousSource = ambienceSource;
      const previousGain = ambienceGain;
      const nextPlayback = createLoopingSource(buffer, state.ambienceVolume);

      ambienceSource = nextPlayback.sourceNode;
      ambienceGain = nextPlayback.gainNode;
      ambienceTrackId = track.id;

      ambienceSource.onended = () => {
        if (ambienceSource !== nextPlayback.sourceNode) return;
        ambienceSource = null;
        ambienceGain = null;
        ambienceTrackId = null;
        scheduleAudioOutputIdleCheck(20);
        render();
      };

      syncMasterOutputLevel({ ramp: 0.03 });
      startOutputIfNeeded();

      fadeOutAndStopSource(previousSource, previousGain, 0.08);
      syncPlaybackIntentFromSources();
      syncMediaSessionMetadata();
      syncMediaSessionPlaybackState();

      if (!settings.suppressStatus) {
        setStatusMessage(
          mainSource ? track.title + ' ambience is layered underneath the current frequency.' : track.title + ' ambience is playing.',
          'neutral'
        );
      }
      render();
      return true;
    } catch (error) {
      if (requestToken !== ambienceLoadToken) return false;

      if (previousActiveId && previousActiveId !== track.id && ambienceSource && ambienceTrackId === previousActiveId) {
        state.selectedAmbienceId = previousActiveId;
        state.ambienceEnabled = true;
      } else if (previousSelectedId) {
        state.selectedAmbienceId = previousSelectedId;
        state.ambienceEnabled = !!ambienceSource;
      } else {
        state.ambienceEnabled = false;
      }

      const failureMessage = getAssetState(track.id).message || track.title + ' could not be loaded.';
      if (!settings.suppressStatus) setStatusMessage(failureMessage, 'error');
      syncPlaybackIntentFromSources();
      syncMediaSessionMetadata();
      syncMediaSessionPlaybackState();
      render();
      return false;
    }
  }

  function stopMainPlayback(options) {
    const settings = options || {};
    ++mainLoadToken;

    const sourceToStop = mainSource;
    const gainToStop = mainGain;

    mainSource = null;
    mainGain = null;
    mainTrackId = null;

    fadeOutAndStopSource(sourceToStop, gainToStop, 0.05);
    syncMasterOutputLevel({ ramp: 0.02, ignoreMain: true });

    if (settings.updateIntent !== false) syncPlaybackIntentFromSources();
    scheduleAudioOutputIdleCheck(60);
    syncMediaSessionMetadata();
    syncMediaSessionPlaybackState();
    render();
  }

  function stopAmbiencePlayback(options) {
    const settings = options || {};
    ++ambienceLoadToken;

    const sourceToStop = ambienceSource;
    const gainToStop = ambienceGain;

    ambienceSource = null;
    ambienceGain = null;
    ambienceTrackId = null;

    if (settings.disableToggle) state.ambienceEnabled = false;

    fadeOutAndStopSource(sourceToStop, gainToStop, 0.05);
    syncMasterOutputLevel({ ramp: 0.02, ignoreAmbience: true });

    if (settings.updateIntent !== false) syncPlaybackIntentFromSources();
    scheduleAudioOutputIdleCheck(60);
    syncMediaSessionMetadata();
    syncMediaSessionPlaybackState();
    render();
  }

  function pauseAllPlayback() {
    if (!hasManagedPlayback()) {
      syncMediaSessionPlaybackState();
      return;
    }

    const pausedIntent = {
      kind: mainSource && ambienceSource ? 'combo' : mainSource ? 'main' : 'ambience',
      frequencyId: mainTrackId || state.selectedFrequencyId,
      ambienceId: ambienceTrackId || state.selectedAmbienceId
    };

    stopMainPlayback({ updateIntent: false });
    stopAmbiencePlayback({ updateIntent: false, disableToggle: false });
    rememberMediaPlaybackIntent(pausedIntent.kind, pausedIntent);
    setStatusMessage('Playback paused. Press play to restore the last active layer.', 'neutral');
    syncMediaSessionMetadata();
    syncMediaSessionPlaybackState();
    render();
  }

  function stopAllPlayback(options) {
    const settings = options || {};

    stopMainPlayback({ updateIntent: false });
    stopAmbiencePlayback({ updateIntent: false, disableToggle: true });

    if (settings.clearIntent) rememberMediaPlaybackIntent('none');
    setStatusMessage('Playback stopped.', 'neutral');
    syncMediaSessionMetadata();
    syncMediaSessionPlaybackState();
    render();
  }

  async function resumePlaybackFromIntent() {
    const intent = {
      kind: mediaPlaybackIntent.kind,
      frequencyId: mediaPlaybackIntent.frequencyId,
      ambienceId: mediaPlaybackIntent.ambienceId
    };

    if (intent.kind === 'combo') {
      state.ambienceEnabled = true;
      const frequencyId = intent.frequencyId || state.selectedFrequencyId;
      const ambienceId = intent.ambienceId || state.selectedAmbienceId;
      const mainStarted = frequencyId ? await playFrequencyTrack(frequencyId, { initiatedByUser: true, suppressStatus: true }) : false;
      const ambienceStarted = ambienceId ? await playAmbienceTrack(ambienceId, { initiatedByUser: false, suppressStatus: true }) : false;

      if (mainStarted || ambienceStarted) {
        setStatusMessage('Playback restored with frequency and ambience.', 'neutral');
      }
      render();
      return;
    }

    if (intent.kind === 'main') {
      const frequencyId = intent.frequencyId || state.selectedFrequencyId;
      if (frequencyId) await playFrequencyTrack(frequencyId, { initiatedByUser: true, suppressStatus: true });
      setStatusMessage('Frequency playback restored.', 'neutral');
      render();
      return;
    }

    if (intent.kind === 'ambience') {
      state.ambienceEnabled = true;
      const ambienceId = intent.ambienceId || state.selectedAmbienceId;
      if (ambienceId) await playAmbienceTrack(ambienceId, { initiatedByUser: true, suppressStatus: true });
      setStatusMessage('Ambience playback restored.', 'neutral');
      render();
      return;
    }

    if (state.selectedFrequencyId) {
      await playFrequencyTrack(state.selectedFrequencyId, { initiatedByUser: true, suppressStatus: true });
      setStatusMessage('Frequency playback started.', 'neutral');
      render();
    }
  }

  function selectFrequency(frequencyId, options) {
    const settings = options || {};
    if (!frequencyById.has(frequencyId)) return;
    state.selectedFrequencyId = frequencyId;

    if (settings.autoPlay || mainSource) {
      playFrequencyTrack(frequencyId, { initiatedByUser: settings.userInitiated, suppressStatus: false });
      return;
    }

    const track = frequencyById.get(frequencyId);
    setStatusMessage(track.title + ' is selected and ready to play.', 'neutral');
    syncMediaSessionMetadata();
    render();
  }

  function selectAmbience(ambienceId, options) {
    const settings = options || {};
    if (!ambienceById.has(ambienceId)) return;
    state.selectedAmbienceId = ambienceId;

    if (settings.autoPlay || ambienceSource || state.ambienceEnabled) {
      playAmbienceTrack(ambienceId, { initiatedByUser: settings.userInitiated, suppressStatus: false });
      return;
    }

    const track = ambienceById.get(ambienceId);
    setStatusMessage(track.title + ' is selected and ready if you enable ambience.', 'neutral');
    syncMediaSessionMetadata();
    render();
  }

  function renderFrequencyList() {
    const filteredTracks = getFilteredFrequencyTracks();
    dom.resultCount.textContent = filteredTracks.length + (filteredTracks.length === 1 ? ' result' : ' results');
    dom.emptyState.hidden = filteredTracks.length !== 0;

    dom.frequencyList.innerHTML = filteredTracks.map((track) => {
      const asset = getAssetState(track.id);
      const isSelected = track.id === state.selectedFrequencyId;
      const isPlaying = track.id === mainTrackId && !!mainSource;
      const isLoading = asset.state === 'loading';

      let badge = '';
      if (isPlaying) badge = '<span class="state-tag live">Playing</span>';
      else if (isSelected) badge = '<span class="state-tag">Selected</span>';

      let assetBadge = '';
      if (asset.state === 'loading') assetBadge = '<span class="asset-state">Loading</span>';
      if (asset.state === 'missing') assetBadge = '<span class="asset-state missing">Asset missing</span>';
      if (asset.state === 'error') assetBadge = '<span class="asset-state missing">Unavailable</span>';

      return [
        '<article class="track-card' + (isSelected ? ' is-selected' : '') + (isPlaying ? ' is-playing' : '') + '" role="listitem">',
        '  <div class="card-top">',
        '    <div>',
        '      <h3 class="track-title">' + track.title + '</h3>',
        '      <p class="card-description">' + track.description + '</p>',
        '    </div>',
        '    <div>' + badge + assetBadge + '</div>',
        '  </div>',
        '  <div class="card-actions">',
        '    <button class="card-button" type="button" data-action="select-frequency" data-frequency-id="' + track.id + '">',
        isSelected ? 'Selected' : 'Select',
        '    </button>',
        '    <button class="card-button primary" type="button" data-action="play-frequency" data-frequency-id="' + track.id + '"' + (isLoading ? ' disabled' : '') + '>',
        isPlaying ? 'Playing' : 'Play',
        '    </button>',
        '  </div>',
        '</article>'
      ].join('');
    }).join('');
  }

  function renderAmbienceList() {
    dom.ambienceList.innerHTML = AMBIENCE_TRACKS.map((track) => {
      const asset = getAssetState(track.id);
      const isSelected = track.id === state.selectedAmbienceId;
      const isPlaying = track.id === ambienceTrackId && !!ambienceSource;
      const isLoading = asset.state === 'loading';

      let badge = '';
      if (isPlaying) badge = '<span class="state-tag live">Active</span>';
      else if (isSelected) badge = '<span class="state-tag">Selected</span>';

      let assetBadge = '';
      if (asset.state === 'loading') assetBadge = '<span class="asset-state">Loading</span>';
      if (asset.state === 'missing') assetBadge = '<span class="asset-state missing">Asset missing</span>';
      if (asset.state === 'error') assetBadge = '<span class="asset-state missing">Unavailable</span>';

      return [
        '<article class="ambience-card' + (isSelected ? ' is-selected' : '') + (isPlaying ? ' is-playing' : '') + '" role="listitem">',
        '  <div class="ambience-top">',
        '    <div>',
        '      <p class="ambience-category">' + track.category + '</p>',
        '      <h3 class="ambience-title">' + track.title + '</h3>',
        '      <p class="card-description">' + track.description + '</p>',
        '    </div>',
        '    <div>' + badge + assetBadge + '</div>',
        '  </div>',
        '  <div class="card-actions">',
        '    <button class="card-button" type="button" data-action="select-ambience" data-ambience-id="' + track.id + '">',
        isSelected ? 'Selected' : 'Choose',
        '    </button>',
        '    <button class="card-button primary" type="button" data-action="play-ambience" data-ambience-id="' + track.id + '"' + (isLoading ? ' disabled' : '') + '>',
        isPlaying ? 'Playing' : 'Start',
        '    </button>',
        '  </div>',
        '</article>'
      ].join('');
    }).join('');
  }

  function renderSummaryPanels() {
    const selectedFrequency = getSelectedFrequency();
    const selectedAmbience = getSelectedAmbience();

    dom.selectedFrequencyTitle.textContent = selectedFrequency ? selectedFrequency.title : 'Choose a frequency';
    dom.selectedFrequencyDescription.textContent = selectedFrequency
      ? selectedFrequency.description
      : 'Browse the library and choose a track to begin.';

    dom.selectedAmbienceTitle.textContent = selectedAmbience ? selectedAmbience.title : 'Choose an ambience';
    dom.selectedAmbienceDescription.textContent = selectedAmbience
      ? selectedAmbience.description
      : 'Rain, noise, and soft soundscapes can be extended later by editing the ambience metadata array.';

    dom.playbackMode.textContent = getPlaybackModeLabel();
    dom.playerState.textContent = getPlayerStateLabel();
    dom.ambienceState.textContent = getAmbienceStateLabel();

    dom.mainVolume.value = String(state.mainVolume);
    dom.mainVolumeValue.textContent = formatPercent(state.mainVolume);
    dom.ambienceVolume.value = String(state.ambienceVolume);
    dom.ambienceVolumeValue.textContent = formatPercent(state.ambienceVolume);

    dom.ambienceEnabled.checked = state.ambienceEnabled;
    dom.playMainButton.disabled = !selectedFrequency;
    dom.stopMainButton.disabled = !mainSource;
    dom.startAmbienceButton.disabled = !selectedAmbience;
    dom.stopAmbienceButton.disabled = !ambienceSource && !state.ambienceEnabled;

    dom.detailTitle.textContent = selectedFrequency ? selectedFrequency.title : 'Choose a frequency';
    dom.detailDescription.textContent = selectedFrequency
      ? selectedFrequency.description
      : 'Descriptions remain visible here so the selected frequency is easy to read without opening extra panels.';
    dom.detailId.textContent = selectedFrequency ? selectedFrequency.id : '-';
    dom.detailPath.textContent = selectedFrequency ? selectedFrequency.file : 'audio/frequencies/';
    dom.detailAvailability.textContent = getFrequencyAvailabilityLabel(selectedFrequency);
    dom.detailPairing.textContent = getPairingLabel();

    if (mainSource && mainTrackId) dom.selectionBadge.textContent = 'Playing now';
    else if (selectedFrequency) dom.selectionBadge.textContent = 'Selected';
    else dom.selectionBadge.textContent = 'No selection';

    dom.statusMessage.textContent = state.statusMessage;
    dom.statusMessage.className = 'status-message' + (state.statusTone === 'error' ? ' error' : '');

    syncMediaSessionMetadata();
    syncMediaSessionPlaybackState();
  }

  function render() {
    renderSummaryPanels();
    renderFrequencyList();
    renderAmbienceList();
  }

  function bindEvents() {
    dom.searchInput.addEventListener('input', (event) => {
      state.searchQuery = event.target.value || '';
      renderFrequencyList();
    });

    dom.playMainButton.addEventListener('click', () => {
      playFrequencyTrack(state.selectedFrequencyId, { initiatedByUser: true });
    });

    dom.stopMainButton.addEventListener('click', () => {
      setStatusMessage(ambienceSource ? 'Frequency stopped. Ambience continues.' : 'Frequency stopped.', 'neutral');
      stopMainPlayback();
    });

    dom.mainVolume.addEventListener('input', (event) => {
      state.mainVolume = Number(event.target.value);
      setGainVolume(mainGain, state.mainVolume, 0.01);
      renderSummaryPanels();
    });

    dom.ambienceEnabled.addEventListener('change', (event) => {
      if (event.target.checked) {
        state.ambienceEnabled = true;
        if (state.selectedAmbienceId) {
          playAmbienceTrack(state.selectedAmbienceId, { initiatedByUser: true });
        } else {
          setStatusMessage('Choose an ambience track to enable the layer.', 'error');
          render();
        }
        return;
      }

      setStatusMessage(mainSource ? 'Ambience layer disabled. Frequency continues.' : 'Ambience disabled.', 'neutral');
      stopAmbiencePlayback({ disableToggle: true });
    });

    dom.startAmbienceButton.addEventListener('click', () => {
      state.ambienceEnabled = true;
      playAmbienceTrack(state.selectedAmbienceId, { initiatedByUser: true });
    });

    dom.stopAmbienceButton.addEventListener('click', () => {
      setStatusMessage(mainSource ? 'Ambience stopped. Frequency continues.' : 'Ambience stopped.', 'neutral');
      stopAmbiencePlayback({ disableToggle: true });
    });

    dom.ambienceVolume.addEventListener('input', (event) => {
      state.ambienceVolume = Number(event.target.value);
      setGainVolume(ambienceGain, state.ambienceVolume, 0.01);
      renderSummaryPanels();
    });

    dom.frequencyList.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action][data-frequency-id]');
      if (!button) return;

      const frequencyId = button.getAttribute('data-frequency-id');
      const action = button.getAttribute('data-action');
      if (action === 'select-frequency') {
        selectFrequency(frequencyId, { autoPlay: false, userInitiated: true });
      }
      if (action === 'play-frequency') {
        selectFrequency(frequencyId, { autoPlay: true, userInitiated: true });
      }
    });

    dom.ambienceList.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action][data-ambience-id]');
      if (!button) return;

      const ambienceId = button.getAttribute('data-ambience-id');
      const action = button.getAttribute('data-action');
      if (action === 'select-ambience') {
        selectAmbience(ambienceId, { autoPlay: false, userInitiated: true });
      }
      if (action === 'play-ambience') {
        selectAmbience(ambienceId, { autoPlay: true, userInitiated: true });
      }
    });
  }

  function cacheDom() {
    dom.root = document.documentElement;
    dom.playbackMode = document.getElementById('playbackMode');
    dom.selectedFrequencyTitle = document.getElementById('selectedFrequencyTitle');
    dom.selectedFrequencyDescription = document.getElementById('selectedFrequencyDescription');
    dom.playMainButton = document.getElementById('playMainButton');
    dom.stopMainButton = document.getElementById('stopMainButton');
    dom.mainVolume = document.getElementById('mainVolume');
    dom.mainVolumeValue = document.getElementById('mainVolumeValue');
    dom.playerState = document.getElementById('playerState');
    dom.ambienceState = document.getElementById('ambienceState');
    dom.statusMessage = document.getElementById('statusMessage');

    dom.resultCount = document.getElementById('resultCount');
    dom.searchInput = document.getElementById('searchInput');
    dom.frequencyList = document.getElementById('frequencyList');
    dom.emptyState = document.getElementById('emptyState');

    dom.ambienceEnabled = document.getElementById('ambienceEnabled');
    dom.selectedAmbienceTitle = document.getElementById('selectedAmbienceTitle');
    dom.selectedAmbienceDescription = document.getElementById('selectedAmbienceDescription');
    dom.startAmbienceButton = document.getElementById('startAmbienceButton');
    dom.stopAmbienceButton = document.getElementById('stopAmbienceButton');
    dom.ambienceVolume = document.getElementById('ambienceVolume');
    dom.ambienceVolumeValue = document.getElementById('ambienceVolumeValue');
    dom.ambienceList = document.getElementById('ambienceList');

    dom.selectionBadge = document.getElementById('selectionBadge');
    dom.detailTitle = document.getElementById('detailTitle');
    dom.detailDescription = document.getElementById('detailDescription');
    dom.detailId = document.getElementById('detailId');
    dom.detailPath = document.getElementById('detailPath');
    dom.detailAvailability = document.getElementById('detailAvailability');
    dom.detailPairing = document.getElementById('detailPairing');
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').then((registration) => {
        if (registration && registration.update) {
          registration.update().catch(() => {});
        }
      }).catch(() => {});
    });
  }

  function init() {
    cacheDom();
    bindEvents();
    ensureMediaSessionHandlers();
    initLandscapeViz();
    render();
    registerServiceWorker();
  }

  init();
})();