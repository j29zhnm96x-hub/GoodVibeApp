const FREQUENCY_TRACKS = [
  { id: '111hz', title: '111 Hz', file: 'audio/frequencies/111hz.mp3', description: 'Clarity, alignment, and a gentle mental reset.' },
  { id: '123hz', title: '123 Hz', file: 'audio/frequencies/123hz.mp3', description: 'Grounding and emotional balance with a soft stabilizing feel.' },
  { id: '147hz', title: '147 Hz', file: 'audio/frequencies/147hz.mp3', description: 'Clear thinking, focus, and reduced mental fog.' },
  { id: '174hz', title: '174 Hz', file: 'audio/frequencies/174hz.mp3', description: 'Deep grounding, comfort, and a sense of safety.' },
  { id: '222hz', title: '222 Hz', file: 'audio/frequencies/222hz.mp3', description: 'Balance, harmony, and relational calm.' },
  { id: '258hz', title: '258 Hz', file: 'audio/frequencies/258hz.mp3', description: 'Nurturing renewal and restorative stillness.' },
  { id: '285hz', title: '285 Hz', file: 'audio/frequencies/285hz.mp3', description: 'Restoration, recovery, and deep replenishing energy.' },
  { id: '333hz', title: '333 Hz', file: 'audio/frequencies/333hz.mp3', description: 'Creativity, expansion, and inner growth.' },
  { id: '369hz', title: '369 Hz', file: 'audio/frequencies/369hz.mp3', description: 'Release of heaviness and a sense of universal alignment.' },
  { id: '396hz', title: '396 Hz', file: 'audio/frequencies/396hz.mp3', description: 'Letting go of fear, guilt, and emotional weight.' },
  { id: '417hz', title: '417 Hz', file: 'audio/frequencies/417hz.mp3', description: 'Change, movement, and clearing old patterns.' },
  { id: '432hz', title: '432 Hz', file: 'audio/frequencies/432hz.mp3', description: 'Harmony, softness, and connection with nature.' },
  { id: '444hz', title: '444 Hz', file: 'audio/frequencies/444hz.mp3', description: 'Stability, protection, and steady foundations.' },
  { id: '456hz', title: '456 Hz', file: 'audio/frequencies/456hz.mp3', description: 'Heart-centered calm and gentle connection.' },
  { id: '528hz', title: '528 Hz', file: 'audio/frequencies/528hz.mp3', description: 'Transformation, uplift, and warmth.' },
  { id: '555hz', title: '555 Hz', file: 'audio/frequencies/555hz.mp3', description: 'Adaptability, transition, and openness to change.' },
  { id: '567hz', title: '567 Hz', file: 'audio/frequencies/567hz.mp3', description: 'Completion, release, and reflective closure.' },
  { id: '639hz', title: '639 Hz', file: 'audio/frequencies/639hz.mp3', description: 'Connection, communication, and relational harmony.' },
  { id: '666hz', title: '666 Hz', file: 'audio/frequencies/666hz.mp3', description: 'Balance between the practical and the spiritual.' },
  { id: '693hz', title: '693 Hz', file: 'audio/frequencies/693hz.mp3', description: 'Forgiveness, softness, and emotional release.' },
  { id: '714hz', title: '714 Hz', file: 'audio/frequencies/714hz.mp3', description: 'Problem-solving, insight, and intuitive clarity.' },
  { id: '741hz', title: '741 Hz', file: 'audio/frequencies/741hz.mp3', description: 'Cleansing, expression, and mental clarity.' },
  { id: '777hz', title: '777 Hz', file: 'audio/frequencies/777hz.mp3', description: 'Inner wisdom, intuition, and spiritual reflection.' },
  { id: '825hz', title: '825 Hz', file: 'audio/frequencies/825hz.mp3', description: 'Peace, quiet mind, and emotional settling.' },
  { id: '852hz', title: '852 Hz', file: 'audio/frequencies/852hz.mp3', description: 'Insight, inner vision, and spiritual order.' },
  { id: '888hz', title: '888 Hz', file: 'audio/frequencies/888hz.mp3', description: 'Flow, abundance, and vitality.' },
  { id: '936hz', title: '936 Hz', file: 'audio/frequencies/936hz.mp3', description: 'Meditative depth, pineal symbolism, and restfulness.' },
  { id: '963hz', title: '963 Hz', file: 'audio/frequencies/963hz.mp3', description: 'Unity, higher awareness, and contemplative stillness.' },
  { id: '999hz', title: '999 Hz', file: 'audio/frequencies/999hz.mp3', description: 'Closure, transition, and gentle release.' },
  { id: '1008hz', title: '1008 Hz', file: 'audio/frequencies/1008hz.mp3', description: 'Coherence, unity, and sacred-geometry-inspired calm.' },
  { id: '1080hz', title: '1080 Hz', file: 'audio/frequencies/1080hz.mp3', description: 'Deep meditation and expanded inner space.' },
  { id: '1116hz', title: '1116 Hz', file: 'audio/frequencies/1116hz.mp3', description: 'Intention, protection, and subtle strengthening.' },
  { id: '1125hz', title: '1125 Hz', file: 'audio/frequencies/1125hz.mp3', description: 'Surrender, deep reflection, and renewal.' }
];

const AMBIENCE_TRACKS = [
  { id: 'rain-forest', title: 'Rain Forest', file: 'audio/nature/rain_forest.mp3', category: 'Nature', description: 'A lush natural background for grounding and calm.' },
  { id: 'white-noise', title: 'White Noise', file: 'audio/noises/white_noise.mp3', category: 'Noise', description: 'A neutral masking layer for focus, sleep, or stillness.' },
  { id: 'white-noise-432', title: 'White Noise 432', file: 'audio/noises/white_noise_432hz.mp3', category: 'Noise', description: 'A softer white noise variant with a warmer feel.' },
  { id: 'ambiental-synth', title: 'Ambient Synth', file: 'audio/soundscapes/ambiental_synth.mp3', category: 'Soundscape', description: 'A gentle airy soundscape for meditation and relaxation.' }
];

window.GoodVibesData = Object.freeze({
  FREQUENCY_TRACKS: Object.freeze(FREQUENCY_TRACKS.slice()),
  AMBIENCE_TRACKS: Object.freeze(AMBIENCE_TRACKS.slice())
});