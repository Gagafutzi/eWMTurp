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
const COLORS = ['#FF453A','#30D158','#0A84FF','#FFD60A','#BF5AF2','#FF9F0A','#00F0FF','#FF006E'];
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
