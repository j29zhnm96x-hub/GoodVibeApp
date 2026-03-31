# GoodVibes

GoodVibes is a focused static web PWA for seamless frequency playback with an optional ambience layer. The app is designed around a simple wellness flow: choose one frequency, optionally add one ambience underneath it, and keep playback stable across mobile usage patterns as well as the web platform allows.

GoodVibes is intended for relaxation, meditation, focus, reflection, and general wellness support. It is not medical treatment and should not be used as a substitute for professional care.

## What is included

- A frequency-first browser with real-time search
- A dedicated player for one selected main frequency
- An optional ambience layer with a separate volume control
- A shared Web Audio graph routed through a hidden carrier audio element for stronger iPhone background and lock-screen playback behavior
- Media Session metadata and transport handlers for play, pause, and stop
- A PWA manifest and a minimal shell-caching service worker

## Running locally

GoodVibes is a plain static site. Serve the folder with any static web server.

Examples:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

You can also host the folder directly on GitHub Pages or any other static host. Relative asset paths are already set up for static hosting.

## Expected audio asset paths

Place frequency assets in:

- `audio/frequencies/111hz.mp3`
- `audio/frequencies/123hz.mp3`
- `audio/frequencies/147hz.mp3`
- `audio/frequencies/174hz.mp3`
- `audio/frequencies/222hz.mp3`
- `audio/frequencies/258hz.mp3`
- `audio/frequencies/285hz.mp3`
- `audio/frequencies/333hz.mp3`
- `audio/frequencies/369hz.mp3`
- `audio/frequencies/396hz.mp3`
- `audio/frequencies/417hz.mp3`
- `audio/frequencies/432hz.mp3`
- `audio/frequencies/444hz.mp3`
- `audio/frequencies/456hz.mp3`
- `audio/frequencies/528hz.mp3`
- `audio/frequencies/555hz.mp3`
- `audio/frequencies/567hz.mp3`
- `audio/frequencies/639hz.mp3`
- `audio/frequencies/666hz.mp3`
- `audio/frequencies/693hz.mp3`
- `audio/frequencies/714hz.mp3`
- `audio/frequencies/741hz.mp3`
- `audio/frequencies/777hz.mp3`
- `audio/frequencies/825hz.mp3`
- `audio/frequencies/852hz.mp3`
- `audio/frequencies/888hz.mp3`
- `audio/frequencies/936hz.mp3`
- `audio/frequencies/963hz.mp3`
- `audio/frequencies/999hz.mp3`
- `audio/frequencies/1008hz.mp3`
- `audio/frequencies/1080hz.mp3`
- `audio/frequencies/1116hz.mp3`
- `audio/frequencies/1125hz.mp3`

Place optional ambience assets in:

- `audio/nature/rain_forest.mp3`
- `audio/noises/white_noise.mp3`
- `audio/noises/white_noise_432hz.mp3`
- `audio/soundscapes/ambiental_synth.mp3`

If a file is missing, GoodVibes keeps the app running and surfaces a clear unavailable message in the UI instead of crashing.

## How the iPhone background playback carrier works

GoodVibes uses one shared Web Audio graph:

- `AudioContext`
- `master GainNode`
- `MediaStreamDestination`
- hidden `audio#audioOut`

Main frequency playback and optional ambience playback both route into the shared `master` node. The `master` node feeds `mediaDest`, and the hidden `audioOut` element plays `mediaDest.stream`.

That hidden carrier element helps iPhone Safari and Add to Home Screen mode treat the output more like a managed media session, which improves the odds of background and lock-screen playback continuing. This is still subject to browser and OS policy, so behavior remains best-effort rather than guaranteed.

## Notes for asset management

- Add more frequencies by editing the `FREQUENCY_TRACKS` array in `tracks.js`.
- Add more ambience options by editing the `AMBIENCE_TRACKS` array in `tracks.js`.
- The service worker does not precache audio files by default, so large audio assets stay network-driven.

## PWA notes

- `manifest.json` configures installability with the GoodVibes name and standalone display mode.
- `service-worker.js` caches the app shell only.
- Placeholder icons are included in `icons/` and can be replaced with production artwork later.