import { get, set } from 'idb-keyval';
import { Card, MTGColor, ArchetypePace } from '../types/mtg';
import { supabase, isSupabaseConfigured } from './supabase';

export interface WOTCArchetype {
  code: string; // 'WU', 'UB', etc.
  colors: [MTGColor, MTGColor];
  name: string; // 'Eerie Rooms & Glimmer Tempo', etc.
  guildName?: string; // 'Azorius', etc.
  headline: string; // 'Birds • Fliers & Spells', etc.
  description: string; // Strategic description of archetype draft plan
  mechanics: string[];
  pace?: ArchetypePace;
  draftPointers?: string[];
  keyCommons?: string[];
}

export interface WOTCArchetypeInfo {
  name: string;
  guildName?: string;
  headline: string;
  description: string;
  mechanics: string[];
  pace?: ArchetypePace;
  draftPointers?: string[];
  keyCommons?: string[];
}

export const GUILD_ARCHETYPES: {
  colors: [MTGColor, MTGColor];
  code: string;
  name: string;
  defaultTheme: string;
}[] = [
  { colors: ['W', 'U'], code: 'WU', name: 'Azorius', defaultTheme: 'Flyers / Spells & Tempo' },
  { colors: ['U', 'B'], code: 'UB', name: 'Dimir', defaultTheme: 'Control / Card Advantage & Reanimation' },
  { colors: ['B', 'R'], code: 'BR', name: 'Rakdos', defaultTheme: 'Aggro / Sacrifice & Removal' },
  { colors: ['R', 'G'], code: 'RG', name: 'Gruul', defaultTheme: 'Midrange / Stompy & Power Threshold' },
  { colors: ['G', 'W'], code: 'GW', name: 'Selesnya', defaultTheme: 'Go-Wide / +1/+1 Counters & Tokens' },
  { colors: ['W', 'B'], code: 'WB', name: 'Orzhov', defaultTheme: 'Aristocrats / Lifegain & Bleed' },
  { colors: ['U', 'R'], code: 'UR', name: 'Izzet', defaultTheme: 'Spellslinger / Prowess & Tempo' },
  { colors: ['B', 'G'], code: 'BG', name: 'Golgari', defaultTheme: 'Graveyard / Morbid & Attrition' },
  { colors: ['R', 'W'], code: 'RW', name: 'Boros', defaultTheme: 'Go-Wide Aggro / Equipment & Combat Tricks' },
  { colors: ['G', 'U'], code: 'GU', name: 'Simic', defaultTheme: 'Ramp / Big Mana & Card Draw' },
];

export const SET_DEVELOPED_ARCHETYPES: Record<string, string[]> = {
  // Strixhaven: School of Mages (5 enemy colleges: Silverquill, Prismari, Witherbloom, Lorehold, Quandrix)
  STX: ['WB', 'UR', 'BG', 'RW', 'GU'],
  // Guilds of Ravnica (5 guilds: Dimir, Golgari, Izzet, Boros, Selesnya)
  GRN: ['UB', 'BG', 'UR', 'RW', 'GW'],
  // Ravnica Allegiance (5 guilds: Azorius, Rakdos, Gruul, Simic, Orzhov)
  RNA: ['WU', 'BR', 'RG', 'GU', 'WB'],
  // Dragons of Tarkir (5 allied pairs)
  DTK: ['WU', 'UB', 'BR', 'RG', 'GW'],
  // The Hobbit (5 developed archetypes: WU, BR, BG, RW, GU)
  HOB: ['WU', 'BR', 'BG', 'RW', 'GU'],
  // Marvel's Spider-Man (5 allied draft archetypes)
  SPM: ['WU', 'UB', 'BR', 'RG', 'GW'],
  // Teenage Mutant Ninja Turtles (5 enemy draft archetypes)
  TMT: ['WB', 'UR', 'BG', 'RW', 'GU'],
  // Secrets of Strixhaven (5 enemy colleges: Silverquill, Prismari, Witherbloom, Lorehold, Quandrix)
  SOS: ['WB', 'UR', 'BG', 'RW', 'GU'],
  // Reality Fracture (develops all 10 guilds/archetypes)
  FRA: ['WU', 'UB', 'BR', 'RG', 'GW', 'WB', 'UR', 'BG', 'RW', 'GU'],
};

export function getDevelopedArchetypeCodes(setCode: string, cards?: Card[]): Set<string> {
  const upperCode = (setCode || '').toUpperCase().trim();

  // 1. Dynamic card pool check if cards are present
  if (cards && cards.length > 0) {
    const pairGoldCount: Record<string, number> = {};
    GUILD_ARCHETYPES.forEach((guild) => {
      const [c1, c2] = guild.colors;
      const gold = cards.filter((c) => {
        const colors = c.colors || [];
        return colors.length === 2 && colors.includes(c1) && colors.includes(c2);
      });
      pairGoldCount[guild.code] = gold.length;
    });

    const activePairs = Object.entries(pairGoldCount).filter(([_, count]) => count > 0);

    // If only a subset (e.g. 5 pairs) have gold cards, those are the developed archetypes
    if (activePairs.length > 0 && activePairs.length < 10) {
      return new Set(activePairs.map(([code]) => code));
    }

    // If all 10 pairs have gold cards (like SOS, BLB, DSK, etc.)
    if (activePairs.length === 10) {
      return new Set(GUILD_ARCHETYPES.map((g) => g.code));
    }
  }

  // 2. Curated sets map
  if (SET_DEVELOPED_ARCHETYPES[upperCode]) {
    return new Set(SET_DEVELOPED_ARCHETYPES[upperCode]);
  }

  // 3. Default fallback: all 10 are considered developed
  return new Set(GUILD_ARCHETYPES.map((g) => g.code));
}

const COLOR_NAMES: Record<string, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
};



// Live in-memory cache of archetypes loaded from Supabase / IndexedDB
const LIVE_SET_ARCHETYPES: Record<string, Record<string, WOTCArchetypeInfo> | undefined> = {};
const PENDING_SET_ARCHETYPE_FETCHES: Record<string, Promise<Record<string, WOTCArchetypeInfo>> | undefined> = {};

/**
 * Loads WOTC archetype data for a set from Supabase and IndexedDB.
 */
export async function loadSetArchetypes(setCode: string): Promise<Record<string, WOTCArchetypeInfo>> {
  if (!setCode) return {};
  const upper = setCode.toUpperCase().trim();

  if (LIVE_SET_ARCHETYPES[upper] && Object.keys(LIVE_SET_ARCHETYPES[upper]).length > 0) {
    return LIVE_SET_ARCHETYPES[upper];
  }

  if (PENDING_SET_ARCHETYPE_FETCHES[upper]) {
    return PENDING_SET_ARCHETYPE_FETCHES[upper];
  }

  const fetchPromise = (async () => {
    const idbKey = `set_archetypes_v1_${upper}`;

    // 1. Try local IndexedDB cache first
    if (typeof indexedDB !== 'undefined') {
      try {
        const cached = await get<Record<string, WOTCArchetypeInfo>>(idbKey);
        if (cached && Object.keys(cached).length > 0) {
          LIVE_SET_ARCHETYPES[upper] = { ...cached };
        }
      } catch (e) {}
    }

    // 2. Query Supabase public.set_archetypes
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('set_archetypes')
          .select('color_pair, name, guild_name, headline, description, mechanics, pace, draft_pointers, key_commons')
          .eq('set_code', upper);

        if (!error && data && data.length > 0) {
          const archetypesMap: Record<string, WOTCArchetypeInfo> = {};
          for (const row of data) {
            archetypesMap[row.color_pair.toUpperCase().trim()] = {
              name: row.name,
              guildName: row.guild_name,
              headline: row.headline,
              description: row.description,
              mechanics: Array.isArray(row.mechanics) ? row.mechanics : [],
              pace: row.pace || 'Midrange',
              draftPointers: Array.isArray(row.draft_pointers) ? row.draft_pointers : [],
              keyCommons: Array.isArray(row.key_commons) ? row.key_commons : [],
            };
          }

          LIVE_SET_ARCHETYPES[upper] = archetypesMap;

          if (typeof indexedDB !== 'undefined') {
            try {
              await set(idbKey, archetypesMap);
            } catch (e) {}
          }

          return archetypesMap;
        }
      } catch (err) {
        console.warn(`[wotcArchetypes] Failed to fetch archetypes from Supabase for ${upper}:`, err);
      }
    }

    // 3. Fall back to cached IDB data
    if (LIVE_SET_ARCHETYPES[upper] && Object.keys(LIVE_SET_ARCHETYPES[upper]).length > 0) {
      return LIVE_SET_ARCHETYPES[upper];
    }

    return LIVE_SET_ARCHETYPES[upper] || {};
  })();

  PENDING_SET_ARCHETYPE_FETCHES[upper] = fetchPromise;
  try {
    const res = await fetchPromise;
    return res;
  } finally {
    delete PENDING_SET_ARCHETYPE_FETCHES[upper];
  }
}

const DEFAULT_GUILD_WOTC_ARCHETYPES: Record<string, WOTCArchetypeInfo> = {
  "WU": {
    "name": "Azorius (White/Blue)",
    "headline": "Aerial Superiority \u2022 Flying Creatures & Defensive Tempo",
    "description": "White-Blue centers around evasive flying threats supported by countermagic, bouncing blockers, and protective defensive tricks.",
    "mechanics": [
      "Flying",
      "Blink / Bounce",
      "Tempo & Counterspells"
    ]
  },
  "UB": {
    "name": "Dimir (Blue/Black)",
    "headline": "Sabotage & Control \u2022 Card Advantage, Removal & Graveyard Value",
    "description": "Blue-Black excels at disruption, using efficient black removal and blue counterspells to clear threats while saboteur creatures draw extra cards.",
    "mechanics": [
      "Targeted Removal",
      "Card Advantage",
      "Saboteur Combat"
    ]
  },
  "BR": {
    "name": "Rakdos (Black/Red)",
    "headline": "Aggression & Sacrifice \u2022 High Damage, Burn & Morbid Triggers",
    "description": "Black-Red prioritizes relentless offensive speed, using cheap aggressive creatures and sacrificial synergies to burn through opposing life totals.",
    "mechanics": [
      "Sacrifice Fodder",
      "Direct Burn",
      "Fast Aggro"
    ]
  },
  "RG": {
    "name": "Gruul (Red/Green)",
    "headline": "Primal Stompy \u2022 4+ Power Creatures & Trample Pressure",
    "description": "Red-Green ramps into massive, high-stat creatures with trample and haste, forcing opponents into losing combat trades.",
    "mechanics": [
      "4+ Power Threshold",
      "Mana Ramp",
      "Trample Beatdown"
    ]
  },
  "GW": {
    "name": "Selesnya (Green/White)",
    "headline": "Go-Wide Swarm \u2022 Creature Tokens & +1/+1 Anthems",
    "description": "Green-White floods the battlefield with multiple small creatures and tokens, then buffs the entire army with permanent +1/+1 counters and anthem effects.",
    "mechanics": [
      "Creature Tokens",
      "+1/+1 Counters",
      "Anthem Buffs"
    ]
  },
  "WB": {
    "name": "Orzhov (White/Black)",
    "headline": "Aristocrats & Bleed \u2022 Death Triggers & Life Total Drain",
    "description": "White-Black grinds out value through death triggers and incremental drain, profiting every time a creature leaves the battlefield.",
    "mechanics": [
      "Aristocrats",
      "Life Gain & Drain",
      "Graveyard Recursion"
    ]
  },
  "UR": {
    "name": "Izzet (Blue/Red)",
    "headline": "Spellslinger Velocity \u2022 Instant/Sorcery Chaining & Prowess",
    "description": "Blue-Red rewards chaining multiple noncreature spells in a single turn, triggering prowess buffs, card draw, and targeted burn.",
    "mechanics": [
      "Instants & Sorceries",
      "Prowess / Velocity",
      "Burn & Draw"
    ]
  },
  "BG": {
    "name": "Golgari (Black/Green)",
    "headline": "Graveyard Attrition \u2022 Morbid Recycling & Deathtouch Midrange",
    "description": "Black-Green treats the graveyard as an extension of the hand, milling cards to recur bombs and deploying deathtouch blockers to stall aggressive decks.",
    "mechanics": [
      "Self-Mill",
      "Graveyard Recursion",
      "Deathtouch Attrition"
    ]
  },
  "RW": {
    "name": "Boros (Red/White)",
    "headline": "Go-Wide Aggro \u2022 Equipment, Valiant & Fast Attack Triggers",
    "description": "Red-White curves out with low-mana attackers, using combat tricks, equipment, and attack-phase bonuses to end games before opponents establish control.",
    "mechanics": [
      "Fast Curve",
      "Equipment & Combat Tricks",
      "Attack Triggers"
    ]
  },
  "GU": {
    "name": "Simic (Green/Blue)",
    "headline": "Ramp & Growth \u2022 Extra Lands, Big Mana & Card Flow",
    "description": "Green-Blue accelerates extra lands onto the battlefield, translating excess mana into colossal late-game threats and recurring card draw.",
    "mechanics": [
      "Land Ramp",
      "Big Mana Monsters",
      "Card Draw"
    ]
  }
};


/**
 * In-memory cache for dynamically synthesized archetypes
 */
const DYNAMIC_ARCHETYPE_CACHE = new Map<string, WOTCArchetypeInfo>();

/**
 * Common MTG Limited keyword signatures for on-the-fly oracle text scanning
 */
const KEYWORD_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: 'Flying', pattern: /\bflying\b/i },
  { name: 'Disguise', pattern: /\bdisguise\b|\bcloak\b/i },
  { name: 'Plot', pattern: /\bplot\b/i },
  { name: 'Investigate & Clues', pattern: /\binvestigate\b|\bclue\b/i },
  { name: 'Crimes', pattern: /\bcrime\b|\bcommitted a crime\b/i },
  { name: 'Descend', pattern: /\bdescend\b|\bfathomless descent\b/i },
  { name: 'Explore', pattern: /\bexplore\b|\bmap token\b/i },
  { name: 'Craft', pattern: /\bcraft with\b/i },
  { name: 'Bargain', pattern: /\bbargain\b/i },
  { name: 'Celebration', pattern: /\bcelebration\b/i },
  { name: 'Roles', pattern: /\brole\b|\bmonster role\b|\byoung hero\b|\broyal role\b/i },
  { name: 'The Ring', pattern: /\bthe ring tempts you\b/i },
  { name: 'Amass Orcs', pattern: /\bamass orcs\b/i },
  { name: 'Incubate', pattern: /\bincubate\b/i },
  { name: 'Backup', pattern: /\bbackup\b/i },
  { name: 'Battles', pattern: /\bbattle\b|\bsiege\b/i },
  { name: 'Toxic', pattern: /\btoxic\b|\bpoison counter\b/i },
  { name: 'Corrupted', pattern: /\bcorrupted\b/i },
  { name: 'Oil Counters', pattern: /\boil counter\b/i },
  { name: 'Powerstones', pattern: /\bpowerstone\b/i },
  { name: 'Unearth', pattern: /\bunearth\b/i },
  { name: 'Prototype', pattern: /\bprototype\b/i },
  { name: 'Draw 2 Cards', pattern: /\bdraw your second card\b|\bdraw two or more cards\b/i },
  { name: 'Domain', pattern: /\bdomain\b/i },
  { name: 'Enlist', pattern: /\benlist\b/i },
  { name: 'Kicker', pattern: /\bkicker\b/i },
  { name: 'Vehicles', pattern: /\bvehicle\b|\bcrew\b/i },
  { name: 'Ninjutsu', pattern: /\bninjutsu\b/i },
  { name: 'Modified', pattern: /\bmodified\b/i },
  { name: 'Channel', pattern: /\bchannel\b/i },
  { name: 'Foretell', pattern: /\bforetell\b/i },
  { name: 'Boast', pattern: /\bboast\b/i },
  { name: 'Runes', pattern: /\brune\b/i },
  { name: 'Snow', pattern: /\bsnow\b/i },
  { name: 'Party', pattern: /\bparty\b/i },
  { name: 'Landfall', pattern: /\blandfall\b/i },
  { name: 'Mutate', pattern: /\bmutate\b/i },
  { name: 'Cycling', pattern: /\bcycling\b/i },
  { name: 'Escape', pattern: /\bescape\b/i },
  { name: 'Devotion', pattern: /\bdevotion\b/i },
  { name: 'Adventures', pattern: /\badventure\b/i },
  { name: 'Food', pattern: /\bfood\b/i },
  { name: 'Energy', pattern: /\benergy\b/i },
  { name: 'Forage', pattern: /\bforage\b/i },
  { name: 'Expend', pattern: /\bexpend\b/i },
  { name: 'Valiant', pattern: /\bvaliant\b/i },
  { name: 'Eerie', pattern: /\beerie\b/i },
  { name: 'Survival', pattern: /\bsurvival\b/i },
  { name: 'Rooms', pattern: /\broom\b/i },
  { name: 'Manifest Dread', pattern: /\bmanifest dread\b/i },
  { name: 'Morbid', pattern: /\bmorbid\b|\bdied this turn\b/i },
  { name: '+1/+1 Counters', pattern: /\b\+1\/\+1 counter\b/i },
  { name: 'Tokens', pattern: /\bcreate.*token\b/i },
  { name: 'Sacrifice', pattern: /\bsacrifice\b/i },
  { name: 'Graveyard Recursion', pattern: /\breturn.*from your graveyard\b/i },
  { name: 'Spellslinger & Tempo', pattern: /\bwhenever you cast (an? )?(instant|sorcery|noncreature)\b|\bprowess\b|\binstant or sorcery\b/i },
  { name: '4+ Power', pattern: /\bpower 4 or greater\b/i },
];

/**
 * Prominent tribal subtype detections
 */
const TRIBAL_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: 'Birds', pattern: /\bbird\b/i },
  { name: 'Rats', pattern: /\brat\b/i },
  { name: 'Lizards', pattern: /\blizard\b/i },
  { name: 'Raccoons', pattern: /\braccoon\b/i },
  { name: 'Rabbits', pattern: /\brabbit\b/i },
  { name: 'Bats', pattern: /\bbat\b/i },
  { name: 'Otters', pattern: /\botter\b/i },
  { name: 'Squirrels', pattern: /\bsquirrel\b/i },
  { name: 'Mice', pattern: /\bmouse\b/i },
  { name: 'Frogs', pattern: /\bfrog\b/i },
  { name: 'Detectives', pattern: /\bdetective\b/i },
  { name: 'Dinosaurs', pattern: /\bdinosaur\b/i },
  { name: 'Pirates', pattern: /\bpirate\b/i },
  { name: 'Vampires', pattern: /\bvampire\b/i },
  { name: 'Merfolk', pattern: /\bmerfolk\b/i },
  { name: 'Faeries', pattern: /\bfaerie\b/i },
  { name: 'Halflings', pattern: /\bhalfling\b/i },
  { name: 'Goblins', pattern: /\bgoblin\b/i },
  { name: 'Orcs', pattern: /\borc\b/i },
  { name: 'Knights', pattern: /\bknight\b/i },
  { name: 'Phyrexians', pattern: /\bphyrexian\b/i },
  { name: 'Soldiers', pattern: /\bsoldier\b/i },
  { name: 'Ninjas', pattern: /\bninja\b/i },
  { name: 'Samurai', pattern: /\bsamurai\b/i },
  { name: 'Elves', pattern: /\belf\b|\belves\b/i },
  { name: 'Giants', pattern: /\bgiant\b/i },
  { name: 'Berserkers', pattern: /\bberserker\b/i },
  { name: 'Clerics', pattern: /\bcleric\b/i },
  { name: 'Rogues', pattern: /\brogue\b/i },
  { name: 'Wizards', pattern: /\bwizard\b/i },
  { name: 'Warriors', pattern: /\bwarrior\b/i },
  { name: 'Eldrazi', pattern: /\beldrazi\b/i },
];

/**
 * Synthesizes an authentic WOTC archetype on the fly for uncurated sets
 */
export function synthesizeWOTCArchetypeOnTheFly(
  setCode: string,
  guildCode: string,
  cards: Card[] = []
): WOTCArchetypeInfo {
  const upperCode = (setCode || '').toUpperCase().trim();
  const upperGuild = (guildCode || '').toUpperCase().trim();
  const cacheKey = `${upperCode}_${upperGuild}`;

  if (DYNAMIC_ARCHETYPE_CACHE.has(cacheKey)) {
    return DYNAMIC_ARCHETYPE_CACHE.get(cacheKey)!;
  }

  const guild = GUILD_ARCHETYPES.find((g) => g.code === upperGuild) || {
    code: upperGuild,
    colors: ['W', 'U'] as [MTGColor, MTGColor],
    name: upperGuild,
    defaultTheme: 'Synergy & Tempo',
  };

  const [c1, c2] = guild.colors;
  const color1Name = COLOR_NAMES[c1] || 'Color 1';
  const color2Name = COLOR_NAMES[c2] || 'Color 2';

  if (!cards || cards.length === 0) {
    return DEFAULT_GUILD_WOTC_ARCHETYPES[upperGuild] || {
      name: guild.name,
      headline: guild.defaultTheme,
      description: `${color1Name}-${color2Name} centers around ${guild.defaultTheme.toLowerCase()}.`,
      mechanics: ['Combat', 'Synergy'],
    };
  }

  // 1. Find gold cards of this exact color pair
  const goldCards = cards.filter((c) => {
    const cols = c.colors || [];
    return cols.length === 2 && cols.includes(c1) && cols.includes(c2);
  });

  const goldUncommons = goldCards.filter((c) => c.rarity === 'uncommon');
  const goldRares = goldCards.filter((c) => c.rarity === 'rare' || c.rarity === 'mythic');
  const primarySignpost = goldUncommons[0] || goldRares[0] || goldCards[0];

  // 2. Scan card pool for keyword mentions (heavily weight gold cards)
  const mechanicCounts: Record<string, number> = {};

  goldCards.forEach((c) => {
    const text = `${c.name} ${c.type_line || ''} ${c.oracle_text || ''} ${(c.keywords || []).join(' ')}`;
    KEYWORD_PATTERNS.forEach((kp) => {
      if (kp.pattern.test(text)) {
        mechanicCounts[kp.name] = (mechanicCounts[kp.name] || 0) + 4;
      }
    });
  });

  // Also scan monocolor cards of these two colors
  const monoCards = cards.filter((c) => {
    const cols = c.colors || [];
    return cols.length === 1 && (cols[0] === c1 || cols[0] === c2);
  });

  monoCards.forEach((c) => {
    const text = `${c.name} ${c.type_line || ''} ${c.oracle_text || ''} ${(c.keywords || []).join(' ')}`;
    KEYWORD_PATTERNS.forEach((kp) => {
      if (kp.pattern.test(text)) {
        mechanicCounts[kp.name] = (mechanicCounts[kp.name] || 0) + 1;
      }
    });
  });

  const topMechanics = Object.entries(mechanicCounts)
    .sort((a, b) => b[1] - a[1])
    .filter(([_, count]) => count >= 2)
    .slice(0, 3)
    .map(([name]) => name);

  // 3. Scan for prominent tribe
  const tribeCounts: Record<string, number> = {};
  goldCards.forEach((c) => {
    const text = `${c.name} ${c.type_line || ''} ${c.oracle_text || ''}`;
    TRIBAL_PATTERNS.forEach((tp) => {
      if (tp.pattern.test(text)) {
        tribeCounts[tp.name] = (tribeCounts[tp.name] || 0) + 3;
      }
    });
  });

  const prominentTribe = Object.entries(tribeCounts)
    .sort((a, b) => b[1] - a[1])
    .filter(([_, count]) => count >= 3)
    .map(([name]) => name)[0];

  // 4. Construct Name
  let name = guild.name;
  if (prominentTribe) {
    name = `${prominentTribe} (${guild.name})`;
  } else if (topMechanics.length > 0) {
    name = `${topMechanics[0]} (${guild.name})`;
  }

  // 5. Construct Headline
  let headline = guild.defaultTheme;
  if (prominentTribe && topMechanics.length > 0) {
    headline = `${prominentTribe} • ${topMechanics.slice(0, 2).join(' & ')}`;
  } else if (topMechanics.length >= 2) {
    headline = `${topMechanics[0]} & ${topMechanics[1]} • ${c1 === 'U' || c2 === 'U' ? 'Tempo & Control' : c1 === 'R' || c2 === 'R' ? 'Aggro & Burn' : 'Midrange & Value'}`;
  } else if (primarySignpost && topMechanics.length > 0) {
    headline = `${topMechanics[0]} • Anchored by ${primarySignpost.name}`;
  } else if (primarySignpost) {
    headline = `${primarySignpost.name} • ${guild.defaultTheme}`;
  }

  // 6. Construct Description
  const signpostMention = primarySignpost ? `Anchored by signposts like ${primarySignpost.name}, ` : '';
  const mechanicsText = topMechanics.length > 0 ? topMechanics.join(' and ') : guild.defaultTheme.toLowerCase();
  const description = `${color1Name}-${color2Name} in ${upperCode} centers on ${mechanicsText}. ${signpostMention}this archetype pairs ${color1Name} and ${color2Name} to execute a focused Limited draft strategy centered on board presence, synergy, and combat tempo.`;

  const mechanics = topMechanics.length > 0 ? topMechanics : ['Synergy', 'Combat'];

  // Inferred Pace
  let pace: ArchetypePace = 'Midrange';
  if (['RW', 'BR'].includes(upperCode)) pace = 'Aggro';
  else if (['WU', 'UR'].includes(upperCode)) pace = 'Aggro-Tempo';
  else if (['UB', 'WB'].includes(upperCode)) pace = 'Control';
  else if (['GU', 'BG'].includes(upperCode)) pace = 'Midrange';

  const draftPointers = [
    `Prioritize core ${color1Name} and ${color2Name} commons that reinforce ${mechanics[0] || 'board synergy'}`,
    primarySignpost ? `Anchor your early picks around signposts like ${primarySignpost.name}` : `Look for gold ${upperCode} payoffs early in pack 1`,
    `Maintain a balanced creature curve to control the pace of combat`
  ];

  const synthesized: WOTCArchetypeInfo = {
    name,
    guildName: guild.name,
    headline,
    description,
    mechanics,
    pace,
    draftPointers,
  };

  DYNAMIC_ARCHETYPE_CACHE.set(cacheKey, synthesized);
  return synthesized;
}

/**
 * Returns WOTC Archetype metadata for a given set and archetype code.
 * Checks curated official database first, falling back to dynamic on-the-fly synthesis.
 */
export function getWOTCArchetypeInfo(
  setCode: string,
  archetypeCode: string,
  cards?: Card[]
): WOTCArchetypeInfo {
  const upperSet = (setCode || '').toUpperCase().trim();
  const upperCode = (archetypeCode || '').toUpperCase().trim();

  // 1. Check curated official database
  // Kick off background load if not present
  if (!LIVE_SET_ARCHETYPES[upperSet] && !PENDING_SET_ARCHETYPE_FETCHES[upperSet] && isSupabaseConfigured()) {
    loadSetArchetypes(upperSet).catch(() => {});
  }

  // 1. Check live database / IDB cache
  if (LIVE_SET_ARCHETYPES[upperSet]?.[upperCode]) {
    const raw = LIVE_SET_ARCHETYPES[upperSet][upperCode];
    const guild = GUILD_ARCHETYPES.find((g) => g.code === upperCode);
    return {
      ...raw,
      guildName: raw.guildName || guild?.name || upperCode,
      pace: raw.pace || 'Midrange',
    };
  }

  // 2. Synthesize on the fly from card pool if cards are provided
  if (cards && cards.length > 0) {
    return synthesizeWOTCArchetypeOnTheFly(upperSet, upperCode, cards);
  }

  // 3. Fallback to default guild baseline
  const guild = GUILD_ARCHETYPES.find((g) => g.code === upperCode);
  return DEFAULT_GUILD_WOTC_ARCHETYPES[upperCode] || {
    name: guild?.name || upperCode,
    guildName: guild?.name || upperCode,
    headline: guild?.defaultTheme || 'Draft Synergy',
    description: `${upperCode} centers on core color synergy and solid curve fundamentals.`,
    mechanics: ['Combat', 'Synergy'],
    pace: 'Midrange',
    draftPointers: [
      `Draft foundational ${guild?.name || upperCode} cards that fit your curve`,
      `Watch for open color signals in pack 1 and pack 2`,
      `Balance high-impact removal with efficient attackers`
    ]
  };
}

/**
 * Resolves all WOTC supported archetypes for a given MTG set.
 * Returns only the intentionally designed/supported archetypes (e.g. 5 for Strixhaven/Hobbit, 10 for standard sets).
 */
export function getWOTCArchetypesForSet(setCode: string, cards: Card[]): WOTCArchetype[] {
  const upperCode = (setCode || '').toUpperCase().trim();
  const developedCodes = getDevelopedArchetypeCodes(upperCode, cards);

  const archetypes: WOTCArchetype[] = [];

  GUILD_ARCHETYPES.forEach((guild) => {
    if (!developedCodes.has(guild.code)) return;

    const info = getWOTCArchetypeInfo(upperCode, guild.code, cards);

    archetypes.push({
      code: guild.code,
      colors: guild.colors,
      name: info.name,
      guildName: info.guildName || guild.name,
      headline: info.headline,
      description: info.description,
      mechanics: info.mechanics,
      pace: info.pace,
      draftPointers: info.draftPointers,
      keyCommons: info.keyCommons,
    });
  });

  return archetypes;
}

/**
 * Finds signpost cards (2-color uncommons or specific archetype tag cards)
 * that anchor a specific archetype in the set.
 */
export function getSignpostsForArchetype(archetypeCode: string, cards: Card[]): Card[] {
  const guild = GUILD_ARCHETYPES.find((g) => g.code === archetypeCode);
  if (!guild || !cards || cards.length === 0) return [];

  const [c1, c2] = guild.colors;

  // 1. First priority: 2-color uncommons of this exact color pair
  const uncommonGold = cards.filter((c) => {
    const colors = c.colors || [];
    return (
      c.rarity === 'uncommon' &&
      colors.length === 2 &&
      colors.includes(c1) &&
      colors.includes(c2)
    );
  });

  if (uncommonGold.length > 0) return uncommonGold;

  // 2. Second priority: any gold cards of this exact color pair (rare/common)
  const allGold = cards.filter((c) => {
    const colors = c.colors || [];
    return colors.length === 2 && colors.includes(c1) && colors.includes(c2);
  });

  return allGold;
}

