import { get, set } from 'idb-keyval';
import { Card, CardFace, MTGColor, MTGRarity, SetInfo } from '../types/mtg';

const SCRYFALL_API_BASE = 'https://api.scryfall.com';

// Pre-curated list of 17Lands known expansion identifiers from https://www.17lands.com/data/filters
export const KNOWN_17LANDS_EXPANSIONS = new Set([
  'HOB', 'MBC', 'MSH', 'SOS', 'Y26SOS', 'TMT', 'ECL', 'Y26ECL', 'TLA', 'OM1', 'EOE', 'FIN', 'Y25EOE',
  'TDM', 'Y25TDM', 'DFT', 'Y25DFT', 'PIO', 'FDN', 'DSK', 'Y25DSK', 'BLB', 'Y25BLB', 'MH3', 'OTJ',
  'Y24OTJ', 'MKM', 'Y24MKM', 'LCI', 'Y24LCI', 'WOE', 'Y24WOE', 'LTR', 'MOM', 'MAT', 'SIR', 'ONE',
  'Y23ONE', 'BRO', 'Y23BRO', 'DMU', 'Y23DMU', 'HBG', 'SNC', 'Y22SNC', 'NEO', 'DBL', 'VOW', 'RAVM',
  'MID', 'AFR', 'STX', 'CORE', 'KHM', 'KLR', 'ZNR', 'AKR', 'M21', 'IKO', 'THB', 'ELD', 'RAVNICA',
  'M20', 'WAR', 'M19', 'DOM', 'RIX', 'GRN', 'RNA', 'KTK', 'XLN', 'RVR'
]);

// Pre-curated list of top Limited sets with comprehensive metadata
// Correctly tracks all sets with active 17Lands Premier Draft telemetry
export const POPULAR_LIMITED_SETS: SetInfo[] = [
  // 2026 Sets
  { code: 'TRK', name: 'Star Trek', card_count: 135, released_at: '2026-11-01', set_type: 'expansion', has_17lands_data: false },
  { code: 'MBC', name: 'Mystery Booster Commander Edition', card_count: 80, released_at: '2026-08-01', set_type: 'draft_innovation', has_17lands_data: true, is_active_draft: true },
  { code: 'FRA', name: 'Reality Fracture', card_count: 290, released_at: '2026-10-02', set_type: 'expansion', has_17lands_data: false },
  { code: 'HOB', name: 'The Hobbit', card_count: 321, released_at: '2026-08-14', set_type: 'expansion', has_17lands_data: true, is_active_draft: true },
  { code: 'MSH', name: 'Marvel Super Heroes', card_count: 453, released_at: '2026-06-01', set_type: 'expansion', has_17lands_data: true },
  { code: 'SOS', name: 'Secrets of Strixhaven', card_count: 368, released_at: '2026-04-24', set_type: 'expansion', has_17lands_data: true },
  { code: 'TMT', name: 'Teenage Mutant Ninja Turtles', card_count: 320, released_at: '2026-03-01', set_type: 'expansion', has_17lands_data: true },
  { code: 'ECL', name: 'Lorwyn Eclipsed', card_count: 408, released_at: '2026-01-01', set_type: 'expansion', has_17lands_data: true },
  // 2025 Sets
  { code: 'TLA', name: 'Avatar: The Last Airbender', card_count: 394, released_at: '2025-11-01', set_type: 'expansion', has_17lands_data: true },
  { code: 'SPM', name: "Marvel's Spider-Man", card_count: 286, released_at: '2025-09-26', set_type: 'expansion', has_17lands_data: false },
  { code: 'EOE', name: 'Edge of Eternities', card_count: 400, released_at: '2025-08-01', set_type: 'expansion', has_17lands_data: true },
  { code: 'FIN', name: 'Final Fantasy', card_count: 599, released_at: '2025-06-13', set_type: 'expansion', has_17lands_data: true },
  { code: 'TDM', name: 'Tarkir: Dragonstorm', card_count: 427, released_at: '2025-04-11', set_type: 'expansion', has_17lands_data: true },
  { code: 'DFT', name: 'Aetherdrift', card_count: 276, released_at: '2025-02-14', set_type: 'expansion', has_17lands_data: true },
  // 2024 Sets
  { code: 'PIO', name: 'Pioneer Masters', card_count: 398, released_at: '2024-12-10', set_type: 'masters', has_17lands_data: true },
  { code: 'FDN', name: 'Foundations', card_count: 271, released_at: '2024-11-15', set_type: 'core', has_17lands_data: true },
  { code: 'DSK', name: 'Duskmourn: House of Horror', card_count: 276, released_at: '2024-09-27', set_type: 'expansion', has_17lands_data: true },
  { code: 'BLB', name: 'Bloomburrow', card_count: 261, released_at: '2024-08-02', set_type: 'expansion', has_17lands_data: true },
  { code: 'MH3', name: 'Modern Horizons 3', card_count: 303, released_at: '2024-06-14', set_type: 'draft_innovation', has_17lands_data: true },
  { code: 'OTJ', name: 'Outlaws of Thunder Junction', card_count: 276, released_at: '2024-04-19', set_type: 'expansion', has_17lands_data: true },
  { code: 'MKM', name: 'Murders at Karlov Manor', card_count: 276, released_at: '2024-02-09', set_type: 'expansion', has_17lands_data: true },
  { code: 'RVR', name: 'Ravnica Remastered', card_count: 292, released_at: '2024-01-12', set_type: 'masters', has_17lands_data: true },
  // 2023 Sets
  { code: 'LCI', name: 'The Lost Caverns of Ixalan', card_count: 271, released_at: '2023-11-17', set_type: 'expansion', has_17lands_data: true },
  { code: 'WOE', name: 'Wilds of Eldraine', card_count: 266, released_at: '2023-09-08', set_type: 'expansion', has_17lands_data: true },
  { code: 'LTR', name: 'The Lord of the Rings: Tales of Middle-earth', card_count: 261, released_at: '2023-06-23', set_type: 'draft_innovation', has_17lands_data: true },
  { code: 'MOM', name: 'March of the Machine', card_count: 281, released_at: '2023-04-21', set_type: 'expansion', has_17lands_data: true },
  { code: 'SIR', name: 'Shadows over Innistrad Remastered', card_count: 294, released_at: '2023-03-21', set_type: 'masters', has_17lands_data: true },
  { code: 'ONE', name: 'Phyrexia: All Will Be One', card_count: 271, released_at: '2023-02-10', set_type: 'expansion', has_17lands_data: true },
  // 2022 Sets
  { code: 'BRO', name: "The Brothers' War", card_count: 287, released_at: '2022-11-18', set_type: 'expansion', has_17lands_data: true },
  { code: 'DMU', name: 'Dominaria United', card_count: 281, released_at: '2022-09-09', set_type: 'expansion', has_17lands_data: true },
  { code: 'HBG', name: 'Alchemy Horizons: Baldur\'s Gate', card_count: 267, released_at: '2022-07-07', set_type: 'alchemy', has_17lands_data: true },
  { code: 'SNC', name: 'Streets of New Capenna', card_count: 281, released_at: '2022-04-29', set_type: 'expansion', has_17lands_data: true },
  { code: 'NEO', name: 'Kamigawa: Neon Dynasty', card_count: 302, released_at: '2022-02-18', set_type: 'expansion', has_17lands_data: true },
  { code: 'DBL', name: 'Innistrad: Double Feature', card_count: 534, released_at: '2022-01-28', set_type: 'draft_innovation', has_17lands_data: true },
  // 2021 Sets
  { code: 'VOW', name: 'Innistrad: Crimson Vow', card_count: 267, released_at: '2021-11-19', set_type: 'expansion', has_17lands_data: true },
  { code: 'MID', name: 'Innistrad: Midnight Hunt', card_count: 267, released_at: '2021-09-24', set_type: 'expansion', has_17lands_data: true },
  { code: 'AFR', name: 'Adventures in the Forgotten Realms', card_count: 261, released_at: '2021-07-23', set_type: 'expansion', has_17lands_data: true },
  { code: 'STX', name: 'Strixhaven: School of Mages', card_count: 275, released_at: '2021-04-23', set_type: 'expansion', has_17lands_data: true },
  { code: 'KHM', name: 'Kaldheim', card_count: 285, released_at: '2021-02-05', set_type: 'expansion', has_17lands_data: true },
  // 2020 Sets
  { code: 'KLR', name: 'Kaladesh Remastered', card_count: 286, released_at: '2020-11-12', set_type: 'masters', has_17lands_data: true },
  { code: 'ZNR', name: 'Zendikar Rising', card_count: 265, released_at: '2020-09-25', set_type: 'expansion', has_17lands_data: true },
  { code: 'AKR', name: 'Amonkhet Remastered', card_count: 303, released_at: '2020-08-13', set_type: 'masters', has_17lands_data: true },
  { code: 'M21', name: 'Core Set 2021', card_count: 259, released_at: '2020-07-03', set_type: 'core', has_17lands_data: true },
  { code: 'IKO', name: 'Ikoria: Lair of Behemoths', card_count: 259, released_at: '2020-04-24', set_type: 'expansion', has_17lands_data: true },
  { code: 'THB', name: 'Theros Beyond Death', card_count: 249, released_at: '2020-01-24', set_type: 'expansion', has_17lands_data: true },
  // 2019 Sets
  { code: 'ELD', name: 'Throne of Eldraine', card_count: 249, released_at: '2019-10-04', set_type: 'expansion', has_17lands_data: true },
  { code: 'M20', name: 'Core Set 2020', card_count: 260, released_at: '2019-07-12', set_type: 'core', has_17lands_data: true },
  { code: 'WAR', name: 'War of the Spark', card_count: 249, released_at: '2019-05-03', set_type: 'expansion', has_17lands_data: true },
  { code: 'RNA', name: 'Ravnica Allegiance', card_count: 259, released_at: '2019-01-25', set_type: 'expansion', has_17lands_data: true },
  // 2018 Sets
  { code: 'GRN', name: 'Guilds of Ravnica', card_count: 259, released_at: '2018-10-05', set_type: 'expansion', has_17lands_data: true },
  { code: 'M19', name: 'Core Set 2019', card_count: 260, released_at: '2018-07-13', set_type: 'core', has_17lands_data: true },
  { code: 'DOM', name: 'Dominaria', card_count: 249, released_at: '2018-04-27', set_type: 'expansion', has_17lands_data: true },
  { code: 'RIX', name: 'Rivals of Ixalan', card_count: 191, released_at: '2018-01-19', set_type: 'expansion', has_17lands_data: true },
  // 2017 & Earlier / Remastered
  { code: 'XLN', name: 'Ixalan', card_count: 289, released_at: '2017-09-29', set_type: 'expansion', has_17lands_data: true },
  { code: 'KTK', name: 'Khans of Tarkir', card_count: 249, released_at: '2014-09-26', set_type: 'expansion', has_17lands_data: true },
];

export function isCombatTrick(card: Card): boolean {
  const typeLine = (card.type_line || '').toLowerCase();
  const oracle = (card.oracle_text || '').toLowerCase();
  const isInstantOrFlash = typeLine.includes('instant') || (card.keywords || []).some(k => k.toLowerCase() === 'flash');

  if (!isInstantOrFlash) return false;

  const statBuffRegex = /\+[0-9]\/\+[0-9]|\+[0-9]\/\+[0-9]|gets \+/i;
  const combatKeywords = ['flying', 'first strike', 'double strike', 'deathtouch', 'indestructible', 'hexproof', 'lifelink', 'trample', 'ward', 'protection', 'prevent all damage', 'target creature gets'];

  const hasBuff = statBuffRegex.test(oracle);
  const hasKeywordGrant = combatKeywords.some(kw => oracle.includes(kw));

  return hasBuff || hasKeywordGrant;
}

export function isCounterspell(card: Card): boolean {
  const oracle = (card.oracle_text || '').toLowerCase();
  const typeLine = (card.type_line || '').toLowerCase();
  if (typeLine.includes('land')) return false;

  const counterPatterns = [
    'counter target',
    'counter that spell',
    'counters that spell',
    'counter it unless',
    'counter all other spells',
    'exile target spell',
  ];

  return counterPatterns.some(pat => oracle.includes(pat));
}

export function isRemovalSpell(card: Card): boolean {
  const oracle = (card.oracle_text || '').toLowerCase();
  const typeLine = (card.type_line || '').toLowerCase();
  if (typeLine.includes('land')) return false;

  // Counterspells are stack interaction, NOT board removal
  // If a card solely counters spells and does not affect the battlefield, it's not removal
  if (isCounterspell(card) && !oracle.includes('destroy target') && !oracle.includes('exile target creature') && !oracle.includes('return target')) {
    return false;
  }

  const removalPatterns = [
    // Targeted destruction of on-board permanents
    'destroy target creature',
    'destroy target permanent',
    'destroy target artifact',
    'destroy target enchantment',
    'destroy target planeswalker',
    'destroy target nonland permanent',
    'destroy target tapped creature',
    'destroy target attacking',
    'destroy target blocking',
    'destroy target monocolored',
    'destroy target multicolored',
    // Mass destruction (sweepers)
    'destroy all creatures',
    'destroy all nonland permanents',
    'destroy each creature',
    // Targeted exile of on-board permanents (avoid graveyard or library exile)
    'exile target creature',
    'exile target permanent',
    'exile target artifact',
    'exile target enchantment',
    'exile target planeswalker',
    'exile target nonland permanent',
    'exile target tapped creature',
    'exile target attacking',
    // Mass exile (sweepers)
    'exile all creatures',
    'exile each creature',
    'exile all nonland permanents',
    // Direct damage to creatures
    'deals damage to target creature',
    'deals damage to any target',
    'deals damage to each creature',
    'deals damage to all creatures',
    'damage divided as you choose among any number of target creatures',
    'deals damage to target attacking or blocking creature',
    // -N/-N shrinking removal
    'target creature gets -',
    'all creatures get -',
    'each creature gets -',
    // Fight and Bite spells
    'fights target',
    'deals damage equal to its power to target',
    'deals damage equal to target creature\'s power',
    // Pacifism / Arrest / Neutralizing auras
    'enchanted creature can\'t attack or block',
    'enchanted permanent can\'t attack or block',
    'enchanted creature doesn\'t untap',
    'loses all abilities and is a',
    'has base power and toughness 0/1',
    'has base power and toughness 1/1',
    'has no abilities',
    // Bounce and Tuck (Tempo removal)
    'return target creature to its owner\'s hand',
    'return target permanent to its owner\'s hand',
    'return target nonland permanent to its owner\'s hand',
    'put target creature into its owner\'s library',
    'put target permanent into its owner\'s library',
    'put target creature on the bottom of its owner\'s library',
    // Edict / Sacrifice effects
    'target opponent sacrifices a creature',
    'target player sacrifices a creature',
    'each opponent sacrifices a creature',
    'each player sacrifices a creature',
  ];

  return removalPatterns.some(pat => oracle.includes(pat));
}

export function isCardDrawSpell(card: Card): boolean {
  const oracle = (card.oracle_text || '').toLowerCase();
  const typeLine = (card.type_line || '').toLowerCase();
  if (typeLine.includes('land')) return false;

  const drawPatterns = [
    'draw a card',
    'draw two cards',
    'draw three cards',
    'draw four cards',
    'draw x cards',
    'draws a card',
    'draws two cards',
    'draw that many cards',
    'draw cards equal to',
  ];

  const hasRawDraw = drawPatterns.some(pat => oracle.includes(pat));
  const hasImpulseDraw = oracle.includes('exile the top') && (oracle.includes('you may play') || oracle.includes('you may cast'));
  const hasSelectionIntoHand = oracle.includes('look at the top') && oracle.includes('into your hand');

  return hasRawDraw || hasImpulseDraw || hasSelectionIntoHand;
}

export function isInteractionSpell(card: Card): boolean {
  const oracle = (card.oracle_text || '').toLowerCase();
  const typeLine = (card.type_line || '').toLowerCase();
  if (typeLine.includes('land')) return false;

  // 1. Board Removal
  if (isRemovalSpell(card)) return true;

  // 2. Stack Counterspells
  if (isCounterspell(card)) return true;

  // 3. Combat Tricks
  if (isCombatTrick(card)) return true;

  // 4. Hand Disruption (Discard)
  const discardPatterns = [
    'target opponent discards',
    'target player discards',
    'each opponent discards',
    'reveals their hand and you choose',
    'reveals his or her hand and you choose',
  ];
  if (discardPatterns.some(pat => oracle.includes(pat))) return true;

  // 5. Stun / Tap Lock Interaction
  if (oracle.includes('tap target creature') && (oracle.includes('stun counter') || oracle.includes('doesn\'t untap'))) {
    return true;
  }

  return false;
}

export function identifySignpostArchetype(card: Card): string | undefined {
  if (card.colors && card.colors.length === 2 && card.rarity === 'uncommon') {
    const pair = [...card.colors].sort().join('');
    const pairNames: Record<string, string> = {
      'UW': 'Azorius (White/Blue)',
      'BU': 'Dimir (Blue/Black)',
      'BR': 'Rakdos (Black/Red)',
      'GR': 'Gruul (Red/Green)',
      'GW': 'Selesnya (Green/White)',
      'BW': 'Orzhov (White/Black)',
      'RU': 'Izzet (Blue/Red)',
      'BG': 'Golgari (Black/Green)',
      'RW': 'Boros (Red/White)',
      'GU': 'Simic (Green/Blue)',
    };
    return pairNames[pair];
  }
  return undefined;
}

export function normalizeScryfallCard(rawCard: any): Card {
  const hasFaces = Array.isArray(rawCard.card_faces) && rawCard.card_faces.length > 1;

  let image_uris = rawCard.image_uris;
  if (!image_uris && hasFaces && rawCard.card_faces[0].image_uris) {
    image_uris = rawCard.card_faces[0].image_uris;
  }

  let card_faces: CardFace[] | undefined;
  if (hasFaces) {
    card_faces = rawCard.card_faces.map((face: any) => ({
      name: face.name,
      mana_cost: face.mana_cost,
      type_line: face.type_line || '',
      oracle_text: face.oracle_text || '',
      power: face.power,
      toughness: face.toughness,
      image_uris: face.image_uris,
      colors: (face.colors || []) as MTGColor[],
    }));
  }

  const typeLine = rawCard.type_line || (card_faces ? card_faces[0].type_line : '');
  const oracleText = rawCard.oracle_text || (card_faces ? card_faces.map(f => f.oracle_text).join('\n//\n') : '');
  const manaCost = rawCard.mana_cost || (card_faces ? card_faces[0].mana_cost : '');
  const power = rawCard.power || (card_faces ? card_faces[0].power : undefined);
  const toughness = rawCard.toughness || (card_faces ? card_faces[0].toughness : undefined);

  const colors = (rawCard.colors || (card_faces ? card_faces[0].colors : [])) as MTGColor[];
  const colorIdentity = (rawCard.color_identity || []) as MTGColor[];

  const isInstant = typeLine.toLowerCase().includes('instant') || (rawCard.keywords || []).some((k: string) => k.toLowerCase() === 'flash');
  const isCreature = typeLine.toLowerCase().includes('creature');
  const isLand = typeLine.toLowerCase().includes('land');

  const arenaId = typeof rawCard.arena_id === 'number'
    ? rawCard.arena_id
    : rawCard.arena_id
    ? Number(rawCard.arena_id)
    : (rawCard.card_faces?.[0]?.arena_id ? Number(rawCard.card_faces[0].arena_id) : undefined);

  const card: Card = {
    id: rawCard.id,
    arena_id: (typeof arenaId === 'number' && !isNaN(arenaId)) ? arenaId : undefined,
    name: rawCard.name,
    set: (rawCard.set || '').toUpperCase(),
    set_name: rawCard.set_name || '',
    collector_number: rawCard.collector_number || '',
    mana_cost: manaCost,
    cmc: rawCard.cmc ?? 0,
    type_line: typeLine,
    oracle_text: oracleText,
    power,
    toughness,
    colors: colors.length > 0 ? colors : ['C'],
    color_identity: colorIdentity,
    rarity: rawCard.rarity as MTGRarity,
    keywords: rawCard.keywords || [],
    image_uris,
    card_faces,
    layout: rawCard.layout,
    scryfall_uri: rawCard.scryfall_uri,
    booster: typeof rawCard.booster === 'boolean' ? rawCard.booster : undefined,
    promo: typeof rawCard.promo === 'boolean' ? rawCard.promo : undefined,
    finishes: Array.isArray(rawCard.finishes) ? rawCard.finishes : undefined,
    frame_effects: Array.isArray(rawCard.frame_effects) ? rawCard.frame_effects : undefined,
    is_instant_speed: isInstant,
    is_creature: isCreature,
    is_land: isLand,
  };

  card.is_combat_trick = isCombatTrick(card);
  card.is_removal = isRemovalSpell(card);
  card.is_counterspell = isCounterspell(card);
  card.is_card_draw = isCardDrawSpell(card);
  card.is_interaction = isInteractionSpell(card);
  card.archetype_tag = identifySignpostArchetype(card);

  return card;
}

export async function fetchAllSets(): Promise<SetInfo[]> {
  try {
    const cachedSets = await get<SetInfo[]>('scryfall_all_sets_v7');
    if (cachedSets && cachedSets.length > 0) {
      return cachedSets;
    }

    const response = await fetch(`${SCRYFALL_API_BASE}/sets`, {
      headers: {
        'User-Agent': 'MTGLimitedIQ/2.0 (https://mtg-limited-iq.com)',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Scryfall API returned status ${response.status}`);
    }

    const data = await response.json();
    const draftableSetTypes = new Set(['core', 'expansion', 'masters', 'draft_innovation', 'starter', 'alchemy']);

    const validSets: SetInfo[] = data.data
      .filter((s: any) => draftableSetTypes.has(s.set_type) && s.card_count > 30 && (!s.digital || KNOWN_17LANDS_EXPANSIONS.has(s.code.toUpperCase())))
      .map((s: any) => {
        const popMatch = POPULAR_LIMITED_SETS.find((p) => p.code.toUpperCase() === s.code.toUpperCase());
        const has17L = popMatch ? Boolean(popMatch.has_17lands_data) : KNOWN_17LANDS_EXPANSIONS.has(s.code.toUpperCase());
        const effectiveCardCount = popMatch ? Math.max(s.card_count, popMatch.card_count) : s.card_count;
        return {
          code: s.code.toUpperCase(),
          name: s.name,
          card_count: effectiveCardCount,
          released_at: s.released_at,
          icon_svg_uri: s.icon_svg_uri,
          set_type: s.set_type,
          has_17lands_data: has17L,
        };
      });

    // Ensure our popular sets are cleanly merged in with their exact metadata
    const merged = [...validSets];
    POPULAR_LIMITED_SETS.forEach((pop) => {
      const idx = merged.findIndex((m) => m.code.toUpperCase() === pop.code.toUpperCase());
      if (idx >= 0) {
        merged[idx].has_17lands_data = Boolean(pop.has_17lands_data);
        merged[idx].card_count = Math.max(merged[idx].card_count, pop.card_count);
      } else {
        merged.unshift(pop);
      }
    });

    await set('scryfall_all_sets_v7', merged);
    return merged;
  } catch (err) {
    console.warn('Using popular limited sets fallback due to fetch error:', err);
    return POPULAR_LIMITED_SETS;
  }
}

export function isBasicLand(card: Card | { name?: string; type_line?: string }): boolean {
  if (!card) return false;
  const typeLine = (card.type_line || '').toLowerCase();
  if (typeLine.includes('basic') && typeLine.includes('land')) return true;
  const name = (card.name || '').trim().toLowerCase();
  const standardBasics = [
    'plains', 'island', 'swamp', 'mountain', 'forest', 'wastes',
    'snow-covered plains', 'snow-covered island', 'snow-covered swamp', 'snow-covered mountain', 'snow-covered forest'
  ];
  return standardBasics.includes(name);
}

/**
 * Deduplicates cards in a set by exact card name, with an explicit exception for Basic Lands.
 * When multiple treatments/variants exist for the same card in a set (e.g. standard frame vs showcase/borderless/extended art/promo),
 * this preserves the canonical base booster printing:
 * 1. Prefer booster pack printings (booster !== false) over special bonus/commander/promo sheets
 * 2. Prefer non-promo printings (promo !== true) over promo versions
 * 3. Prefer lowest numeric collector number (standard booster cards in MTG sets are always assigned the lowest collector numbers)
 * 4. Maintain consistent set ordering
 * 
 * BASIC LAND EXCEPTION:
 * For Basic Lands, distinct collector number variants (e.g. Plains #281 and Plains #282 in Reality Fracture FRA)
 * are preserved so that total card counts match physical booster set runs. Duplicate treatments of the same collector
 * number (e.g. promo/foil variants of the same number) are still cleanly deduplicated.
 */
export function deduplicateCards(cards: Card[]): Card[] {
  if (!cards || cards.length === 0) return [];

  const map = new Map<string, Card>();

  for (const card of cards) {
    if (!card || !card.name) continue;
    const exactName = card.name.trim();
    const isBasic = isBasicLand(card);
    const key = isBasic
      ? `${exactName.toLowerCase()}_${(card.collector_number || '').trim().toLowerCase()}`
      : exactName.toLowerCase();
    const existing = map.get(key);

    if (!existing) {
      map.set(key, card);
      continue;
    }

    let preferCandidate = false;

    // 1. Prefer booster packs over non-booster cards
    if (existing.booster === false && card.booster === true) {
      preferCandidate = true;
    } else if (existing.booster === true && card.booster === false) {
      preferCandidate = false;
    } else if (existing.promo === true && card.promo === false) {
      // 2. Prefer non-promo over promo
      preferCandidate = true;
    } else if (existing.promo === false && card.promo === true) {
      preferCandidate = false;
    } else {
      // 3. Prefer lower numeric collector number (e.g. #2 Beza over #287 showcase Beza)
      const existingNum = parseInt(existing.collector_number.replace(/\D/g, ''), 10);
      const candidateNum = parseInt(card.collector_number.replace(/\D/g, ''), 10);

      if (!isNaN(existingNum) && !isNaN(candidateNum)) {
        if (candidateNum < existingNum) {
          preferCandidate = true;
        }
      }
    }

    if (preferCandidate) {
      map.set(key, card);
    }
  }

  return Array.from(map.values());
}

export async function fetchCardsForSet(
  setCode: string,
  onProgress?: (loaded: number, total: number) => void,
  onCachedCards?: (cards: Card[]) => void
): Promise<Card[]> {
  const upperCode = setCode.toUpperCase();
  const cacheKey = `scryfall_cards_${upperCode}_v9`;
  const legacyCacheKeys = [
    `scryfall_cards_${upperCode}_v8`,
    `scryfall_cards_${upperCode}_v7`,
    `scryfall_cards_${upperCode}_v6`,
    `scryfall_cards_${upperCode}_v5`,
  ];

  // 1. Read cached cards from IndexedDB if available and deliver immediately for instant UI
  let cachedCards: Card[] | null = null;
  const popSet = POPULAR_LIMITED_SETS.find((p) => p.code.toUpperCase() === upperCode);
  const targetSetCount = popSet?.card_count || 0;

  try {
    let rawCached = await get<Card[]>(cacheKey);
    if (!rawCached || rawCached.length === 0) {
      for (const legacyKey of legacyCacheKeys) {
        rawCached = await get<Card[]>(legacyKey);
        if (rawCached && rawCached.length > 0) break;
      }
    }
    if (rawCached && rawCached.length > 0) {
      // STRICT SET FILTER & DEDUPLICATION: strictly keep only cards for this set and deduplicate treatments by exact name!
      const strictlyFiltered = deduplicateCards(rawCached.filter(c => c.set.toUpperCase() === upperCode));
      if (strictlyFiltered.length > 0) {
        cachedCards = strictlyFiltered;
        if (onCachedCards) {
          onCachedCards(strictlyFiltered);
        }
      }
    }
  } catch (e) {
    console.warn('IndexedDB read error:', e);
  }

  const allCards: Card[] = [];
  // Use unique=cards to query canonical unique cards without duplicate treatments/variants
  const query = encodeURIComponent(`set:${upperCode.toLowerCase()} -layout:art_series -t:token`);
  let nextUrl: string | null = `${SCRYFALL_API_BASE}/cards/search?q=${query}&unique=cards&order=set`;

  try {
    let isFirstPage = true;

    while (nextUrl) {
      let response: Response | null = null;
      let retries = 0;

      while (retries < 3) {
        try {
          response = await fetch(nextUrl, {
            headers: {
              'User-Agent': 'MTGLimitedIQ/2.0 (https://mtg-limited-iq.com)',
              Accept: 'application/json',
            },
          });
          if (response.status === 429) {
            // Rate limit encountered, wait with backoff
            await new Promise((res) => setTimeout(res, 600 * (retries + 1)));
            retries++;
            continue;
          }
          break;
        } catch (fetchErr) {
          retries++;
          if (retries >= 3) throw fetchErr;
          await new Promise((res) => setTimeout(res, 500 * retries));
        }
      }

      if (!response || !response.ok) {
        throw new Error(`Scryfall card search failed: ${response?.status} ${response?.statusText}`);
      }

      const data: any = await response.json();
      const totalCount = typeof data.total_cards === 'number' ? data.total_cards : 0;

      if (Array.isArray(data.data)) {
        const normalized = data.data
          // STRICT SET FILTER: strictly keep only cards whose set code matches the requested set!
          .filter((c: any) => c.set?.toUpperCase() === upperCode && (c.image_uris || (c.card_faces && c.card_faces[0]?.image_uris)))
          .map(normalizeScryfallCard);
        allCards.push(...normalized);
      }

      // Check on EVERY load: Does cached cards count match or exceed the target set count or live Scryfall total?
      // If cachedCards already matches targetSetCount (e.g. 290) or live totalCount and set exceeds 1 page,
      // the cache is confirmed complete and we can return cachedCards without fetching subsequent pages.
      const isComplete = targetSetCount > 0
        ? (cachedCards && cachedCards.length >= targetSetCount)
        : (cachedCards && totalCount > 0 && cachedCards.length >= totalCount && totalCount > 175);

      if (isFirstPage && isComplete && cachedCards) {
        set(cacheKey, cachedCards).catch(() => {});
        return cachedCards;
      }
      isFirstPage = false;

      if (onProgress) {
        onProgress(allCards.length, Math.max(targetSetCount, totalCount, allCards.length));
      }

      nextUrl = data.has_more ? data.next_page : null;

      if (nextUrl) {
        // Respect Scryfall polite rate limit (50-100ms)
        await new Promise((res) => setTimeout(res, 80));
      }
    }

    // Fetch additional basic land printings within the set's main collector run so distinct basic land variants are retained
    try {
      const basicQuery = encodeURIComponent(`set:${upperCode.toLowerCase()} t:basic -layout:art_series -t:token`);
      const basicUrl = `${SCRYFALL_API_BASE}/cards/search?q=${basicQuery}&unique=prints&order=set`;
      const basicRes = await fetch(basicUrl, {
        headers: {
          'User-Agent': 'MTGLimitedIQ/2.0 (https://mtg-limited-iq.com)',
          Accept: 'application/json',
        },
      });
      if (basicRes.ok) {
        const basicData: any = await basicRes.json();
        if (Array.isArray(basicData.data)) {
          const maxCollectorNum = targetSetCount > 0 ? targetSetCount : 400;
          const normalizedBasics = basicData.data
            .filter((c: any) => {
              if (c.set?.toUpperCase() !== upperCode) return false;
              if (!c.image_uris && (!c.card_faces || !c.card_faces[0]?.image_uris)) return false;
              const num = parseInt(String(c.collector_number || '').replace(/\D/g, ''), 10);
              return isNaN(num) || num <= maxCollectorNum;
            })
            .map(normalizeScryfallCard);
          allCards.push(...normalizedBasics);
        }
      }
    } catch (basicErr) {
      console.warn(`Could not fetch extra basic land prints for ${upperCode}:`, basicErr);
    }

    const dedupedCards = deduplicateCards(allCards);

    if (dedupedCards.length > 0) {
      try {
        await set(cacheKey, dedupedCards);
      } catch (e) {
        console.warn('Failed to cache cards in IndexedDB:', e);
      }
      return dedupedCards;
    }

    // If zero cards returned from API, check cached cards or fallback
    if (cachedCards && cachedCards.length > 0) {
      return cachedCards;
    }
    const sample = deduplicateCards(getFallbackCards(upperCode));
    if (sample.length > 0) {
      return sample;
    }

    return dedupedCards;
  } catch (err) {
    console.error(`Failed to fetch cards for set ${upperCode}:`, err);
    // Return cached cards if available when network fails
    if (cachedCards && cachedCards.length > 0) {
      return cachedCards;
    }
    // Return sample offline cards if available strictly for this set
    const sample = deduplicateCards(getFallbackCards(upperCode));
    if (sample.length > 0) {
      return sample;
    }
    throw err;
  }
}

// Curated offline fallback cards strictly per set
export function getFallbackCards(setCode: string): Card[] {
  const upper = setCode.toUpperCase();

  if (upper === 'SOS') {
    return [
      {
        id: 'sos-1',
        name: 'Pterafractyl',
        set: 'SOS',
        set_name: 'Secrets of Strixhaven',
        collector_number: '215',
        mana_cost: '{X}{G}{U}',
        cmc: 2,
        type_line: 'Creature — Dinosaur Fractal',
        oracle_text: 'Flying\nThis creature enters with X +1/+1 counters on it.\nWhen this creature enters, you gain 2 life.',
        power: '1',
        toughness: '0',
        colors: ['G', 'U'],
        color_identity: ['G', 'U'],
        rarity: 'common',
        keywords: ['Flying'],
        image_uris: {
          small: 'https://cards.scryfall.io/small/front/e/c/ecd33152-e290-4505-addd-a8d08cefdddd.jpg',
          normal: 'https://cards.scryfall.io/normal/front/e/c/ecd33152-e290-4505-addd-a8d08cefdddd.jpg',
          large: 'https://cards.scryfall.io/large/front/e/c/ecd33152-e290-4505-addd-a8d08cefdddd.jpg',
          art_crop: 'https://cards.scryfall.io/art_crop/front/e/c/ecd33152-e290-4505-addd-a8d08cefdddd.jpg',
          png: 'https://cards.scryfall.io/png/front/e/c/ecd33152-e290-4505-addd-a8d08cefdddd.png',
        },
        is_creature: true,
        is_instant_speed: false,
        is_combat_trick: false,
        is_removal: false,
        archetype_tag: 'Simic (Green/Blue)',
      },
      {
        id: 'sos-2',
        name: 'Professor Dellian Fel',
        set: 'SOS',
        set_name: 'Secrets of Strixhaven',
        collector_number: '214',
        mana_cost: '{2}{U}{R}',
        cmc: 4,
        type_line: 'Legendary Planeswalker — Dellian',
        oracle_text: '+1: Draw a card, then discard a card unless you cast an instant or sorcery spell this turn.\n-2: Dellian deals 3 damage to any target.\n-7: You get an emblem with "Whenever you cast an instant or sorcery spell, copy it twice. You may choose new targets for the copies."',
        colors: ['U', 'R'],
        color_identity: ['U', 'R'],
        rarity: 'mythic',
        keywords: [],
        image_uris: {
          small: 'https://cards.scryfall.io/small/front/6/f/6ff3b4d8-1271-4c5d-8834-7662244f173d.jpg',
          normal: 'https://cards.scryfall.io/normal/front/6/f/6ff3b4d8-1271-4c5d-8834-7662244f173d.jpg',
          large: 'https://cards.scryfall.io/large/front/6/f/6ff3b4d8-1271-4c5d-8834-7662244f173d.jpg',
          art_crop: 'https://cards.scryfall.io/art_crop/front/6/f/6ff3b4d8-1271-4c5d-8834-7662244f173d.jpg',
          png: 'https://cards.scryfall.io/png/front/6/f/6ff3b4d8-1271-4c5d-8834-7662244f173d.png',
        },
        is_creature: false,
        is_instant_speed: false,
        is_combat_trick: false,
        is_removal: true,
        archetype_tag: 'Izzet (Blue/Red)',
      },
    ];
  }

  if (upper === 'BLB') {
    return [
      {
        id: 'blb-1',
        name: 'Heartfire Hero',
        set: 'BLB',
        set_name: 'Bloomburrow',
        collector_number: '138',
        mana_cost: '{R}',
        cmc: 1,
        type_line: 'Creature — Mouse Soldier',
        oracle_text: 'Valiant — Whenever Heartfire Hero becomes the target of a spell or ability you control for the first time each turn, put a +1/+1 counter on it.\nWhen Heartfire Hero dies, it deals damage equal to its power to each opponent.',
        power: '1',
        toughness: '1',
        colors: ['R'],
        color_identity: ['R'],
        rarity: 'uncommon',
        keywords: ['Valiant'],
        image_uris: {
          small: 'https://cards.scryfall.io/small/front/a/1/a19fb3b2-3326-4853-a353-73d73d04ced1.jpg',
          normal: 'https://cards.scryfall.io/normal/front/a/1/a19fb3b2-3326-4853-a353-73d73d04ced1.jpg',
          large: 'https://cards.scryfall.io/large/front/a/1/a19fb3b2-3326-4853-a353-73d73d04ced1.jpg',
          art_crop: 'https://cards.scryfall.io/art_crop/front/a/1/a19fb3b2-3326-4853-a353-73d73d04ced1.jpg',
          png: 'https://cards.scryfall.io/png/front/a/1/a19fb3b2-3326-4853-a353-73d73d04ced1.png',
        },
        is_creature: true,
        is_instant_speed: false,
        is_combat_trick: false,
        is_removal: false,
      },
      {
        id: 'blb-2',
        name: 'Fell',
        set: 'BLB',
        set_name: 'Bloomburrow',
        collector_number: '95',
        mana_cost: '{1}{B}',
        cmc: 2,
        type_line: 'Sorcery',
        oracle_text: 'Destroy target creature or planeswalker.',
        colors: ['B'],
        color_identity: ['B'],
        rarity: 'uncommon',
        keywords: [],
        image_uris: {
          small: 'https://cards.scryfall.io/small/front/d/9/d96ac301-4066-417c-9f73-a677614376a8.jpg',
          normal: 'https://cards.scryfall.io/normal/front/d/9/d96ac301-4066-417c-9f73-a677614376a8.jpg',
          large: 'https://cards.scryfall.io/large/front/d/9/d96ac301-4066-417c-9f73-a677614376a8.jpg',
          art_crop: 'https://cards.scryfall.io/art_crop/front/d/9/d96ac301-4066-417c-9f73-a677614376a8.jpg',
          png: 'https://cards.scryfall.io/png/front/d/9/d96ac301-4066-417c-9f73-a677614376a8.png',
        },
        is_creature: false,
        is_instant_speed: false,
        is_combat_trick: false,
        is_removal: true,
      },
      {
        id: 'blb-3',
        name: 'Might of the Meek',
        set: 'BLB',
        set_name: 'Bloomburrow',
        collector_number: '144',
        mana_cost: '{R}',
        cmc: 1,
        type_line: 'Instant',
        oracle_text: 'Target creature gets +1/+0 and gains trample until end of turn. If you control a Mouse, draw a card.',
        colors: ['R'],
        color_identity: ['R'],
        rarity: 'common',
        keywords: ['Trample'],
        image_uris: {
          small: 'https://cards.scryfall.io/small/front/3/7/37d82468-d0c2-40c9-9565-5e15a269b369.jpg',
          normal: 'https://cards.scryfall.io/normal/front/3/7/37d82468-d0c2-40c9-9565-5e15a269b369.jpg',
          large: 'https://cards.scryfall.io/large/front/3/7/37d82468-d0c2-40c9-9565-5e15a269b369.jpg',
          art_crop: 'https://cards.scryfall.io/art_crop/front/3/7/37d82468-d0c2-40c9-9565-5e15a269b369.jpg',
          png: 'https://cards.scryfall.io/png/front/3/7/37d82468-d0c2-40c9-9565-5e15a269b369.png',
        },
        is_creature: false,
        is_instant_speed: true,
        is_combat_trick: true,
        is_removal: false,
      },
      {
        id: 'blb-4',
        name: 'Banishing Light',
        set: 'BLB',
        set_name: 'Bloomburrow',
        collector_number: '1',
        mana_cost: '{2}{W}',
        cmc: 3,
        type_line: 'Enchantment',
        oracle_text: 'When Banishing Light enters, exile target nonland permanent an opponent controls until Banishing Light leaves the battlefield.',
        colors: ['W'],
        color_identity: ['W'],
        rarity: 'uncommon',
        keywords: [],
        image_uris: {
          small: 'https://cards.scryfall.io/small/front/e/e/ee335272-97fa-4252-a583-0ec3851bfa7a.jpg',
          normal: 'https://cards.scryfall.io/normal/front/e/e/ee335272-97fa-4252-a583-0ec3851bfa7a.jpg',
          large: 'https://cards.scryfall.io/large/front/e/e/ee335272-97fa-4252-a583-0ec3851bfa7a.jpg',
          art_crop: 'https://cards.scryfall.io/art_crop/front/e/e/ee335272-97fa-4252-a583-0ec3851bfa7a.jpg',
          png: 'https://cards.scryfall.io/png/front/e/e/ee335272-97fa-4252-a583-0ec3851bfa7a.png',
        },
        is_creature: false,
        is_instant_speed: false,
        is_combat_trick: false,
        is_removal: true,
      },
      {
        id: 'blb-5',
        name: 'Seedgale Foster',
        set: 'BLB',
        set_name: 'Bloomburrow',
        collector_number: '192',
        mana_cost: '{4}{G}',
        cmc: 5,
        type_line: 'Creature — Fox Scout',
        oracle_text: 'Vigilance\nWhenever Seedgale Foster attacks, target creature you control gets +1/+1 until end of turn.',
        power: '4',
        toughness: '4',
        colors: ['G'],
        color_identity: ['G'],
        rarity: 'common',
        keywords: ['Vigilance'],
        image_uris: {
          small: 'https://cards.scryfall.io/small/front/9/9/99a4c005-24c1-4b10-85f2-95fcae394336.jpg',
          normal: 'https://cards.scryfall.io/normal/front/9/9/99a4c005-24c1-4b10-85f2-95fcae394336.jpg',
          large: 'https://cards.scryfall.io/large/front/9/9/99a4c005-24c1-4b10-85f2-95fcae394336.jpg',
          art_crop: 'https://cards.scryfall.io/art_crop/front/9/9/99a4c005-24c1-4b10-85f2-95fcae394336.jpg',
          png: 'https://cards.scryfall.io/png/front/9/9/99a4c005-24c1-4b10-85f2-95fcae394336.png',
        },
        is_creature: true,
        is_instant_speed: false,
        is_combat_trick: false,
        is_removal: false,
      },
      {
        id: 'blb-6',
        name: 'Valley Questcaller',
        set: 'BLB',
        set_name: 'Bloomburrow',
        collector_number: '36',
        mana_cost: '{1}{W}',
        cmc: 2,
        type_line: 'Creature — Rabbit Warrior',
        oracle_text: 'Other Rabbits, Bats, Birds, and Mice you control get +1/+1.\nWhenever you cast a Rabbit, Bat, Bird, or Mouse spell, scry 1.',
        power: '2',
        toughness: '3',
        colors: ['W'],
        color_identity: ['W'],
        rarity: 'rare',
        keywords: [],
        image_uris: {
          small: 'https://cards.scryfall.io/small/front/b/a/ba629ca8-a368-4282-8a61-9bf6a5c217f0.jpg',
          normal: 'https://cards.scryfall.io/normal/front/b/a/ba629ca8-a368-4282-8a61-9bf6a5c217f0.jpg',
          large: 'https://cards.scryfall.io/large/front/b/a/ba629ca8-a368-4282-8a61-9bf6a5c217f0.jpg',
          art_crop: 'https://cards.scryfall.io/art_crop/front/b/a/ba629ca8-a368-4282-8a61-9bf6a5c217f0.jpg',
          png: 'https://cards.scryfall.io/png/front/b/a/ba629ca8-a368-4282-8a61-9bf6a5c217f0.png',
        },
        is_creature: true,
        is_instant_speed: false,
        is_combat_trick: false,
        is_removal: false,
      },
      {
        id: 'blb-7',
        name: 'Cache Grab',
        set: 'BLB',
        set_name: 'Bloomburrow',
        collector_number: '167',
        mana_cost: '{1}{G}',
        cmc: 2,
        type_line: 'Instant',
        oracle_text: 'Mill four cards. Then you may put a permanent card from among the milled cards into your hand. If you control a Squirrel, create a Food token.',
        colors: ['G'],
        color_identity: ['G'],
        rarity: 'common',
        keywords: ['Mill'],
        image_uris: {
          small: 'https://cards.scryfall.io/small/front/d/f/dfd977dc-a7c3-4d0a-aca7-b25bd154e963.jpg',
          normal: 'https://cards.scryfall.io/normal/front/d/f/dfd977dc-a7c3-4d0a-aca7-b25bd154e963.jpg',
          large: 'https://cards.scryfall.io/large/front/d/f/dfd977dc-a7c3-4d0a-aca7-b25bd154e963.jpg',
          art_crop: 'https://cards.scryfall.io/art_crop/front/d/f/dfd977dc-a7c3-4d0a-aca7-b25bd154e963.jpg',
          png: 'https://cards.scryfall.io/png/front/d/f/dfd977dc-a7c3-4d0a-aca7-b25bd154e963.png',
        },
        is_creature: false,
        is_instant_speed: true,
        is_combat_trick: false,
        is_removal: false,
      },
    ];
  }

  if (upper === 'FRA') {
    return [
      {
        id: 'fra-1',
        name: 'Konstrari Improviser // Soul Tether',
        set: 'FRA',
        set_name: 'Reality Fracture',
        collector_number: '1',
        mana_cost: '{1}{R/G} // {2}{R/G}',
        cmc: 2,
        type_line: 'Creature — Human Artificer // Sorcery',
        oracle_text: 'This creature enters prepared.\n//\nCreate a Heartwood token.',
        power: '2',
        toughness: '2',
        colors: ['G', 'R'],
        color_identity: ['G', 'R'],
        rarity: 'common',
        keywords: [],
        image_uris: {
          small: 'https://cards.scryfall.io/small/front/k/o/konstrari.jpg',
          normal: 'https://cards.scryfall.io/normal/front/k/o/konstrari.jpg',
          large: 'https://cards.scryfall.io/large/front/k/o/konstrari.jpg',
          art_crop: 'https://cards.scryfall.io/art_crop/front/k/o/konstrari.jpg',
          png: 'https://cards.scryfall.io/png/front/k/o/konstrari.png',
        },
        is_creature: true,
      },
      {
        id: 'fra-2',
        name: 'Woodwork Prodigy // Soul Tether',
        set: 'FRA',
        set_name: 'Reality Fracture',
        collector_number: '2',
        mana_cost: '{2}{R/G} // {2}{R/G}',
        cmc: 3,
        type_line: 'Creature — Cat Druid // Sorcery',
        oracle_text: 'At the beginning of your upkeep, if this creature isn\'t prepared, it becomes prepared.\n//\nCreate a Heartwood token.',
        power: '3',
        toughness: '3',
        colors: ['G', 'R'],
        color_identity: ['G', 'R'],
        rarity: 'uncommon',
        keywords: [],
        image_uris: {
          small: 'https://cards.scryfall.io/small/front/w/o/woodwork.jpg',
          normal: 'https://cards.scryfall.io/normal/front/w/o/woodwork.jpg',
          large: 'https://cards.scryfall.io/large/front/w/o/woodwork.jpg',
          art_crop: 'https://cards.scryfall.io/art_crop/front/w/o/woodwork.jpg',
          png: 'https://cards.scryfall.io/png/front/w/o/woodwork.png',
        },
        is_creature: true,
      },
      {
        id: 'fra-3',
        name: 'Puppet Crafting',
        set: 'FRA',
        set_name: 'Reality Fracture',
        collector_number: '3',
        mana_cost: '{1}{G}',
        cmc: 2,
        type_line: 'Enchantment — Aura',
        oracle_text: 'Enchant artifact or non-Aura enchantment\nEnchanted permanent is a Construct creature with base power and toughness 5/5 in addition to its other types.\n{4}{G}: Return this card from your graveyard to your hand.',
        colors: ['G'],
        color_identity: ['G'],
        rarity: 'rare',
        keywords: [],
        image_uris: {
          small: 'https://cards.scryfall.io/small/front/p/u/puppet.jpg',
          normal: 'https://cards.scryfall.io/normal/front/p/u/puppet.jpg',
          large: 'https://cards.scryfall.io/large/front/p/u/puppet.jpg',
          art_crop: 'https://cards.scryfall.io/art_crop/front/p/u/puppet.jpg',
          png: 'https://cards.scryfall.io/png/front/p/u/puppet.png',
        },
        is_creature: false,
      },
      {
        id: 'fra-4',
        name: 'Hungering Puppetbeast',
        set: 'FRA',
        set_name: 'Reality Fracture',
        collector_number: '4',
        mana_cost: '{3}{G}{G}',
        cmc: 5,
        type_line: 'Artifact Creature — Beast Construct',
        oracle_text: 'When this creature enters, create a Heartwood token. (It\'s a red and green artifact with "{T}: Add {R} or {G}.")\n{1}, Sacrifice another artifact: Put a +1/+1 counter on this creature. It gains your choice of trample, hexproof, or haste until end of turn.',
        power: '5',
        toughness: '5',
        colors: ['G'],
        color_identity: ['G'],
        rarity: 'rare',
        keywords: [],
        image_uris: {
          small: 'https://cards.scryfall.io/small/front/h/u/hungering.jpg',
          normal: 'https://cards.scryfall.io/normal/front/h/u/hungering.jpg',
          large: 'https://cards.scryfall.io/large/front/h/u/hungering.jpg',
          art_crop: 'https://cards.scryfall.io/art_crop/front/h/u/hungering.jpg',
          png: 'https://cards.scryfall.io/png/front/h/u/hungering.png',
        },
        is_creature: true,
      },
      {
        id: 'fra-5',
        name: 'Tenured Tethermage',
        set: 'FRA',
        set_name: 'Reality Fracture',
        collector_number: '5',
        mana_cost: '{1}{R}{G}',
        cmc: 3,
        type_line: 'Creature — Human Artificer',
        oracle_text: 'When this creature enters, you may sacrifice a land. If you do, create two tapped Heartwood tokens. (They\'re red and green artifacts with "{T}: Add {R} or {G}.")\nTap two untapped artifacts you control: Put two +1/+1 counters on this creature.',
        power: '1',
        toughness: '1',
        colors: ['G', 'R'],
        color_identity: ['G', 'R'],
        rarity: 'rare',
        keywords: [],
        image_uris: {
          small: 'https://cards.scryfall.io/small/front/t/e/tethermage.jpg',
          normal: 'https://cards.scryfall.io/normal/front/t/e/tethermage.jpg',
          large: 'https://cards.scryfall.io/large/front/t/e/tethermage.jpg',
          art_crop: 'https://cards.scryfall.io/art_crop/front/t/e/tethermage.jpg',
          png: 'https://cards.scryfall.io/png/front/t/e/tethermage.png',
        },
        is_creature: true,
      },
      {
        id: 'fra-6',
        name: 'Heartwood Crafter // Soul Tether',
        set: 'FRA',
        set_name: 'Reality Fracture',
        collector_number: '6',
        mana_cost: '{G} // {2}{R/G}',
        cmc: 1,
        type_line: 'Creature — Elf Artificer // Sorcery',
        oracle_text: 'This creature enters prepared.\n{T}: Add {C}. This mana can\'t be spent to cast spells from your hand.\n//\nCreate a Heartwood token.',
        power: '1',
        toughness: '1',
        colors: ['G'],
        color_identity: ['G', 'R'],
        rarity: 'uncommon',
        keywords: [],
        image_uris: {
          small: 'https://cards.scryfall.io/small/front/h/c/heartwood_crafter.jpg',
          normal: 'https://cards.scryfall.io/normal/front/h/c/heartwood_crafter.jpg',
          large: 'https://cards.scryfall.io/large/front/h/c/heartwood_crafter.jpg',
          art_crop: 'https://cards.scryfall.io/art_crop/front/h/c/heartwood_crafter.jpg',
          png: 'https://cards.scryfall.io/png/front/h/c/heartwood_crafter.png',
        },
        is_creature: true,
      },
      {
        id: 'fra-7',
        name: 'Aerid Konstrari',
        set: 'FRA',
        set_name: 'Reality Fracture',
        collector_number: '7',
        mana_cost: '{1}{R}{G}{G}',
        cmc: 4,
        type_line: 'Legendary Creature — Elder Sphinx',
        oracle_text: 'Flying\nWhen Aerid Konstrari enters or dies, create a Heartwood token. (It\'s a red and green artifact with "{T}: Add {R} or {G}.")\n{6}: Create a Heartwood token. Then Aerid Konstrari gets +X/+0 until end of turn, where X is the number of artifacts you control.',
        power: '5',
        toughness: '4',
        colors: ['G', 'R'],
        color_identity: ['G', 'R'],
        rarity: 'mythic',
        keywords: ['Flying'],
        image_uris: {
          small: 'https://cards.scryfall.io/small/front/a/k/aerid.jpg',
          normal: 'https://cards.scryfall.io/normal/front/a/k/aerid.jpg',
          large: 'https://cards.scryfall.io/large/front/a/k/aerid.jpg',
          art_crop: 'https://cards.scryfall.io/art_crop/front/a/k/aerid.jpg',
          png: 'https://cards.scryfall.io/png/front/a/k/aerid.png',
        },
        is_creature: true,
      },
    ];
  }

  return [];
}
