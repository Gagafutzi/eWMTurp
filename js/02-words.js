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

const AFFECTIVE_WORD_BANK = {
  threat: [
    "TERROR", "PANIC", "AGONY", "HORROR", "SLAUGHTER",
    "SUFFOCATION", "FATAL", "RAGE", "SCREAM", "TORTURE",
    "SHELTERLESS", "EXECUTION", "EXPLOSION", "DISASTER", "AMBUSH",
    "HOSTAGE", "CHAOS", "MUTILATION", "VIOLENCE", "CRUELTY",
    "MASSACRE", "ASSAULT", "PERISH", "STRANGLE", "VENOM",
    "ANNIHILATION", "BLOODBATH", "DECIMATE", "AMPUTATE", "STRANGULATION",
    "PARALYSIS", "HEMORRHAGE", "ASPHYXIATION", "BUTCHERY", "CARNAGE"
  ],
  grief: [
    "DESPAIR", "ANGUISH", "BETRAYAL", "ISOLATION", "ABANDONED",
    "DEVASTATION", "TRAGEDY", "MISERY", "GRIEF", "HEARTBREAK",
    "LONELINESS", "HOPELESS", "SHATTERED", "HELPLESS", "LOSS",
    "REGRET", "CONDEMNED", "RUIN", "REJECTION", "MOURNING",
    "ORPHANED", "DESTITUTE", "FORSAKEN", "HOLLOW", "EXILE",
    "FORSAKEN", "DESOLATE", "CREMATION", "BEREAVED", "CONSUMED",
    "DECAYING", "STARK", "UNLAMENTED", "GODFORSAKEN", "INCURABLE"
  ],
  visceral: [
    "REVULSION", "DECAY", "CORRUPTION", "FOUL", "ROT",
    "CONTAMINATION", "NAUSEA", "INFESTATION", "POISON", "SICKNESS",
    "SEWAGE", "INFECTION", "MAGGOT", "FILTH", "SMEAR",
    "DISEASE", "PUTRID", "TOXIC", "DRAIN", "CANCER",
    "ULCER", "GORE", "BILE", "SEPTIC", "GANGRANE",
    "NECROSIS", "BIOLOGICAL", "EXUDATE", "PUS", "VISCERA",
    "MUCUS", "BIOMASS", "CONTAMINATED", "SORDID", "ULCEROUS"
  ],
  intensePositive: [
    "ECSTASY", "EUPHORIA", "RAPTURE", "PASSION", "BLISS",
    "TRIUMPH", "OBSESSION", "ADRENALINE", "EXHILARATION", "DEVOTION",
    "PARADISE", "DELIGHT", "THRILL", "VICTORY", "BELOVED",
    "INTOXICATION", "DESIRE", "CHERISH", "INFATUATION", "FEAST",
    "IMMORTAL", "SUPREME", "INVINCIBLE", "EUPHORIC",
    "APEX", "ELECTRIC", "UNSTOPPABLE", "GODLIKE", "TRANSCENDENT",
    "MAGNIFICENT", "UNBOUND", "SUPREMACY", "PHENOMENAL", "BLINDING"
  ],
  ambiguousShock: [
    "VOID", "UNHINGED", "HYSTERIA", "PARANOIA", "VULNERABLE",
    "CONFESSION", "SURREAL", "JUDGMENT", "REVELATION", "FATUM",
    "STALKER", "SECRETS", "HALLUCINATION", "OBSCURITY", "DELUSION",
    "SHADOW", "ECHO", "SUSPITION", "INVASION", "CONTAGION",
    "GLITCH", "ANOMALY", "MIRAGE", "DECEPTION", "PANOPTICON",
    "SCHIZOID", "LABYRINTH", "DISLOCATION", "WHISPER", "DOPPELGANGER",
    "UNCONSCIOUS", "AMNESIA", "SOMNAMBULIST", "PARALYSIS", "CIPHER"
  ],
  socialIsolation: [
    "IGNORED", "ABANDONED", "ISOLATED", "REJECTED", "EXCLUDED",
    "ALONE", "UNWANTED", "FORGOTTEN", "DISTANT", "OUTCAST",
    "INVISIBLE", "UNSEEN", "OSTRACIZED", "PARIAH", "EXILED",
    "QUARANTINED", "GHOST", "UNMOURNED", "REMOVED", "NULLIFIED",
    "DETACHED", "STRANDED", "EXTINCTION", "MONAD", "ANONYMOUS"
  ],
  sexual: [
    "CARNAL", "LUST", "ECSTATIC", "INTIMATE", "TEMPTATION",
    "SEDUCTION", "FLESH", "FORBIDDEN", "YEARNING", "ORGASM",
    "BONDAGE", "SKIN", "WARMTH", "HUNGER", "DOMINION",
    "SURRENDER", "POSSESSION", "MOAN", "BREATH", "RAPTURE",
    "FETISH", "OBSESSION", "ENTWINED", "EXPOSED", "APHRODISIAC",
    "SAVAGE", "LASCIVIOUS", "RAW", "GRAZING", "VOLUPTUOUS"
  ],
  spiritualSacred: [
    "SACRED", "DIVINE", "INFINITY", "ETERNAL", "TRANSCENDENT",
    "HOLY", "SOUL", "REDEMPTION", "BLINDING", "REVELATION",
    "SANCTUARY", "HALO", "ABSOLUTE", "GRACE", "PURITY",
    "COSMIC", "DAMNATION", "ALTAR", "PRAYER", "GLORY",
    "BLASPHEMY", "SERAPHIM", "MARTYRDOM", "ZEALOT", "APOCALYPSE",
    "PROPHESY", "OMNIPOTENT", "SANCTIFIED", "EXCOMMUNICATED", "DIVINITY"
  ],
  existentialDread: [
    "OBSOLETE", "MEANINGLESS", "NULL", "ABYSS", "PHANTOM",
    "TRANSIENT", "FUTILE", "INSIGNIFICANT", "ECLIPSE", "TERMINAL",
    "SILENCE", "WITHER", "VANISH", "SOLIPSISM", "DISSOLUTION",
    "NOTHINGNESS", "OBLIVION", "ENTROPY", "NIHIL", "ETERNITY",
    "UNMADE", "VANISHING", "INEVITABLE", "VACUUM", "NONEXISTENT"
  ],
  cyberneticHorror: [
    "OVERRIDE", "CORRUPTED", "MALWARE", "INTEGRITY", "FAIL", "DISCONNECTED",
    "SYNAPSE", "OVERLOAD", "PARASITE", "INVASION", "ANOMALY",
    "BLACKBOX", "TERMINATED", "RECURSION", "LOOP", "ERROR",
    "MUTATED", "UNRESPONSIVE", "BREACH", "ISOLATED", "HOST"
  ]
};

// Keep the original non-audio word pools for the visual/shape-word stimulus.
// ==================== ADVANCED VISUAL DISTRACTOR ====================
const WORD_INTERFERENCE_BANK = Object.freeze([
  'WINDOW','TABLE','PENCIL','RIVER','CHAIR','GARDEN','PAPER','CLOUD',
  'MIRROR','BRIDGE','FOREST','OCEAN','LAMP','CLOCK','DOOR','STONE',
  'WARNING','DANGER','URGENT','ALERT','THREAT','IMPACT','CRISIS','SHOCK',
  'FEAR','ANGER','LOSS','PANIC','HOPE','CALM','TRUST','DOUBT'
]);

function pickWordInterference() {
  return WORD_INTERFERENCE_BANK[
    Math.floor(Math.random() * WORD_INTERFERENCE_BANK.length)
  ];
}

const WORDS_NEGATIVE = ['Murder','Rape','Failure','Genocide','Retard','Hurt','Alone','Reject','Worthless','Disaster','Death','Pain','Trash','Loser','Betray'];
const WORDS_POSITIVE = ['Success','Victory','Gift','Miracle','Money','Loved','Triumph','Joy','Peace','Winner','Glory','Hero','Champion','Blessing','Proud'];
const WORDS_NEUTRAL  = [
  'Method','Process','System','Format','Factor','Aspect','Context','Detail','Section','Option',
  'Pattern','Structure','Framework','Principle','Element','Function','Sequence','Variable','Category','Concept',
  'Criterion','Strategy','Turpenstein','Parameter','Component'
];

const AFFECTIVE_AUDIO_WORDS = Object.values(AFFECTIVE_WORD_BANK).flat();
/*
 * The eight colour stimuli, chosen by maximising the smallest gap between any
 * two of them rather than by eye.
 *
 * The previous set had three pairs that were nearly the same colour. Measured
 * as OKLab distance, its closest pair -- red #FF453A against magenta #FF006E --
 * sat at 0.093, with yellow/orange at 0.133 and red/orange at 0.184 behind it.
 * That is a discrimination problem masquerading as a memory one: an n-back is
 * meant to tax what you can hold, not what you can tell apart, and a pair you
 * cannot separate on sight is scored as a memory failure it never was.
 *
 * These eight are the best 8-subset of the sRGB gamut under the constraints
 * that actually apply here: light and saturated enough to read as a small badge
 * over a photograph, at least 32 degrees of hue apart so no two share a name
 * (a colour you cannot name is a colour you cannot rehearse, and rehearsal is
 * the thing being trained), and separated under red-green colour blindness too.
 * The closest pair is now 0.203 -- 2.2x the old floor -- and every pair clears
 * it. Under deuteranopia the floor goes from 0.058 to 0.141.
 *
 * Roughly: blue, lilac, magenta, rust, gold, white, lime, mint.
 */
const COLORS = ['#4B7CF9','#CBA1FC','#F504A2','#E14F02','#E5AE0D','#F8F8F8','#DAFF1F','#30DDA4'];
const SHAPES_SVG = [
  '<circle cx="50" cy="50" r="42" fill="FILL" stroke="STROKE" stroke-width="4"/>',
  '<rect x="10" y="10" width="80" height="80" rx="10" fill="FILL" stroke="STROKE" stroke-width="4"/>',
  '<polygon points="50,8 90,88 10,88" fill="FILL" stroke="STROKE" stroke-width="4" stroke-linejoin="round"/>',
  '<polygon points="50,6 63,35 94,36 70,55 79,86 50,68 21,86 30,55 6,36 37,35" fill="FILL" stroke="STROKE" stroke-width="4" stroke-linejoin="round"/>',
  '<polygon points="50,8 92,28 92,72 50,92 8,72 8,28" fill="FILL" stroke="STROKE" stroke-width="4" stroke-linejoin="round"/>',
  '<path d="M50 8 L62 38 L94 38 L68 58 L78 90 L50 72 L22 90 L32 58 L6 38 L38 38 Z" fill="FILL" stroke="STROKE" stroke-width="4" stroke-linejoin="round"/>'
];
const MOD_LABELS = {pos:'Position', col:'Color', aud:'Audio', shp:'Shape'};
const MOD_INITIALS = {pos:'P', col:'C', aud:'A', shp:'S'};

/*
 * A colour and a picture per modality, used everywhere that modality appears.
 *
 * The response buttons said "P" and "S" over a keycap, which is two letters to
 * decode while a trial is running — and under time pressure the thing you need
 * is not a label you read but a target you recognise. One colour and one glyph,
 * repeated on the button, on the feedback flash and in the results breakdown,
 * means the same modality is the same object everywhere it is mentioned.
 *
 * Kept clear of the correct/wrong greens and reds, which have to stay
 * unambiguous on top of these.
 */
const MOD_COLORS = {
  pos: '#4da3ff',
  aud: '#c07cff',
  shp: '#ffb020',
  col: '#28d9c5'
};

/* Drawn rather than written: a glyph is recognised, a letter is read. */
const MOD_ICONS = {
  pos: '<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/>'
     + '<rect x="3" y="15" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1" opacity=".35"/>',
  aud: '<path d="M4 9h4l5-4v14l-5-4H4z"/>'
     + '<path d="M17 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
     + '<path d="M19.5 5.5a9 9 0 0 1 0 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".5"/>',
  shp: '<path d="M12 3l9 16H3z"/>',
  col: '<circle cx="9" cy="9" r="6"/><circle cx="15" cy="15" r="6" opacity=".45"/>'
};
