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
    var t = timeMs * 0.001;

    /* ── Black void ── */
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    /* ── Living nebula sky — two colour poles slowly rotate ── */
    var poleA = paletteAt(t * 0.008);
    var poleB = paletteAt(t * 0.008 + 3);
    var nebA_x = width * (0.3 + Math.sin(t * 0.013) * 0.2);
    var nebA_y = height * (0.25 + Math.cos(t * 0.01) * 0.15);
    var nebB_x = width * (0.7 + Math.sin(t * 0.011 + 2) * 0.2);
    var nebB_y = height * (0.7 + Math.cos(t * 0.009 + 1) * 0.15);
    var nebR = Math.max(width, height) * 0.7;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    var gA = ctx.createRadialGradient(nebA_x, nebA_y, 0, nebA_x, nebA_y, nebR);
    gA.addColorStop(0, hsla({ h: poleA.h, s: poleA.s * 0.9, l: 18 }, 0.22));
    gA.addColorStop(0.35, hsla({ h: poleA.h, s: poleA.s * 0.6, l: 10 }, 0.10));
    gA.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gA;
    ctx.fillRect(0, 0, width, height);

    var gB = ctx.createRadialGradient(nebB_x, nebB_y, 0, nebB_x, nebB_y, nebR);
    gB.addColorStop(0, hsla({ h: poleB.h, s: poleB.s * 0.9, l: 16 }, 0.18));
    gB.addColorStop(0.35, hsla({ h: poleB.h, s: poleB.s * 0.5, l: 8 }, 0.08));
    gB.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gB;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    /* ── Stars — tiny twinkling points ── */
    ctx.save();
    for (var s = 0; s < 60; s += 1) {
      var sd = s * 13.37 + 1.1;
      var sx = ((Math.sin(sd) * 43758.5453) % 1 + 1) % 1;
      var sy = ((Math.cos(sd * 1.7) * 43758.5453) % 1 + 1) % 1;
      var twinkle = 0.2 + Math.sin(t * (0.4 + (s % 5) * 0.15) + sd) * 0.2;
      twinkle = Math.max(0, twinkle);
      var starSize = 0.5 + ((s * 3) % 7) * 0.18;
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = s % 8 === 0 ? '#ffe8c0' : s % 5 === 0 ? '#c0e8ff' : '#e0e8f0';
      ctx.beginPath();
      ctx.arc(sx * width, sy * height, starSize, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    /* ── Horizontal mist bands — 9 layers, dramatic speed difference ──
         Back layers (i=0): speed 0.06  — barely drifting
         Front layers (i=8): speed 1.8  — flowing fast past you
         This creates a powerful parallax / flying-through-clouds feel */
    var mist = [
      { y: 0.92, amp: 40, freq: 0.0015, speed: 0.06,  a: 0.04, l: 16 },
      { y: 0.84, amp: 50, freq: 0.002,  speed: 0.12,  a: 0.06, l: 14 },
      { y: 0.74, amp: 45, freq: 0.003,  speed: 0.22,  a: 0.09, l: 12 },
      { y: 0.64, amp: 38, freq: 0.004,  speed: 0.38,  a: 0.12, l: 10 },
      { y: 0.54, amp: 32, freq: 0.005,  speed: 0.60,  a: 0.14, l: 9  },
      { y: 0.44, amp: 26, freq: 0.007,  speed: 0.85,  a: 0.12, l: 8  },
      { y: 0.35, amp: 20, freq: 0.009,  speed: 1.10,  a: 0.09, l: 7  },
      { y: 0.27, amp: 16, freq: 0.012,  speed: 1.45,  a: 0.06, l: 6  },
      { y: 0.20, amp: 12, freq: 0.016,  speed: 1.80,  a: 0.04, l: 5  }
    ];

    for (var i = 0; i < mist.length; i += 1) {
      var m = mist[i];
      var by = height * m.y;
      var mc = paletteAt(t * 0.012 + i * 0.7);
      var ma = m.a + Math.sin(t * 0.07 + i * 1.3) * 0.02;

      ctx.save();
      ctx.globalAlpha = Math.max(0.01, ma);

      /* Two sub-passes per layer for volume / thickness */
      for (var sub = 0; sub < 2; sub += 1) {
        var subOff = sub * m.amp * 0.35;
        var subAlpha = sub === 0 ? 1 : 0.5;
        ctx.globalAlpha = Math.max(0.01, ma * subAlpha);

        ctx.beginPath();
        ctx.moveTo(-10, height + 10);

        for (var x = -10; x <= width + 12; x += 5) {
          var w1 = Math.sin(x * m.freq + t * m.speed + i * 1.7) * m.amp;
          var w2 = Math.sin(x * m.freq * 0.4 + t * m.speed * 0.6 + i * 2.9) * m.amp * 0.55;
          var w3 = Math.sin(x * m.freq * 2.3 + t * m.speed * 1.4 + i * 0.5) * m.amp * 0.18;
          var w4 = Math.sin(x * m.freq * 0.15 + t * m.speed * 0.25 + i * 4.1) * m.amp * 0.7;
          ctx.lineTo(x, by + w1 + w2 + w3 + w4 + subOff);
        }

        ctx.lineTo(width + 12, height + 10);
        ctx.closePath();

        var mfill = ctx.createLinearGradient(0, by - m.amp * 1.5, 0, by + height * 0.25);
        var mTop = { h: mc.h, s: mc.s * 0.8, l: mc.l + m.l };
        mfill.addColorStop(0, hsla(mTop, 0.75));
        mfill.addColorStop(0.2, hsla(mc, 0.45));
        mfill.addColorStop(0.55, hsla({ h: mc.h, s: mc.s * 0.4, l: mc.l * 0.5 }, 0.15));
        mfill.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = mfill;
        ctx.fill();
      }

      ctx.restore();
    }

    /* ── Glowing horizon line — soft light where sky meets mist ── */
    ctx.save();
    var hCol = paletteAt(t * 0.01 + 2);
    var horizonY = height * 0.55 + Math.sin(t * 0.03) * height * 0.02;
    var hGlow = ctx.createRadialGradient(width * 0.5, horizonY, 0, width * 0.5, horizonY, width * 0.6);
    hGlow.addColorStop(0, hsla({ h: hCol.h, s: hCol.s, l: hCol.l + 20 }, 0.08));
    hGlow.addColorStop(0.5, hsla({ h: hCol.h, s: hCol.s * 0.5, l: hCol.l + 10 }, 0.03));
    hGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hGlow;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    /* ── Rising light motes — 40 particles drifting upward slowly ── */
    ctx.save();
    for (var p = 0; p < 40; p += 1) {
      var sd2 = p * 7.31 + 3.7;
      var baseX = ((Math.sin(sd2) * 10000) % 1 + 1) % 1;
      var cycleT = 28 + (p % 9) * 6;
      var phase = ((t + sd2 * 3) % cycleT) / cycleT;

      var px = baseX * width + Math.sin(t * 0.05 + sd2) * width * 0.06;
      var py = height * (1.1 - phase * 1.3);

      var fadeIn = Math.min(1, phase * 5);
      var fadeOut = Math.min(1, (1 - phase) * 4);
      var pAlpha = fadeIn * fadeOut * (0.12 + Math.sin(t * 0.6 + sd2 * 2) * 0.08);
      pAlpha = Math.max(0, pAlpha);

      if (pAlpha < 0.01) continue;

      var pCol = paletteAt(t * 0.01 + p * 0.35);
      var pSize = 1.2 + Math.sin(sd2 * 4.3) * 0.8;
      var glowR = pSize * (5 + Math.sin(t * 0.3 + p) * 2);

      var pg = ctx.createRadialGradient(px, py, 0, px, py, glowR);
      pg.addColorStop(0, hsla({ h: pCol.h, s: pCol.s, l: Math.min(88, pCol.l + 35) }, pAlpha * 0.7));
      pg.addColorStop(0.5, hsla({ h: pCol.h, s: pCol.s * 0.5, l: pCol.l + 15 }, pAlpha * 0.2));
      pg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = pg;
      ctx.fillRect(px - glowR, py - glowR, glowR * 2, glowR * 2);

      ctx.fillStyle = hsla({ h: pCol.h, s: pCol.s * 0.4, l: Math.min(94, pCol.l + 45) }, pAlpha);
      ctx.beginPath();
      ctx.arc(px, py, pSize, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    /* ── Breathing core — slow pulsing radiance ── */
    ctx.save();
    var breath = Math.sin(t * 0.065) * 0.5 + 0.5;
    var bCol = paletteAt(t * 0.014 + 1.5);
    var bR = Math.min(width, height) * (0.18 + breath * 0.14);
    var bcx = width * 0.5 + Math.sin(t * 0.017) * width * 0.05;
    var bcy = height * 0.44 + Math.cos(t * 0.012) * height * 0.06;

    ctx.globalCompositeOperation = 'screen';
    var bg1 = ctx.createRadialGradient(bcx, bcy, 0, bcx, bcy, bR * 3);
    bg1.addColorStop(0, hsla({ h: bCol.h, s: bCol.s * 0.7, l: bCol.l + 18 }, 0.07 * breath));
    bg1.addColorStop(0.3, hsla({ h: bCol.h, s: bCol.s * 0.4, l: bCol.l + 8 }, 0.03 * breath));
    bg1.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg1;
    ctx.fillRect(0, 0, width, height);

    var bg2 = ctx.createRadialGradient(bcx, bcy, 0, bcx, bcy, bR);
    bg2.addColorStop(0, hsla({ h: bCol.h, s: bCol.s, l: Math.min(82, bCol.l + 28) }, 0.14 * breath));
    bg2.addColorStop(0.45, hsla({ h: bCol.h, s: bCol.s * 0.6, l: bCol.l + 12 }, 0.05 * breath));
    bg2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg2;
    ctx.beginPath();
    ctx.arc(bcx, bcy, bR, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    /* ── Vignette — curved darkness at edges ── */
    var vig = ctx.createRadialGradient(
      width * 0.5, height * 0.5, Math.min(width, height) * 0.28,
      width * 0.5, height * 0.5, Math.max(width, height) * 0.78
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(0.6, 'rgba(0,0,0,0.15)');
    vig.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);
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

  let wakeLockSentinel = null;

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
      const searchable = [track.title, track.id, track.description, track.details || ''].join(' ').toLowerCase();
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
    syncMasterOutputLevel({ ramp: 0.08, ignoreMain: true });

    if (settings.updateIntent !== false) syncPlaybackIntentFromSources();
    scheduleAudioOutputIdleCheck(150);
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
    syncMasterOutputLevel({ ramp: 0.08, ignoreAmbience: true });

    if (settings.updateIntent !== false) syncPlaybackIntentFromSources();
    scheduleAudioOutputIdleCheck(150);
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
        track.details ? '      <div class="card-details-wrap"><p class="card-details">' + track.details + '</p></div>' : '',
        track.details ? '      <button class="read-more-btn" type="button" data-action="toggle-details">Read more</button>' : '',
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
      ? selectedFrequency.description + (selectedFrequency.details ? ' ' + selectedFrequency.details : '')
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
    var heroToggle = document.getElementById('heroToggle');
    if (heroToggle) {
      heroToggle.addEventListener('click', function() {
        var hero = heroToggle.closest('.hero');
        if (hero) {
          hero.classList.toggle('is-expanded');
          heroToggle.textContent = hero.classList.contains('is-expanded') ? 'Read less' : 'Read more';
        }
      });
    }

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
      const readMoreBtn = event.target.closest('button[data-action="toggle-details"]');
      if (readMoreBtn) {
        const card = readMoreBtn.closest('.track-card');
        if (card) {
          card.classList.toggle('details-open');
          readMoreBtn.textContent = card.classList.contains('details-open') ? 'Read less' : 'Read more';
        }
        return;
      }

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

  async function requestWakeLock() {
    if (!('wakeLock' in navigator)) return false;
    try {
      wakeLockSentinel = await navigator.wakeLock.request('screen');
      wakeLockSentinel.addEventListener('release', function() {
        wakeLockSentinel = null;
        var checkbox = document.getElementById('stayAwake');
        if (checkbox) checkbox.checked = false;
      });
      return true;
    } catch {
      wakeLockSentinel = null;
      return false;
    }
  }

  function releaseWakeLock() {
    if (wakeLockSentinel) {
      try { wakeLockSentinel.release(); } catch {}
      wakeLockSentinel = null;
    }
  }

  function initWakeLock() {
    var checkbox = document.getElementById('stayAwake');
    if (!checkbox) return;

    if (!('wakeLock' in navigator)) {
      checkbox.disabled = true;
      var support = checkbox.closest('.wake-lock-card');
      if (support) {
        var note = support.querySelector('.support');
        if (note) note.textContent = 'Wake Lock is not supported in this browser.';
      }
      return;
    }

    checkbox.addEventListener('change', function() {
      if (checkbox.checked) {
        requestWakeLock().then(function(ok) {
          if (!ok) checkbox.checked = false;
        });
      } else {
        releaseWakeLock();
      }
    });

    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'visible' && checkbox.checked && !wakeLockSentinel) {
        requestWakeLock().then(function(ok) {
          if (!ok) checkbox.checked = false;
        });
      }
    });
  }

  function initTabs() {
    var tabBar = document.querySelector('.tab-bar');
    if (!tabBar) return;

    var isDesktop = window.matchMedia('(min-width: 960px) and (min-height: 760px)');
    var panels = document.querySelectorAll('[data-tab-panel]');
    var buttons = tabBar.querySelectorAll('.tab-btn');

    function applyTabMode(useTabMode) {
      if (useTabMode) {
        document.documentElement.classList.add('tab-mode');
        var activeTab = tabBar.querySelector('.tab-btn.is-active');
        var activeId = activeTab ? activeTab.getAttribute('data-tab') : 'player';
        switchTab(activeId);
      } else {
        document.documentElement.classList.remove('tab-mode');
        for (var i = 0; i < panels.length; i++) {
          panels[i].classList.add('tab-visible');
        }
      }
    }

    function switchTab(tabId) {
      for (var i = 0; i < panels.length; i++) {
        if (panels[i].getAttribute('data-tab-panel') === tabId) {
          panels[i].classList.add('tab-visible');
        } else {
          panels[i].classList.remove('tab-visible');
        }
      }
      for (var j = 0; j < buttons.length; j++) {
        if (buttons[j].getAttribute('data-tab') === tabId) {
          buttons[j].classList.add('is-active');
        } else {
          buttons[j].classList.remove('is-active');
        }
      }
    }

    tabBar.addEventListener('click', function(event) {
      var btn = event.target.closest('.tab-btn');
      if (!btn) return;
      var tabId = btn.getAttribute('data-tab');
      if (tabId) switchTab(tabId);
    });

    isDesktop.addEventListener('change', function(event) {
      applyTabMode(!event.matches);
    });

    applyTabMode(!isDesktop.matches);
  }

  function init() {
    cacheDom();
    bindEvents();
    ensureMediaSessionHandlers();
    initLandscapeViz();
    initTabs();
    initWakeLock();
    render();
    registerServiceWorker();
  }

  init();
})();