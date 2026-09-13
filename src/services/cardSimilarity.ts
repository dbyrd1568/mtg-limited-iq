import { Card, GradeTier, MTGColor } from '../types/mtg';
import { normalizeScryfallCard, POPULAR_LIMITED_SETS } from './scryfall';
import { fetch17LandsSetData, winRateToGradeTier, gradeTierToIndex, indexToGradeTier, GRADE_SCORES, scoreToGradeTier, getOrEstimate17LandsCardRating } from './seventeenLands';

const SCRYFALL_API_BASE = 'https://api.scryfall.com';

// Benchmark modern premier booster draft sets with rich 17Lands sample sizes (released sets only)
export const COMPARABLE_PREMIER_SETS = [
  'FIN', 'ECL', 'TDM', 'EOE', 'TLA', 'TMT', 'SOS', 'MSH', 'DFT', 'FDN', 'DSK', 'BLB', 'MH3', 'OTJ', 'MKM', 'LCI', 'WOE', 'LTR', 'MOM', 'ONE', 'BRO', 'DMU', 'SNC', 'NEO', 'VOW', 'MID', 'AFR', 'STX', 'KHM', 'ZNR', 'IKO', 'ELD'
];

export interface SimilarCardMatch {
  card: Card;
  similarityScore: number; // 0 to 100%
  matchReasons: string[];
  winRate?: number;
  alsa?: number;
  tierGrade?: GradeTier;
}

export interface HistoricalCompsConsensus {
  sampleCount: number;
  projectedTier: GradeTier;
  averageWinRate?: number;
  minWinRate?: number;
  maxWinRate?: number;
  tierRangeMin?: GradeTier;
  tierRangeMax?: GradeTier;
  summaryText: string;
}

export interface CardSimilarityResult {
  targetCard: Card;
  matches: SimilarCardMatch[];
  consensus: HistoricalCompsConsensus;
}

// In-memory session cache to avoid repeating Scryfall calls for the same card
const similarityCache = new Map<string, CardSimilarityResult>();

// Known Limited functional effect clauses with category classification
export interface EffectPattern {
  pattern: RegExp;
  label: string;
  category: 'removal' | 'damage' | 'counter' | 'draw' | 'selection' | 'trick' | 'bounce' | 'pacifism' | 'token' | 'counters' | 'sweeper' | 'synergy' | 'graveyard' | 'equipment';
}

const EFFECT_PATTERNS: EffectPattern[] = [
  { pattern: /destroy target creature/i, label: 'Creature Removal', category: 'removal' },
  { pattern: /exile target creature/i, label: 'Exile Removal', category: 'removal' },
  { pattern: /destroy target (permanent|nonland permanent)/i, label: 'Permanent Removal', category: 'removal' },
  { pattern: /exile target (permanent|nonland permanent)/i, label: 'Exile Permanent', category: 'removal' },
  { pattern: /deals \d+ damage to (any target|target creature)/i, label: 'Burn / Direct Damage', category: 'damage' },
  { pattern: /deals \d+ damage to each creature/i, label: 'Board Wipe / Sweeper', category: 'sweeper' },
  { pattern: /destroy all creatures/i, label: 'Board Wipe / Wrath', category: 'sweeper' },
  { pattern: /counter target (spell|noncreature spell|creature spell)/i, label: 'Counterspell', category: 'counter' },
  { pattern: /draw (a|\d+) cards?/i, label: 'Card Draw', category: 'draw' },
  { pattern: /target creature gets [+-]\d+\/[+-]\d+/i, label: 'Stat Modifier', category: 'trick' },
  { pattern: /create (a|\d+) .* token/i, label: 'Token Creation', category: 'token' },
  { pattern: /put (a|\d+) \+1\/\+1 counter/i, label: '+1/+1 Counter', category: 'counters' },
  { pattern: /return target .* to its owner's hand/i, label: 'Bounce Effect', category: 'bounce' },
  { pattern: /target creature can't (block|attack)/i, label: 'Pacifism / Lock', category: 'pacifism' },
  { pattern: /enchanted creature (can't attack|can't block|doesn't untap)/i, label: 'Pacifism Aura', category: 'pacifism' },
  { pattern: /connive|recruit|draw a card, then discard/i, label: 'Looting / Card Selection', category: 'selection' },
  { pattern: /look at the top \d+ cards/i, label: 'Card Selection / Impulse', category: 'selection' },
  { pattern: /when .* enters the battlefield|when .* enters/i, label: 'ETB Ability', category: 'synergy' },
  { pattern: /sacrifice/i, label: 'Sacrifice Synergy', category: 'synergy' },
  { pattern: /from your graveyard|exile this card from your graveyard|flashback|disturb|embalm|eternalize/i, label: 'Graveyard Value', category: 'graveyard' },
  { pattern: /equipped creature gets [+-]\d+\/[+-]\d+|equip \{/i, label: 'Equipment Buff', category: 'equipment' },
];

export const COMBAT_KEYWORDS = [
  'flying', 'lifelink', 'deathtouch', 'menace', 'trample', 
  'vigilance', 'haste', 'ward', 'flash', 'reach', 'first strike', 'double strike'
];

/**
 * Strips reminder text in parentheses so that token definitions and rule reminders
 * do not falsely count as the host card's own abilities.
 */
export function cleanOracleText(oracleText: string): string {
  if (!oracleText) return '';
  return oracleText.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Extract functional clauses and keywords from a card
 */
export function extractCardFeatures(card: Card) {
  const typeLine = (card.type_line || '').toLowerCase();
  // For multi-faced cards (DFCs, Transform, Craft, Adventures), evaluate primary permanent / spell nature from the castable front face
  const frontTypeLine = (card.card_faces?.[0]?.type_line || typeLine.split(' // ')[0] || '').toLowerCase();
  // Strip reminder text to prevent token abilities (e.g. Jace token's "-3: Draw a card") from leaking into host card!
  const rawOracle = (card.oracle_text || '').toLowerCase();
  const oracle = cleanOracleText(rawOracle).toLowerCase();

  const isPlaneswalker = frontTypeLine.includes('planeswalker');
  const isBattle = frontTypeLine.includes('battle');
  const isLand = frontTypeLine.includes('land');
  const isCreature = frontTypeLine.includes('creature');
  const hasFlash = (card.keywords || []).some(k => k.toLowerCase() === 'flash') || oracle.includes('flash');
  const isInstant = frontTypeLine.includes('instant');
  const isSorcery = frontTypeLine.includes('sorcery');
  const isEnchantment = frontTypeLine.includes('enchantment');
  const isArtifact = frontTypeLine.includes('artifact');

  const creatureSubtypes = isCreature && frontTypeLine.includes('—')
    ? frontTypeLine.split('—')[1].trim().toLowerCase().split(/\s+/)
    : [];

  let primaryType = 'creature';
  if (isPlaneswalker) primaryType = 'planeswalker';
  else if (isBattle) primaryType = 'battle';
  else if (isLand) primaryType = 'land';
  else if (isInstant) primaryType = 'instant';
  else if (isSorcery) primaryType = 'sorcery';
  else if (isEnchantment) primaryType = 'enchantment';
  else if (isArtifact) primaryType = 'artifact';
  else if (isCreature) primaryType = 'creature';

  const isCombatTrick = (isInstant || hasFlash) && (
    /target creature gets [+-]\d+\/[+-]\d+/i.test(oracle) ||
    /gains (hexproof|indestructible|flying|first strike|lifelink|deathtouch)/i.test(oracle) ||
    /untap target creature/i.test(oracle)
  );

  const isAuraRemoval = isEnchantment && (
    oracle.includes('enchant creature') || oracle.includes('enchant permanent')
  ) && (
    oracle.includes("can't attack") || oracle.includes("can't block") || 
    oracle.includes("doesn't untap") || oracle.includes("exile")
  );

  const createsTokens = (oracle.includes('create') && oracle.includes('token')) || /amass/i.test(oracle);

  // Equipment & Living Weapon Features
  const isEquipment = frontTypeLine.includes('equipment') || /equip \{/i.test(oracle);
  const isLivingWeapon = isEquipment && (
    /living weapon|for mirrodin|job select/i.test(oracle) ||
    /when .* enters.*(amass|create).*attach/i.test(oracle)
  );

  let equipPowerBuff: number | undefined;
  let equipToughnessBuff: number | undefined;
  const buffMatch = oracle.match(/equipped creature gets ([+-]\d+)\/([+-]\d+)/i);
  if (buffMatch) {
    equipPowerBuff = parseInt(buffMatch[1], 10);
    equipToughnessBuff = parseInt(buffMatch[2], 10);
  }

  let equipCost: number | undefined;
  const equipMatch = oracle.match(/equip\s*\{(\d+|[wubrg])\}/i);
  if (equipMatch) {
    equipCost = parseInt(equipMatch[1], 10) || 1;
  }

  const grantedKeywords = new Set<string>();
  COMBAT_KEYWORDS.forEach(kw => {
    if (new RegExp(`(has|gains) ${kw}`, 'i').test(oracle) || new RegExp(`equipped creature.*${kw}`, 'i').test(oracle)) {
      grantedKeywords.add(kw);
    }
  });

  // METHOD 1: Lexical Effect Patterns
  const detectedClauses: { label: string; raw: string; category: string }[] = [];
  const detectedCategories = new Set<string>();

  EFFECT_PATTERNS.forEach((ep) => {
    if (ep.pattern.test(oracle)) {
      const match = oracle.match(ep.pattern);
      detectedClauses.push({ label: ep.label, raw: match ? match[0] : ep.label, category: ep.category });
      detectedCategories.add(ep.category);
    }
  });

  if (isAuraRemoval) {
    detectedCategories.add('removal');
    detectedCategories.add('pacifism');
  }

  // METHOD 2: Structural MTG Mechanics & Role Decomposition
  const actionSubtypes = new Set<string>();
  const valueRiders = new Set<string>();

  // 1. Counterspell Subtypes
  if (/counter target/i.test(oracle)) {
    if (/counter target .* unless/i.test(oracle)) {
      actionSubtypes.add('soft_tax_counter');
    } else if (/counter target (spell|instant or sorcery spell)/i.test(oracle)) {
      actionSubtypes.add('hard_counter');
    } else if (/counter target (noncreature|creature|artifact|enchantment) spell/i.test(oracle)) {
      actionSubtypes.add('restricted_counter');
    }
  }

  // 2. Removal Subtypes
  if (isAuraRemoval) {
    actionSubtypes.add('pacifism_aura');
  } else if (/destroy all creatures|deals \d+ damage to each creature|exile all creatures/i.test(oracle)) {
    actionSubtypes.add('sweeper');
  } else if (/deals \d+ damage to (any target|target creature)/i.test(oracle)) {
    actionSubtypes.add('burn_damage');
  } else if (/deals damage equal to (its|target creature's) power|fights target creature/i.test(oracle)) {
    actionSubtypes.add('bite_fight');
  } else if (/(destroy|exile) target (permanent|nonland permanent)/i.test(oracle)) {
    actionSubtypes.add('permanent_removal');
    actionSubtypes.add('unconditional_removal');
  } else if (/(destroy|exile) target creature/i.test(oracle)) {
    if (/with power|with mana value|tapped|that attacked|unless/i.test(oracle)) {
      actionSubtypes.add('conditional_removal');
    } else {
      actionSubtypes.add('unconditional_removal');
    }
  }

  // 3. Graveyard & Recursion Subtypes
  if (/return target .* from your graveyard to your hand|return (target|a) permanent card from your graveyard to your hand/i.test(oracle)) {
    actionSubtypes.add('recursion_to_hand');
  } else if (/return target .* from your graveyard to the battlefield|put target creature card from .* graveyard onto the battlefield/i.test(oracle)) {
    actionSubtypes.add('reanimation');
  } else if (/flashback|disturb|embalm|eternalize|escape/i.test(oracle)) {
    actionSubtypes.add('graveyard_cast');
  }

  // 4. Card Flow & Filtering Subtypes
  const cardKeywords = (card.keywords || []).map(k => k.toLowerCase());
  const isConnive = /connive|connives/i.test(rawOracle) || cardKeywords.includes('connive');
  const isRecruit = /recruit/i.test(rawOracle) || cardKeywords.includes('recruit');
  const isLootRummage = /draw a card, then discard|discard a card, then draw/i.test(rawOracle) || isConnive || isRecruit;
  const isHybrid = /\{[WUBRG]\/[WUBRG]\}|\{2\/[WUBRG]\}/i.test(card.mana_cost || '');

  const isTapLooter = /\{t\}[^:]*:.*(draw.*discard|discard.*draw)/i.test(rawOracle);
  const isEtbLooter = (/when .* enters/i.test(rawOracle) || /when .* enters/i.test(oracle)) && (isConnive || isRecruit || /draw a card, then discard/i.test(rawOracle));
  const isAttackLooter = (/whenever .* attacks/i.test(rawOracle) || /whenever .* attacks/i.test(oracle)) && (isConnive || isRecruit || /draw a card, then discard/i.test(rawOracle));

  if (/draw (two|three|\d+) cards/i.test(oracle) && !/draw a card/i.test(oracle)) {
    actionSubtypes.add('raw_draw');
  } else if (/draw a card/i.test(oracle)) {
    actionSubtypes.add('cantrip');
  }
  if (/look at the top \d+ cards|scry \d+|surveil \d+/i.test(oracle)) {
    actionSubtypes.add('card_selection');
  }
  if (isLootRummage) {
    actionSubtypes.add('loot_rummage');
    detectedCategories.add('selection');
  }
  if (isTapLooter) {
    actionSubtypes.add('tap_looter');
    detectedCategories.add('selection');
  }
  if (isEtbLooter) {
    actionSubtypes.add('etb_looter');
    detectedCategories.add('selection');
  }
  if (isAttackLooter) {
    actionSubtypes.add('attack_looter');
    detectedCategories.add('selection');
  }
  if (isConnive || isRecruit) {
    actionSubtypes.add('connive_recruit');
    detectedCategories.add('selection');
  }

  // 5. Combat Trick Subtypes
  if (isCombatTrick) {
    if (/gets [+-]\d+\/[+-]\d+/i.test(oracle)) actionSubtypes.add('pump_trick');
    if (/gains (hexproof|indestructible|protection)/i.test(oracle)) actionSubtypes.add('protection_trick');
    if (/gains (flying|first strike|lifelink|deathtouch|trample)/i.test(oracle)) actionSubtypes.add('keyword_trick');
  }

  // 6. Creature Role Subtypes
  if (isCreature) {
    if (/{t}: add/i.test(oracle)) actionSubtypes.add('mana_dork');
    const hasEvasion = (card.keywords || []).some(k => /flying|menace|shadow|fear|intimidate/i.test(k)) ||
      /(^|\n)(flying|menace)\b/i.test(oracle) ||
      /\bthis creature can't be blocked\b/i.test(oracle) ||
      /\bcan't be blocked except\b/i.test(oracle);
    if (hasEvasion) actionSubtypes.add('evasion_threat');
    if (card.toughness !== undefined && card.power !== undefined) {
      const p = parseInt(card.power, 10);
      const t = parseInt(card.toughness, 10);
      if (t >= 4 && t > p) actionSubtypes.add('defensive_wall');
      if (p > t || (card.keywords || []).some(k => /haste/i.test(k))) actionSubtypes.add('aggressive_attacker');
    }
    if (/when .* enters the battlefield|when .* enters/i.test(rawOracle) || /when .* enters the battlefield|when .* enters/i.test(oracle)) {
      actionSubtypes.add('etb_value');
    }

    // ETB Treasure ramp/fixing creature subtype
    const createsTreasureOnEtb = (
      (/when .* enters/i.test(rawOracle) || /when .* enters/i.test(oracle)) &&
      /create (a|two|\d+)?.*treasure/i.test(oracle)
    );
    if (createsTreasureOnEtb) {
      actionSubtypes.add('etb_treasure');
      valueRiders.add('treasure');
      detectedCategories.add('synergy');
    }

    // Flash & Reach ambush blocker
    const hasFlashAndReach = (
      ((card.keywords || []).some(k => /flash/i.test(k)) || oracle.includes('flash')) &&
      ((card.keywords || []).some(k => /reach/i.test(k)) || oracle.includes('reach'))
    );
    if (hasFlashAndReach) {
      actionSubtypes.add('flash_reach_ambush');
    }

    if (/deals combat damage to a player/i.test(oracle)) actionSubtypes.add('saboteur');
    if (/when .* dies/i.test(oracle)) actionSubtypes.add('death_trigger');

    const isAttackKeywordGranter = /whenever .* attacks/i.test(oracle) &&
      /(another target|target attacking|target creature).* gains (first strike|trample|deathtouch|menace|flying|lifelink|vigilance|double strike|haste|indestructible)/i.test(oracle);
    if (isAttackKeywordGranter) {
      actionSubtypes.add('attack_keyword_granter');
      detectedCategories.add('trick');
    }
  }

  // ETB Counter Distribution & Growth Subtypes
  if (/when .* enters/i.test(oracle) && /put (a|\d+) \+1\/\+1 counter on (target|another|a) creature/i.test(oracle)) {
    actionSubtypes.add('etb_counter_distributor');
    valueRiders.add('counters');
    detectedCategories.add('counters');
  } else if (/when .* enters/i.test(oracle) && (/put (a|\d+) \+1\/\+1 counter on this/i.test(oracle) || /explores/i.test(oracle) || /enters.*with (a|\d+) \+1\/\+1 counter/i.test(oracle))) {
    actionSubtypes.add('etb_counter_self');
    valueRiders.add('counters');
    detectedCategories.add('counters');
  }

  // 7. Equipment Subtypes
  if (isEquipment) {
    actionSubtypes.add('equipment');
    detectedCategories.add('equipment');
    if (isLivingWeapon) {
      actionSubtypes.add('living_weapon');
      valueRiders.add('token');
      detectedCategories.add('token');
    }
  }

  // 8. Artifact Utility Subtypes (ETB filtering, activated sacrifice sink, mana rock)
  if (isArtifact) {
    const isEtbScryArtifact = (
      (/when .* enters/i.test(rawOracle) || /when .* enters/i.test(oracle)) &&
      (/scry \d+/i.test(rawOracle) || /surveil \d+/i.test(rawOracle))
    );
    if (isEtbScryArtifact) {
      actionSubtypes.add('etb_scry_artifact');
      detectedCategories.add('selection');
    }

    const isArtifactSacSink = /sacrifice\s+([^:]+):/i.test(oracle);
    if (isArtifactSacSink) {
      actionSubtypes.add('artifact_sac_sink');
      detectedCategories.add('synergy');
    }

    if (/{t}: add/i.test(oracle)) {
      actionSubtypes.add('mana_rock');
    }
  }

  // Cost Structure
  let costProfile: 'additional_cost' | 'cost_reduction' | 'standard_cost' = 'standard_cost';
  if (/as an additional cost|kicker|spree|gift|bargain|casualty|sacrifice (a|another) (creature|artifact)|tap an untapped|behold/i.test(oracle)) {
    costProfile = 'additional_cost';
  } else if (/this spell costs \{\d+\} less|affinity|convoke|delve|improvise/i.test(oracle)) {
    costProfile = 'cost_reduction';
  }

  // Incidental Value Riders
  if (/proliferate/i.test(rawOracle)) valueRiders.add('proliferate');
  if (/surveil|scry/i.test(rawOracle)) valueRiders.add('surveil_scry');
  if (isConnive || /\+1\/\+1 counter/i.test(rawOracle)) valueRiders.add('counters');
  if (isRecruit || /create .* token|empower|amass/i.test(rawOracle)) valueRiders.add('token');
  if (/gain \d+ life|lifelink/i.test(rawOracle)) valueRiders.add('life_gain');
  if (/draw a card/i.test(rawOracle)) valueRiders.add('cantrip');
  if (isConnive || isRecruit || /if you discarded/i.test(rawOracle)) valueRiders.add('discard_payoff');

  // Effective CMC accounting for the Instant Speed Tax (-0.75 for noncreature instant/flash)
  const effectiveCmc = ((isInstant || hasFlash) && !isCreature) ? Math.max(0.5, (card.cmc || 0) - 0.75) : (card.cmc || 0);

  const cardColors = (card.colors || []).filter(c => c !== 'C');

  return {
    primaryType,
    isPlaneswalker,
    isBattle,
    isLand,
    isCreature,
    isInstant,
    isSorcery,
    isEnchantment,
    isArtifact,
    isEquipment,
    isLivingWeapon,
    equipPowerBuff,
    equipToughnessBuff,
    equipCost,
    grantedKeywords,
    hasFlash,
    isCombatTrick,
    isAuraRemoval,
    createsTokens,
    detectedClauses,
    detectedCategories,
    actionSubtypes,
    costProfile,
    valueRiders,
    cmc: card.cmc || 0,
    effectiveCmc,
    colors: cardColors,
    creatureSubtypes,
    power: card.power !== undefined ? parseInt(card.power, 10) : undefined,
    toughness: card.toughness !== undefined ? parseInt(card.toughness, 10) : undefined,
    rarity: (card.rarity || 'common').toLowerCase(),
    cleanOracle: oracle,
    rawOracle,
    isHybrid,
    isConnive,
    isRecruit,
  };
}

/**
 * Validates whether two cards are functionally compatible to be compared.
 * Card type acts as a hard filter / compatibility matrix (0 arbitrary points in score).
 * TYPE IS STRICT: Planeswalkers only compare to Planeswalkers, Battles only to Battles, Lands only to Lands.
 */
export function areCardTypesCompatible(target: Card, candidate: Card): boolean {
  const tFeatures = extractCardFeatures(target);
  const cFeatures = extractCardFeatures(candidate);

  // 1. Planeswalkers (Strict: Only planeswalker to planeswalker)
  if (tFeatures.isPlaneswalker || cFeatures.isPlaneswalker) {
    return tFeatures.isPlaneswalker && cFeatures.isPlaneswalker;
  }

  // 2. Battles (Strict: Only battle to battle)
  if (tFeatures.isBattle || cFeatures.isBattle) {
    return tFeatures.isBattle && cFeatures.isBattle;
  }

  // 3. Lands (Strict: Only land to land)
  if (tFeatures.isLand || cFeatures.isLand) {
    return tFeatures.isLand && cFeatures.isLand;
  }

  // 4. Equipment (Strict: Equipment only compares to Equipment)
  if (tFeatures.isEquipment || cFeatures.isEquipment) {
    return tFeatures.isEquipment && cFeatures.isEquipment;
  }

  // 5. Creatures
  if (tFeatures.isCreature || cFeatures.isCreature) {
    // A creature can compare to another creature, or to a spell that produces creature tokens
    return (tFeatures.isCreature && cFeatures.isCreature) ||
           (tFeatures.isCreature && cFeatures.createsTokens) ||
           (cFeatures.isCreature && tFeatures.createsTokens);
  }

  // 5. Non-permanent spells (Instants & Sorceries)
  const tSpell = tFeatures.isInstant || tFeatures.isSorcery;
  const cSpell = cFeatures.isInstant || cFeatures.isSorcery;

  if (tSpell && cSpell) {
    // Combat tricks must match instant speed
    if (tFeatures.isCombatTrick && !cFeatures.isInstant) return false;
    if (cFeatures.isCombatTrick && !tFeatures.isInstant) return false;
    return true;
  }

  // 6. Aura Removal can compare to Sorcery/Instant removal
  if (tFeatures.isAuraRemoval && (cSpell || cFeatures.isAuraRemoval)) return true;
  if (cFeatures.isAuraRemoval && (tSpell || tFeatures.isAuraRemoval)) return true;

  // 7. Artifacts and Enchantments
  if (tFeatures.isArtifact && cFeatures.isArtifact) return true;
  if (tFeatures.isEnchantment && cFeatures.isEnchantment) return true;

  return false;
}

/**
 * Construct Scryfall search queries with prioritized fallback tiers.
 * Prioritizes EXACT color matches (e.g. c=w for mono-white) before broadening.
 */
function buildScryfallQueries(card: Card, features: ReturnType<typeof extractCardFeatures>): string[] {
  const setFilter = `(${COMPARABLE_PREMIER_SETS.map(s => `s:${s.toLowerCase()}`).join(' or ')})`;
  const baseFilter = `-is:reprint -t:basic -t:token -is:extra -is:alchemy ${setFilter}`;

  // Exclude the current set and exact same card name
  const excludeSelf = `-s:${card.set.toLowerCase()} -!"${card.name}"`;

  // Color Query Tiers:
  // EXACT color syntax in Scryfall uses '=' (e.g. c=w for pure mono-white, c=c for colorless)
  const exactColorQuery = features.isHybrid && features.colors.length > 1
    ? `(${features.colors.map(c => `c=${c}`).join(' or ')} or c=${features.colors.join('')})`
    : (features.colors.length > 0
      ? (features.colors.length === 1 ? `c=${features.colors[0]}` : `c=${features.colors.join('')}`)
      : 'c=c');

  // Broader color query for fallbacks (allows allied or subset colors)
  const relaxedColorQuery = features.colors.length > 0
    ? (features.colors.length === 1 ? `(c=${features.colors[0]} or c=c)` : `c<=${features.colors.join('')}`)
    : 'c=c';

  // Strict type filter
  let typeFilter = `t:${features.primaryType}`;
  if (features.isPlaneswalker) {
    typeFilter = 't:planeswalker';
  } else if (features.isBattle) {
    typeFilter = 't:battle';
  } else if (features.isLand) {
    typeFilter = 't:land';
  } else if (features.isInstant || features.isSorcery || features.isAuraRemoval) {
    if (features.isCombatTrick) {
      typeFilter = '(t:instant or o:flash)';
    } else {
      typeFilter = '(t:instant or t:sorcery)';
    }
  } else if (features.isEquipment) {
    typeFilter = 't:equipment';
  } else if (features.isCreature) {
    typeFilter = 't:creature';
  }

  const minCmc = Math.max(1, features.cmc - 1);
  const maxCmc = features.cmc + 1;

  const queries: string[] = [];

  // Planeswalkers & Battles
  if (features.isPlaneswalker) {
    queries.push(`${baseFilter} ${excludeSelf} t:planeswalker ${exactColorQuery}`);
    queries.push(`${baseFilter} ${excludeSelf} t:planeswalker`);
    return queries;
  }

  if (features.isBattle) {
    queries.push(`${baseFilter} ${excludeSelf} t:battle ${exactColorQuery}`);
    queries.push(`${baseFilter} ${excludeSelf} t:battle`);
    return queries;
  }

  // Equipment & Living Weapon Queries
  if (features.isEquipment) {
    if (features.isLivingWeapon) {
      queries.push(`${baseFilter} ${excludeSelf} t:equipment (o:"living weapon" or o:"for mirrodin" or o:"job select" or o:"enters" o:"attach")`);
    }
    if (features.isHybrid && features.colors.length > 1) {
      features.colors.forEach(col => {
        queries.push(`${baseFilter} ${excludeSelf} t:equipment c=${col} cmc>=${minCmc} cmc<=${maxCmc}`);
      });
    }
    queries.push(`${baseFilter} ${excludeSelf} t:equipment ${exactColorQuery} cmc>=${minCmc} cmc<=${maxCmc}`);
    queries.push(`${baseFilter} ${excludeSelf} t:equipment c=c cmc>=${minCmc} cmc<=${maxCmc}`);
    if (features.equipPowerBuff !== undefined) {
      queries.push(`${baseFilter} ${excludeSelf} t:equipment o:"gets +${features.equipPowerBuff}/"`);
    }
    queries.push(`${baseFilter} ${excludeSelf} t:equipment cmc>=${minCmc} cmc<=${maxCmc}`);
    return queries;
  }

  // SIGNATURE ENGINE MECHANIC QUERY (Cross-Color & Archetype-Level)
  if (features.actionSubtypes.has('connive_recruit')) {
    queries.push(`${baseFilter} ${excludeSelf} t:creature (o:connive or o:recruit or o:"draw a card, then discard")`);
  } else if (features.actionSubtypes.has('attack_keyword_granter')) {
    queries.push(`${baseFilter} ${excludeSelf} t:creature cmc=${features.cmc} (o:"whenever" o:"attacks" o:"gains")`);
    queries.push(`${baseFilter} ${excludeSelf} t:creature cmc>=${minCmc} cmc<=${maxCmc} (o:"whenever" o:"attacks" o:"gains")`);
  } else if (features.actionSubtypes.has('loot_rummage')) {
    queries.push(`${baseFilter} ${excludeSelf} ${typeFilter} (o:"draw a card, then discard" or o:"discard a card, then draw" or o:connive or o:recruit)`);
  }
  if (features.actionSubtypes.has('etb_treasure')) {
    queries.push(`${baseFilter} ${excludeSelf} t:creature cmc>=${minCmc} cmc<=${maxCmc} (o:"enters" o:"treasure")`);
    queries.push(`${baseFilter} ${excludeSelf} t:creature (o:"enters" o:"treasure")`);
  }
  if (features.actionSubtypes.has('flash_reach_ambush')) {
    queries.push(`${baseFilter} ${excludeSelf} t:creature cmc>=${minCmc} cmc<=${maxCmc} (o:flash o:reach)`);
    queries.push(`${baseFilter} ${excludeSelf} t:creature (o:flash o:reach)`);
  }
  if (features.valueRiders.has('proliferate')) {
    queries.push(`${baseFilter} ${excludeSelf} ${typeFilter} o:proliferate`);
  }
  if (features.valueRiders.has('incubate')) {
    queries.push(`${baseFilter} ${excludeSelf} ${typeFilter} o:incubate`);
  }

  // Hybrid Mana Queries: Hybrid cards can be cast in mono-color decks of either component color
  if (features.isHybrid && features.colors.length > 1) {
    queries.push(`${baseFilter} ${excludeSelf} ${typeFilter} (${features.colors.map(col => `c=${col}`).join(' or ')}) cmc=${features.cmc}`);
    queries.push(`${baseFilter} ${excludeSelf} ${typeFilter} c<=${features.colors.join('')} cmc=${features.cmc}`);
  }

  // METHOD 2 STRUCTURAL QUERY TIERS (Targeted game-action & cost filters)
  if (features.actionSubtypes.has('hard_counter')) {
    if (features.costProfile === 'additional_cost') {
      queries.push(`${baseFilter} ${excludeSelf} t:instant ${exactColorQuery} cmc>=${minCmc} cmc<=${maxCmc} o:"as an additional cost" o:"counter target spell"`);
    }
    queries.push(`${baseFilter} ${excludeSelf} t:instant ${exactColorQuery} cmc>=${minCmc} cmc<=${maxCmc} o:"counter target spell" -o:"unless"`);
  } else if (features.actionSubtypes.has('soft_tax_counter')) {
    queries.push(`${baseFilter} ${excludeSelf} t:instant ${exactColorQuery} cmc>=${minCmc} cmc<=${maxCmc} o:"counter target spell unless"`);
  }

  if (features.actionSubtypes.has('recursion_to_hand')) {
    queries.push(`${baseFilter} ${excludeSelf} ${typeFilter} ${exactColorQuery} cmc>=${minCmc} cmc<=${maxCmc} o:"from your graveyard to your hand"`);
    if (features.valueRiders.has('proliferate')) {
      queries.push(`${baseFilter} ${excludeSelf} ${typeFilter} ${exactColorQuery} o:"proliferate"`);
    }
    queries.push(`${baseFilter} ${excludeSelf} ${typeFilter} ${exactColorQuery} o:"from your graveyard to your hand"`);
  }

  if (features.isArtifact) {
    if (features.actionSubtypes.has('etb_scry_artifact') || features.valueRiders.has('surveil_scry')) {
      queries.push(`${baseFilter} ${excludeSelf} t:artifact cmc>=${minCmc} cmc<=${maxCmc} (o:"scry 2" or o:"surveil")`);
      queries.push(`${baseFilter} ${excludeSelf} t:artifact (o:"scry 2" or o:"surveil")`);
    }
    if (features.actionSubtypes.has('unconditional_removal') || features.actionSubtypes.has('permanent_removal')) {
      queries.push(`${baseFilter} ${excludeSelf} t:artifact cmc>=${minCmc} cmc<=${maxCmc} (o:"destroy" or o:"exile")`);
      queries.push(`${baseFilter} ${excludeSelf} t:artifact (o:"destroy target" or o:"exile target")`);
    }
    if (features.actionSubtypes.has('artifact_sac_sink')) {
      queries.push(`${baseFilter} ${excludeSelf} t:artifact ${exactColorQuery} cmc>=${minCmc} cmc<=${maxCmc} o:"sacrifice"`);
    }
  } else if (features.actionSubtypes.has('unconditional_removal')) {
    queries.push(`${baseFilter} ${excludeSelf} (t:instant or t:sorcery) ${exactColorQuery} cmc>=${minCmc} cmc<=${maxCmc} (o:"destroy target creature" or o:"exile target creature") -o:"with"`);
  }

  if (features.actionSubtypes.has('burn_damage')) {
    queries.push(`${baseFilter} ${excludeSelf} (t:instant or t:sorcery) ${exactColorQuery} cmc>=${minCmc} cmc<=${maxCmc} o:"deals" o:"damage to"`);
  }

  if (features.actionSubtypes.has('mana_dork')) {
    queries.push(`${baseFilter} ${excludeSelf} t:creature ${exactColorQuery} cmc>=1 cmc<=2 o:"{t}: add"`);
  }

  if (features.actionSubtypes.has('etb_counter_distributor')) {
    queries.push(`${baseFilter} ${excludeSelf} t:creature ${exactColorQuery} cmc=${features.cmc} (o:"when" o:"enters" o:"+1/+1 counter" or o:"explores")`);
    queries.push(`${baseFilter} ${excludeSelf} t:creature ${exactColorQuery} cmc>=${minCmc} cmc<=${maxCmc} (o:"when" o:"enters" o:"+1/+1 counter" or o:"explores")`);
  }

  // Signature creature subtypes (e.g. Wolf, Merfolk, Elf, Goblin - ignoring generic human/soldier/warrior/druid/wizard/cleric/rogue/citizen/scout)
  const signatureSubtypes = features.creatureSubtypes.filter(s =>
    !['human', 'soldier', 'warrior', 'druid', 'wizard', 'cleric', 'rogue', 'citizen', 'scout'].includes(s)
  );
  if (signatureSubtypes.length > 0) {
    queries.push(`${baseFilter} ${excludeSelf} t:creature ${exactColorQuery} t:${signatureSubtypes[0]} cmc>=${minCmc} cmc<=${maxCmc}`);
  }

  // METHOD 1 LEXICAL QUERY TIERS (Clauses, Keywords, Statlines)
  if (features.detectedClauses.length > 0) {
    for (const clause of features.detectedClauses.slice(0, 2)) {
      queries.push(
        `${baseFilter} ${excludeSelf} ${typeFilter} ${exactColorQuery} cmc>=${minCmc} cmc<=${maxCmc} o:"${clause.raw}"`
      );
      queries.push(
        `${baseFilter} ${excludeSelf} ${typeFilter} ${exactColorQuery} o:"${clause.raw}"`
      );
    }
  }

  // Keywords (e.g. Flying, Lifelink, Deathtouch)
  if (card.keywords && card.keywords.length > 0) {
    queries.push(
      `${baseFilter} ${excludeSelf} ${typeFilter} ${exactColorQuery} cmc>=${minCmc} cmc<=${maxCmc} o:"${card.keywords[0].toLowerCase()}"`
    );
  }

  // Matching Statline for creatures
  if (features.isCreature && features.power !== undefined && features.toughness !== undefined) {
    queries.push(
      `${baseFilter} ${excludeSelf} ${typeFilter} ${exactColorQuery} cmc=${features.cmc} pow=${features.power} tou=${features.toughness}`
    );
    queries.push(
      `${baseFilter} ${excludeSelf} ${typeFilter} ${exactColorQuery} cmc=${features.cmc} pow=${features.power}`
    );
  }

  // Exact CMC
  queries.push(
    `${baseFilter} ${excludeSelf} ${typeFilter} ${exactColorQuery} cmc=${features.cmc}`
  );

  // CMC ±1
  queries.push(
    `${baseFilter} ${excludeSelf} ${typeFilter} ${exactColorQuery} cmc>=${minCmc} cmc<=${maxCmc}`
  );

  // Relaxed Color fallback for rare mechanics
  if (features.detectedClauses.length > 0) {
    queries.push(
      `${baseFilter} ${excludeSelf} ${typeFilter} ${relaxedColorQuery} cmc>=${minCmc} cmc<=${maxCmc} o:"${features.detectedClauses[0].raw}"`
    );
  }

  return queries;
}

/**
 * Tokenize oracle text for similarity comparison (ignoring stop words and card names)
 */
function tokenizeOracleText(text: string, cardName: string): Set<string> {
  const stopWords = new Set([
    'the', 'a', 'an', 'to', 'of', 'and', 'in', 'on', 'with', 'by', 'at', 'this', 'that', 'it', 'or', 'for', 'you', 'your', 'target',
    'if', 'may', 'then', 'as', 'each', 'all', 'any', 'until', 'end', 'turn', 'whenever', 'when', 'control'
  ]);
  const sanitized = (text || '')
    .toLowerCase()
    .replace(new RegExp(cardName.toLowerCase(), 'g'), '~')
    .replace(/[^a-z0-9~+/\-]/g, ' ');

  const tokens = sanitized.split(/\s+/).filter(t => t.length > 1 && !stopWords.has(t));
  return new Set(tokens);
}

/**
 * Compute functional similarity score between 0 and 100%
 *
 * Hybrid MTG Limited Architecture (Method 1 Lexical + Method 2 Structural):
 * - Compatibility Gatekeeper: Strict prerequisite. Incompatible types receive 0 score.
 * - Pillar 1: Color Alignment (20 pts)
 * - Pillar 2: Speed-Adjusted Effective Mana Cost (20 pts)
 * - Pillar 3 (Method 1): Lexical, Regex Pattern & Word Token Overlap (25 pts)
 * - Pillar 4 (Method 2): Structural Mechanics, Action Subtypes & Cost Hoops (25 pts)
 * - Pillar 5: Statline & Output Scale (10 pts)
 */
export function calculateCardSimilarity(target: Card, candidate: Card): { score: number; reasons: string[] } {
  const reasons: string[] = [];

  // 0. Compatibility Gatekeeper (Prerequisite — 0 points)
  if (!areCardTypesCompatible(target, candidate)) {
    return { score: 0, reasons: [] };
  }

  const tFeatures = extractCardFeatures(target);
  const cFeatures = extractCardFeatures(candidate);

  let colorScore = 0;
  let cmcScore = 0;
  let method1LexicalScore = 0;
  let method2StructuralScore = 0;
  let statlineScore = 0;

  const structuralReasons: string[] = [];
  const lexicalReasons: string[] = [];
  const baselineReasons: string[] = [];

  // =========================================================================
  // PILLAR 1: Color Alignment & Identity (up to 20 pts)
  // =========================================================================
  const tColors = new Set(tFeatures.colors);
  const cColors = new Set(cFeatures.colors);

  const isExactColorMatch = tColors.size === cColors.size && [...tColors].every(c => cColors.has(c));
  const isCandidateColorless = cColors.size === 0;
  const bothShareAttackGranter = (
    tFeatures.actionSubtypes.has('attack_keyword_granter') && cFeatures.actionSubtypes.has('attack_keyword_granter')
  );
  const bothShareSignatureEngine = (
    (tFeatures.actionSubtypes.has('connive_recruit') && cFeatures.actionSubtypes.has('connive_recruit')) ||
    bothShareAttackGranter
  );
  const bothShareLivingWeapon = (
    tFeatures.isLivingWeapon && cFeatures.isLivingWeapon
  );
  const bothShareEtbScry2 = (
    tFeatures.isArtifact && cFeatures.isArtifact &&
    /when .* enters.*scry 2/i.test(tFeatures.rawOracle) &&
    /when .* enters.*scry 2/i.test(cFeatures.rawOracle)
  );
  const bothShareLateGameSacDestruction = (
    tFeatures.isArtifact && cFeatures.isArtifact &&
    /\{([6-9]|\d{2})\}.*sacrifice.*destroy target/i.test(tFeatures.rawOracle) &&
    /\{([6-9]|\d{2})\}.*sacrifice.*destroy target/i.test(cFeatures.rawOracle)
  );
  const bothShareEtbTreasure = (
    tFeatures.actionSubtypes.has('etb_treasure') && cFeatures.actionSubtypes.has('etb_treasure')
  );
  const bothShareFlashReach = (
    tFeatures.actionSubtypes.has('flash_reach_ambush') && cFeatures.actionSubtypes.has('flash_reach_ambush')
  );

  if (isExactColorMatch) {
    colorScore = 20;
    if (tColors.size === 1) {
      baselineReasons.push(`Exact color (${[...tColors][0]})`);
    } else if (tColors.size > 1) {
      baselineReasons.push(`Exact guild (${[...tColors].join('')})`);
    } else {
      baselineReasons.push('Colorless artifact precedent');
    }
  } else if (isCandidateColorless) {
    colorScore = (tFeatures.isEquipment || cFeatures.isEquipment) ? 16 : ((tColors.size > 0) ? 10 : 14);
    baselineReasons.push((tFeatures.isEquipment || cFeatures.isEquipment) ? 'Colorless equipment (playable in any deck)' : 'Colorless baseline comparison');
  } else if (tColors.size === 0 && cColors.size === 1) {
    colorScore = (bothShareEtbScry2 || bothShareSignatureEngine || bothShareEtbTreasure || bothShareFlashReach)
      ? 16
      : ((tFeatures.isEquipment || cFeatures.isEquipment) ? 14 : 10);
    baselineReasons.push(bothShareEtbTreasure
      ? 'Colorless parallel to colored Treasure producer'
      : (bothShareFlashReach
        ? 'Colorless parallel to colored Flash & Reach blocker'
        : (bothShareEtbScry2
          ? `Cross-color artifact cycle peer (${[...cColors][0]})`
          : (bothShareSignatureEngine ? 'Cross-color engine mechanic peer' : `Mono-color archetype comp (${[...cColors][0]})`))));
  } else if (tFeatures.isHybrid && cColors.size === 1 && tColors.has([...cColors][0])) {
    colorScore = 18;
    baselineReasons.push(`Component hybrid color (${[...cColors][0]})`);
  } else if (tColors.size > 1 && cColors.size === 1 && tColors.has([...cColors][0])) {
    colorScore = 14;
    baselineReasons.push(`Component color (${[...cColors][0]})`);
  } else if (bothShareSignatureEngine) {
    colorScore = 14;
    baselineReasons.push(bothShareAttackGranter
      ? 'Cross-color engine mechanic peer (Attack trigger keyword mentor)'
      : 'Cross-color engine mechanic peer (Recruit & Connive)');
  } else if (bothShareLivingWeapon) {
    colorScore = 14;
    baselineReasons.push('Cross-color engine mechanic peer (Living Weapon / Token Equipment)');
  } else if (tColors.size === 1 && cColors.size > 1 && cColors.has([...tColors][0])) {
    colorScore = -20;
  } else {
    colorScore = 4;
  }

  // =========================================================================
  // PILLAR 2: Speed-Adjusted Effective Mana Cost (up to 20 pts)
  // =========================================================================
  const effectiveDiff = Math.abs(tFeatures.effectiveCmc - cFeatures.effectiveCmc);
  const targetIsInstant = tFeatures.isInstant;
  const candIsInstant = cFeatures.isInstant;

  if (effectiveDiff <= 0.15) {
    cmcScore = 20;
    if (targetIsInstant && !candIsInstant) {
      baselineReasons.push(`Speed-parity (${target.cmc}M instant ≈ ${candidate.cmc}M sorcery)`);
    } else if (!targetIsInstant && candIsInstant) {
      baselineReasons.push(`Speed-parity (${target.cmc}M sorcery ≈ ${candidate.cmc}M instant)`);
    } else {
      baselineReasons.push(`Exact CMC ${target.cmc}`);
    }
  } else if (effectiveDiff <= 0.4) {
    cmcScore = 17;
    baselineReasons.push(`Near-identical tempo (±${effectiveDiff.toFixed(1)} mana)`);
  } else if (effectiveDiff <= 1.15) {
    if (tFeatures.isCreature && cFeatures.isCreature && cFeatures.cmc < tFeatures.cmc) {
      cmcScore = 11;
      baselineReasons.push(`Lower curve tier (${candidate.cmc}M vs ${target.cmc}M)`);
    } else {
      cmcScore = (bothShareSignatureEngine || bothShareEtbTreasure) ? 18 : 14;
      if (targetIsInstant !== candIsInstant) {
        baselineReasons.push(targetIsInstant ? 'Instant speed tax (+0.75 mana)' : 'Sorcery speed discount');
      } else {
        baselineReasons.push(bothShareEtbTreasure ? 'Adjacent curve slot (Treasure ramp peer)' : 'Adjacent curve slot (±1 mana)');
      }
    }
  } else if (effectiveDiff <= 1.85) {
    if (targetIsInstant !== candIsInstant) {
      cmcScore = 12;
      baselineReasons.push(`Speed-adjusted tempo parity (${target.cmc}M ${targetIsInstant ? 'instant' : 'sorcery'} vs ${candidate.cmc}M ${candIsInstant ? 'instant' : 'sorcery'})`);
    } else {
      cmcScore = 8;
      baselineReasons.push('Acceptable curve slot (±1-2 mana)');
    }
  } else if (effectiveDiff <= 2.2) {
    cmcScore = 3;
  } else {
    cmcScore = 0;
  }

  // =========================================================================
  // PILLAR 3: METHOD 1 (Lexical, Regex Pattern & Word Token Overlap - up to 25 pts)
  // =========================================================================
  const CATEGORY_SCORES: Record<string, { pts: number; label: string }> = {
    removal: { pts: 12, label: 'Matching creature removal effect' },
    sweeper: { pts: 12, label: 'Matching board wipe effect' },
    damage: { pts: 11, label: 'Matching direct damage / burn' },
    counter: { pts: 11, label: 'Matching counterspell effect' },
    draw: { pts: 10, label: 'Matching card advantage effect' },
    graveyard: { pts: 10, label: 'Graveyard value / recursive mechanic' },
    trick: { pts: 10, label: 'Matching combat trick effect' },
    pacifism: { pts: 10, label: 'Matching pacifism / lockdown' },
    bounce: { pts: 9, label: 'Matching bounce tempo effect' },
    selection: { pts: 9, label: 'Matching card selection effect' },
    token: { pts: 8, label: 'Matching token creation' },
    counters: { pts: 8, label: 'Matching counter synergy' },
    synergy: { pts: 7, label: 'Matching ETB / synergy trigger' },
    equipment: { pts: 11, label: 'Matching equipment subtype' },
  };

  let bestCategoryMatch = 0;
  let matchedCategoryLabel = '';

  tFeatures.detectedCategories.forEach((cat) => {
    if (cFeatures.detectedCategories.has(cat)) {
      const cfg = CATEGORY_SCORES[cat];
      if (cfg && cfg.pts > bestCategoryMatch) {
        bestCategoryMatch = cfg.pts;
        matchedCategoryLabel = cfg.label;
      }
    }
  });

  if (bestCategoryMatch > 0) {
    method1LexicalScore += bestCategoryMatch;
    const catLabel = (matchedCategoryLabel === 'Matching creature removal effect' &&
                      tFeatures.actionSubtypes.has('permanent_removal') &&
                      cFeatures.actionSubtypes.has('permanent_removal'))
      ? 'Matching permanent removal effect'
      : matchedCategoryLabel;
    lexicalReasons.push(catLabel);
  } else if (tFeatures.isCreature && cFeatures.isCreature) {
    method1LexicalScore += 6;
  }

  // Shared creature subtypes (e.g. Wolf, Merfolk, Elf, Goblin)
  if (tFeatures.isCreature && cFeatures.isCreature) {
    const sharedSubtypes = tFeatures.creatureSubtypes.filter(s =>
      !['human', 'soldier', 'warrior', 'druid', 'wizard', 'cleric', 'rogue', 'citizen', 'scout'].includes(s) && cFeatures.creatureSubtypes.includes(s)
    );
    if (sharedSubtypes.length > 0) {
      method1LexicalScore += 6;
      lexicalReasons.push(`Shared creature type: ${sharedSubtypes.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')}`);
    }
  }

  // Identical ETB counter distributor clause bonus
  if (tFeatures.actionSubtypes.has('etb_counter_distributor') && cFeatures.actionSubtypes.has('etb_counter_distributor')) {
    method1LexicalScore += 4;
    lexicalReasons.push('Matching ETB +1/+1 counter distribution');
  }

  // Shared Keywords (up to 6 pts)
  const sharedKeywords = (target.keywords || []).filter(k =>
    (candidate.keywords || []).some(ck => ck.toLowerCase() === k.toLowerCase())
  );
  if (sharedKeywords.length > 0) {
    const kwPoints = Math.min(6, sharedKeywords.length * 3);
    method1LexicalScore += kwPoints;
    lexicalReasons.push(`Shared: ${sharedKeywords.slice(0, 2).join(', ')}`);
  }

  // Equipment Buff and Granted Keywords Match (up to 6 pts)
  if (tFeatures.isEquipment && cFeatures.isEquipment) {
    if (tFeatures.equipPowerBuff !== undefined && cFeatures.equipPowerBuff !== undefined &&
        tFeatures.equipPowerBuff === cFeatures.equipPowerBuff && tFeatures.equipToughnessBuff === cFeatures.equipToughnessBuff) {
      method1LexicalScore += 3;
      lexicalReasons.push(`Exact equip buff (+${tFeatures.equipPowerBuff}/+${tFeatures.equipToughnessBuff})`);
    }
    const sharedGranted = [...tFeatures.grantedKeywords].filter(k => cFeatures.grantedKeywords.has(k));
    if (sharedGranted.length > 0) {
      method1LexicalScore += 4;
      lexicalReasons.push(`Both grant ${sharedGranted.join(', ')}`);
    }
  }

  // Token / Jaccard Semantic Overlap (up to 7 pts)
  const targetTokens = tokenizeOracleText(target.oracle_text || '', target.name);
  const candTokens = tokenizeOracleText(candidate.oracle_text || '', candidate.name);
  if (targetTokens.size > 0 && candTokens.size > 0) {
    let intersection = 0;
    targetTokens.forEach(t => { if (candTokens.has(t)) intersection++; });
    const union = new Set([...targetTokens, ...candTokens]).size;
    const jaccard = union > 0 ? intersection / union : 0;
    const jaccardPoints = Math.round(jaccard * 7);
    method1LexicalScore += jaccardPoints;
    if (jaccard > 0.25) {
      lexicalReasons.push('High rules text overlap');
    }
  }

  if (bothShareSignatureEngine) {
    method1LexicalScore = Math.min(25, method1LexicalScore + (bothShareAttackGranter ? 6 : 8));
    lexicalReasons.push(bothShareAttackGranter
      ? 'Shared attack-trigger combat mentor mechanic'
      : 'Shared signature engine: Recruit & Connive (ETB loot + discard payoff)');
  }

  if (bothShareLivingWeapon) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 8);
    lexicalReasons.push('Shared living weapon / auto-attach token engine');
  }

  if (bothShareEtbScry2) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 6);
    lexicalReasons.push('Both 1-drop artifacts with signature ETB Scry 2');
  }

  if (bothShareLateGameSacDestruction) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 6);
    lexicalReasons.push('Both late-game {6}+ artifact sacrifice destruction');
  }

  if (bothShareEtbTreasure) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 12);
    lexicalReasons.push('Shared ETB Treasure ramp / fixing role');
  }

  if (bothShareFlashReach) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 12);
    lexicalReasons.push('Shared signature Flash & Reach ambush role');
  }

  method1LexicalScore = Math.min(25, method1LexicalScore);

  // =========================================================================
  // PILLAR 4: METHOD 2 (Structural Mechanics, Action Subtypes & Cost Hoops - up to 25 pts)
  // =========================================================================
  let structuralActionPoints = 0;
  const ACTION_SUBTYPE_VALUES: Record<string, { pts: number; label: string }> = {
    living_weapon: { pts: 18, label: 'Both Living Weapon / auto-attaching token equipment' },
    equipment: { pts: 12, label: 'Both draft equipment' },
    connive_recruit: { pts: 18, label: 'Both ETB looting with board value (Recruit & Connive)' },
    etb_looter: { pts: 15, label: 'Both ETB looting creatures' },
    loot_rummage: { pts: 12, label: 'Both card filtering / looting' },
    tap_looter: { pts: 12, label: 'Both tap-activated looters' },
    recursion_to_hand: { pts: 15, label: 'Both return permanent from graveyard to hand' },
    reanimation: { pts: 15, label: 'Both reanimate from graveyard to battlefield' },
    hard_counter: { pts: 15, label: 'Both unconditional hard counterspells' },
    soft_tax_counter: { pts: 14, label: 'Both mana-tax soft counters' },
    restricted_counter: { pts: 13, label: 'Both targeted/restricted counters' },
    permanent_removal: { pts: 17, label: 'Both flexible permanent removal' },
    unconditional_removal: { pts: 15, label: 'Both unconditional creature removal' },
    conditional_removal: { pts: 12, label: 'Both conditional creature removal' },
    burn_damage: { pts: 14, label: 'Both direct damage / burn spells' },
    bite_fight: { pts: 14, label: 'Both bite/fight removal' },
    sweeper: { pts: 15, label: 'Both board wipe / sweeper effects' },
    raw_draw: { pts: 14, label: 'Both card advantage draw spells' },
    cantrip: { pts: 12, label: 'Both 1-for-1 cantrips' },
    card_selection: { pts: 12, label: 'Both card selection / filtering spells' },
    etb_scry_artifact: { pts: 16, label: 'Both artifacts with ETB Scry/Surveil filtering' },
    artifact_sac_sink: { pts: 14, label: 'Both artifacts with activated sacrifice ability' },
    mana_rock: { pts: 14, label: 'Both mana ramp / rock artifacts' },
    pump_trick: { pts: 14, label: 'Both combat pump tricks' },
    mana_dork: { pts: 15, label: 'Both mana ramp / dork creatures' },
    evasion_threat: { pts: 13, label: 'Both evasive draft threats' },
    defensive_wall: { pts: 12, label: 'Both defensive board stabilizers' },
    etb_counter_distributor: { pts: 16, label: 'Both distribute +1/+1 counters on enters' },
    etb_counter_self: { pts: 14, label: 'Both enter with / grow with +1/+1 counters' },
    attack_keyword_granter: { pts: 17, label: 'Both attack-triggered keyword mentors' },
    etb_treasure: { pts: 20, label: 'Both ETB Treasure ramp / fixing creatures' },
    flash_reach_ambush: { pts: 20, label: 'Both Flash & Reach ambush creatures' },
    etb_value: { pts: 12, label: 'Both ETB value creatures' },
  };

  let sharedSubtypesCount = 0;
  tFeatures.actionSubtypes.forEach((ast) => {
    if (cFeatures.actionSubtypes.has(ast)) {
      sharedSubtypesCount++;
      const cfg = ACTION_SUBTYPE_VALUES[ast];
      if (cfg && cfg.pts > structuralActionPoints) {
        structuralActionPoints = cfg.pts;
        structuralReasons.push(cfg.label);
      }
    }
  });

  // Cross-counter synergy matching (one distributes counters, one enters with/grows with counters)
  const bothEtbCounter = (
    (tFeatures.actionSubtypes.has('etb_counter_distributor') || tFeatures.actionSubtypes.has('etb_counter_self')) &&
    (cFeatures.actionSubtypes.has('etb_counter_distributor') || cFeatures.actionSubtypes.has('etb_counter_self'))
  );
  if (bothEtbCounter && structuralActionPoints < 15) {
    structuralActionPoints = 15;
    structuralReasons.push('Both ETB creature with +1/+1 counter value');
  }

  // Multi-Action Subtype Bonus (e.g. both ETB and Cantrip)
  if (sharedSubtypesCount > 1) {
    structuralActionPoints = Math.min(20, structuralActionPoints + (sharedSubtypesCount - 1) * 3);
  }

  // Shared signature creature subtype synergy (e.g. Wolf)
  const sharedSignatureSubtypes = tFeatures.creatureSubtypes.filter(s =>
    !['human', 'soldier', 'warrior', 'druid', 'wizard', 'cleric', 'rogue', 'citizen', 'scout'].includes(s) && cFeatures.creatureSubtypes.includes(s)
  );
  if (sharedSignatureSubtypes.length > 0) {
    structuralActionPoints = Math.min(20, structuralActionPoints + 3);
    structuralReasons.push(`Shared tribal archetype: ${sharedSignatureSubtypes.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')}`);
  }

  // Highlight signature Limited roles
  const isBothEtbCantrip = tFeatures.isCreature && cFeatures.isCreature &&
    tFeatures.actionSubtypes.has('cantrip') && cFeatures.actionSubtypes.has('cantrip') &&
    tFeatures.actionSubtypes.has('etb_value') && cFeatures.actionSubtypes.has('etb_value');
  if (isBothEtbCantrip) {
    structuralReasons.unshift('Both ETB cantrips (draws card on enters)');
  }

  if (tFeatures.actionSubtypes.has('etb_counter_distributor') && cFeatures.actionSubtypes.has('etb_counter_distributor')) {
    structuralReasons.unshift('Both distribute +1/+1 counters on enters');
  }

  const isBothConniveRecruit = tFeatures.actionSubtypes.has('connive_recruit') && cFeatures.actionSubtypes.has('connive_recruit');
  if (isBothConniveRecruit) {
    structuralReasons.unshift('Both ETB looting with board value (Recruit & Connive)');
  }

  const isBothLivingWeapon = tFeatures.actionSubtypes.has('living_weapon') && cFeatures.actionSubtypes.has('living_weapon');
  if (isBothLivingWeapon) {
    structuralReasons.unshift('Both Living Weapon / auto-attaching token equipment');
  }

  if (bothShareAttackGranter) {
    structuralReasons.unshift('Both attack-triggered keyword mentors');
  }

  if (tFeatures.actionSubtypes.has('permanent_removal') && cFeatures.actionSubtypes.has('permanent_removal')) {
    const idx = structuralReasons.indexOf('Both unconditional creature removal');
    if (idx !== -1) structuralReasons.splice(idx, 1);
    if (!structuralReasons.includes('Both flexible permanent removal')) {
      structuralReasons.unshift('Both flexible permanent removal');
    }
  }

  if (tFeatures.actionSubtypes.has('etb_scry_artifact') && cFeatures.actionSubtypes.has('etb_scry_artifact')) {
    const idx = structuralReasons.indexOf('Both card selection / filtering spells');
    if (idx !== -1) structuralReasons.splice(idx, 1);
    if (!structuralReasons.includes('Both artifacts with ETB Scry/Surveil filtering')) {
      structuralReasons.unshift('Both artifacts with ETB Scry/Surveil filtering');
    }
  }

  if (tFeatures.actionSubtypes.has('artifact_sac_sink') && cFeatures.actionSubtypes.has('artifact_sac_sink')) {
    if (!structuralReasons.includes('Both artifacts with activated sacrifice ability')) {
      structuralReasons.push('Both artifacts with activated sacrifice ability');
    }
  }

  if (bothShareLateGameSacDestruction) {
    structuralActionPoints = Math.max(structuralActionPoints, 18);
    structuralReasons.unshift('Both {6}+ artifact sacrifice destruction');
  }

  if (bothShareEtbTreasure) {
    structuralActionPoints = Math.max(structuralActionPoints, 20);
    if (!structuralReasons.includes('Both ETB Treasure ramp / fixing creatures')) {
      structuralReasons.unshift('Both ETB Treasure ramp / fixing creatures');
    }
  }

  if (bothShareFlashReach) {
    structuralActionPoints = Math.max(structuralActionPoints, 20);
    if (!structuralReasons.includes('Both Flash & Reach ambush creatures')) {
      structuralReasons.unshift('Both Flash & Reach ambush creatures');
    }
  }

  // Action Subtype Mismatch Penalties
  let actionMismatchPenalty = 0;
  if (tFeatures.actionSubtypes.has('hard_counter') && cFeatures.actionSubtypes.has('soft_tax_counter')) {
    actionMismatchPenalty = 10;
  } else if (tFeatures.actionSubtypes.has('soft_tax_counter') && cFeatures.actionSubtypes.has('hard_counter')) {
    actionMismatchPenalty = 10;
  } else if (tFeatures.actionSubtypes.has('unconditional_removal') && cFeatures.actionSubtypes.has('conditional_removal')) {
    actionMismatchPenalty = 8;
  } else if (tFeatures.actionSubtypes.has('etb_looter') && cFeatures.actionSubtypes.has('tap_looter')) {
    actionMismatchPenalty = 10;
  } else if (tFeatures.actionSubtypes.has('tap_looter') && cFeatures.actionSubtypes.has('etb_looter')) {
    actionMismatchPenalty = 10;
  } else if (tFeatures.actionSubtypes.has('etb_looter') && !cFeatures.actionSubtypes.has('etb_looter')) {
    actionMismatchPenalty = 12;
  } else if (!tFeatures.actionSubtypes.has('etb_looter') && cFeatures.actionSubtypes.has('etb_looter') && tFeatures.actionSubtypes.has('loot_rummage')) {
    actionMismatchPenalty = 12;
  }

  // Modal / Conditional treasure penalty: target has unconditional ETB treasure, but candidate is conditional or modal
  const targetIsUnconditionalTreasure = tFeatures.actionSubtypes.has('etb_treasure') && !/choose one|if /i.test(target.oracle_text || '');
  const candIsModalOrConditionalTreasure = cFeatures.actionSubtypes.has('etb_treasure') && (/choose one/i.test(candidate.oracle_text || '') || /if [\s\S]*create [\s\S]*treasure/i.test(candidate.oracle_text || ''));
  if (targetIsUnconditionalTreasure && candIsModalOrConditionalTreasure) {
    actionMismatchPenalty = Math.max(actionMismatchPenalty, 6);
  }

  const candidateHasFiltering = (
    cFeatures.actionSubtypes.has('etb_scry_artifact') ||
    cFeatures.actionSubtypes.has('card_selection') ||
    cFeatures.actionSubtypes.has('raw_draw') ||
    cFeatures.actionSubtypes.has('cantrip') ||
    cFeatures.actionSubtypes.has('loot_rummage')
  );
  if (tFeatures.actionSubtypes.has('etb_scry_artifact') && !candidateHasFiltering) {
    actionMismatchPenalty = Math.max(actionMismatchPenalty, 10);
  }

  // Cost Structure Match (up to 5 pts)
  let costStructurePoints = 0;
  if (tFeatures.costProfile === 'additional_cost' && cFeatures.costProfile === 'additional_cost') {
    costStructurePoints = 5;
    structuralReasons.push('Both cost-gated / additional cost spells');
  } else if (tFeatures.costProfile === cFeatures.costProfile) {
    costStructurePoints = 4;
  }

  // Value Rider Synergy (up to 6 pts)
  let valueRiderPoints = 0;
  let sharedRidersCount = 0;
  const VALUE_RIDER_VALUES: Record<string, { pts: number; label: string }> = {
    proliferate: { pts: 5, label: 'Shared mechanic: Proliferate' },
    token: { pts: 4, label: 'Shared rider: Token generation' },
    surveil_scry: { pts: 3, label: 'Shared rider: Scry / Surveil' },
    counters: { pts: 3, label: 'Shared rider: +1/+1 counters' },
    discard_payoff: { pts: 4, label: 'Shared rider: Discard payoff' },
    life_gain: { pts: 3, label: 'Shared rider: Life gain' },
    cantrip: { pts: 3, label: 'Shared rider: Cantrip replacement' },
  };

  tFeatures.valueRiders.forEach((vr) => {
    if (cFeatures.valueRiders.has(vr)) {
      sharedRidersCount++;
      const cfg = VALUE_RIDER_VALUES[vr];
      if (cfg && cfg.pts > valueRiderPoints) {
        valueRiderPoints = cfg.pts;
        structuralReasons.push(cfg.label);
      }
    }
  });

  if (sharedRidersCount > 1) {
    valueRiderPoints = Math.min(6, valueRiderPoints + (sharedRidersCount - 1) * 2);
  }

  const flashReachBonus = bothShareFlashReach ? 4 : 0;
  method2StructuralScore = Math.max(0, Math.min(25, structuralActionPoints + costStructurePoints + valueRiderPoints + flashReachBonus) - actionMismatchPenalty);

  // =========================================================================
  // PILLAR 5: Statline & Output Scale (up to 10 pts)
  // =========================================================================
  if (tFeatures.isCreature && cFeatures.isCreature && 
      tFeatures.power !== undefined && tFeatures.toughness !== undefined &&
      cFeatures.power !== undefined && cFeatures.toughness !== undefined) {
    const pDiff = Math.abs(tFeatures.power - cFeatures.power);
    const tDiff = Math.abs(tFeatures.toughness - cFeatures.toughness);
    const totalStatDiff = Math.abs((tFeatures.power + tFeatures.toughness) - (cFeatures.power + cFeatures.toughness));

    if (pDiff === 0 && tDiff === 0) {
      statlineScore = 10;
      baselineReasons.push(`Exact P/T (${target.power}/${target.toughness})`);
    } else if (pDiff === 0) {
      statlineScore = 8;
      baselineReasons.push(`Matching power (${target.power} power)`);
    } else if (tDiff === 0) {
      statlineScore = 8;
      baselineReasons.push(`Matching toughness (${target.toughness} toughness)`);
    } else if (totalStatDiff === 0) {
      statlineScore = 8;
      baselineReasons.push(`Equivalent stats (${tFeatures.power + tFeatures.toughness} total)`);
    } else if (totalStatDiff <= 1) {
      statlineScore = 6;
    } else if (totalStatDiff <= 3) {
      if (cFeatures.cmc === tFeatures.cmc + 1 && (cFeatures.power ?? 0) > (tFeatures.power ?? 0) && (cFeatures.toughness ?? 0) > (tFeatures.toughness ?? 0)) {
        statlineScore = 8;
        baselineReasons.push(`Curve-scaled stats (${cFeatures.power}/${cFeatures.toughness} for ${candidate.cmc}M)`);
      } else {
        statlineScore = 5;
      }
    }

    // 0-power defender mismatch penalty (cannot attack or trade in combat)
    if ((tFeatures.power ?? 0) >= 2 && (cFeatures.power ?? 0) === 0) {
      statlineScore = Math.max(1, statlineScore - 4);
    } else if ((tFeatures.power ?? 0) === 0 && (cFeatures.power ?? 0) >= 2) {
      statlineScore = Math.max(1, statlineScore - 4);
    }
  } else if (tFeatures.isEquipment && cFeatures.isEquipment) {
    let equipStatScore = 0;
    if (tFeatures.equipPowerBuff !== undefined && cFeatures.equipPowerBuff !== undefined &&
        tFeatures.equipToughnessBuff !== undefined && cFeatures.equipToughnessBuff !== undefined) {
      if (tFeatures.equipPowerBuff === cFeatures.equipPowerBuff && tFeatures.equipToughnessBuff === cFeatures.equipToughnessBuff) {
        equipStatScore += 5;
        baselineReasons.push(`Matching stat bonus (+${tFeatures.equipPowerBuff}/+${tFeatures.equipToughnessBuff})`);
      } else if (tFeatures.equipPowerBuff === cFeatures.equipPowerBuff) {
        equipStatScore += 2;
        baselineReasons.push(`Matching power bonus (+${tFeatures.equipPowerBuff})`);
      }
    }
    const sharedGranted = [...tFeatures.grantedKeywords].filter(k => cFeatures.grantedKeywords.has(k));
    if (sharedGranted.length > 0) {
      equipStatScore += 4;
      baselineReasons.push(`Both grant ${sharedGranted.join(', ')}`);
    } else if (tFeatures.grantedKeywords.size > 0 && cFeatures.grantedKeywords.size > 0) {
      equipStatScore += 2;
      baselineReasons.push('Both grant combat abilities');
    }
    if (tFeatures.equipCost !== undefined && cFeatures.equipCost !== undefined) {
      const eqDiff = Math.abs(tFeatures.equipCost - cFeatures.equipCost);
      if (eqDiff === 0) {
        equipStatScore += 3;
        baselineReasons.push(`Exact equip cost ({${tFeatures.equipCost}})`);
      } else if (eqDiff === 1) {
        equipStatScore += 2;
      } else if (eqDiff === 2) {
        equipStatScore += 1;
      }
    }
    statlineScore = Math.min(10, Math.max(0, equipStatScore));
  } else if (!tFeatures.isCreature && !cFeatures.isCreature) {
    const tOracle = tFeatures.cleanOracle;
    const cOracle = cFeatures.cleanOracle;

    const tDmg = tOracle.match(/deals (\d+) damage/);
    const cDmg = cOracle.match(/deals (\d+) damage/);
    if (tDmg && cDmg) {
      const dmgDiff = Math.abs(parseInt(tDmg[1], 10) - parseInt(cDmg[1], 10));
      if (dmgDiff === 0) {
        statlineScore = 10;
        baselineReasons.push(`Exact damage (${tDmg[1]} dmg)`);
      } else if (dmgDiff === 1) {
        statlineScore = 7;
        baselineReasons.push('Comparable burn scale (±1 dmg)');
      } else {
        statlineScore = 4;
      }
    } else if (tFeatures.actionSubtypes.has('permanent_removal') && cFeatures.actionSubtypes.has('permanent_removal')) {
      statlineScore = 9;
      baselineReasons.push('Unrestricted target permanent removal');
    } else if (tFeatures.actionSubtypes.has('unconditional_removal') && cFeatures.actionSubtypes.has('unconditional_removal')) {
      statlineScore = 9;
      baselineReasons.push('Unrestricted target removal');
    } else {
      statlineScore = 7;
    }
  } else {
    statlineScore = 5;
  }

  // Rarity Role Affinity: Prioritize same limited drafting tier (Common vs Rare)
  let rarityAdjustment = 0;
  const sharesCounterDistributor = tFeatures.actionSubtypes.has('etb_counter_distributor') && cFeatures.actionSubtypes.has('etb_counter_distributor');

  if (tFeatures.rarity === 'common') {
    if (cFeatures.rarity === 'common') {
      rarityAdjustment = 3; // Both are common draft staples
      baselineReasons.push('Common draft staple comp');
    } else if (cFeatures.rarity === 'uncommon') {
      rarityAdjustment = (bothShareLivingWeapon || sharesCounterDistributor || bothShareLateGameSacDestruction) ? -1 : -3;
    } else {
      rarityAdjustment = -8; // Rare/Mythic power-level penalty vs Common draft baseline
    }
  } else if (tFeatures.rarity === 'uncommon') {
    if (cFeatures.rarity === 'uncommon' || cFeatures.rarity === 'common') {
      rarityAdjustment = 2;
    } else {
      rarityAdjustment = -4;
    }
  } else if (tFeatures.rarity === 'rare' || tFeatures.rarity === 'mythic') {
    if (cFeatures.rarity === 'rare' || cFeatures.rarity === 'mythic') {
      rarityAdjustment = 3;
    } else {
      rarityAdjustment = -2;
    }
  }

  let legendaryPenalty = 0;
  if (!target.type_line?.includes('Legendary') && candidate.type_line?.includes('Legendary')) {
    legendaryPenalty = -3;
  }

  statlineScore = Math.max(0, Math.min(10, statlineScore + rarityAdjustment + legendaryPenalty));

  const rawScore = colorScore + cmcScore + method1LexicalScore + method2StructuralScore + statlineScore;
  const totalScore = Math.min(100, Math.max(0, rawScore));

  // Deduplicate and prioritize most insightful structural, speed/tempo, and lexical reasons
  const speedOrTempoReasons = baselineReasons.filter(r => r.includes('Speed') || r.includes('speed') || r.includes('tempo'));
  const otherBaselineReasons = baselineReasons.filter(r => !speedOrTempoReasons.includes(r));
  const uniqueReasons = Array.from(new Set([...structuralReasons, ...speedOrTempoReasons, ...lexicalReasons, ...otherBaselineReasons]));

  return {
    score: totalScore,
    reasons: uniqueReasons.slice(0, 3),
  };
}

/**
 * Main engine: Finds similar cards from past sets, pulls their 17Lands & LSV ratings,
 * and synthesizes an empirical consensus projection.
 */
export async function findSimilarCards(targetCard: Card): Promise<CardSimilarityResult> {
  const cacheKey = `${targetCard.set.toUpperCase()}_${targetCard.name.toUpperCase()}_v30`;
  if (similarityCache.has(cacheKey)) {
    return similarityCache.get(cacheKey)!;
  }

  const features = extractCardFeatures(targetCard);
  const queries = buildScryfallQueries(targetCard, features);

  let candidateCards: Card[] = [];

  // Try queries in order of specificity
  for (const q of queries) {
    try {
      const url = `${SCRYFALL_API_BASE}/cards/search?q=${encodeURIComponent(q)}&order=released&dir=desc`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'SpellslingerArcana/1.0',
          Accept: 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.data) && data.data.length > 0) {
          const rawCards = data.data
            .filter((rc: any) => !rc.name.startsWith('A-') && !rc.digital && !rc.promo_types?.includes('rebalanced'))
            .map((rc: any) => normalizeScryfallCard(rc));
          // Filter duplicates by card name
          rawCards.forEach((c: Card) => {
            if (!candidateCards.some(existing => existing.name.toLowerCase() === c.name.toLowerCase())) {
              candidateCards.push(c);
            }
          });
        }
      }
    } catch (err) {
      console.warn('Similarity search query failed:', err);
    }

    // Collect an ample candidate pool so only the highest quality comps emerge
    if (candidateCards.length >= 48) {
      break;
    }
  }

  // Score candidates against target card (filtering out low-similarity or superficial matches)
  // Strict quality gate: Only genuine comps with very high similarity (>= 58%) qualify.
  // Cards must share significant functional mechanics/effects, not merely superficial color/CMC.
  const scoredCandidates: { card: Card; score: number; reasons: string[] }[] = [];
  for (const cand of candidateCards) {
    const { score, reasons } = calculateCardSimilarity(targetCard, cand);
    if (score >= 58) {
      scoredCandidates.push({ card: cand, score, reasons });
    }
  }

  // Sort by highest similarity; return top high-conviction comps (up to 8)
  scoredCandidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Secondary tie-breaker: prefer colored archetype cards over colorless generic cards
    const aIsColorless = (!a.card.colors || a.card.colors.filter(c => c !== 'C').length === 0) ? 1 : 0;
    const bIsColorless = (!b.card.colors || b.card.colors.filter(c => c !== 'C').length === 0) ? 1 : 0;
    if (aIsColorless !== bIsColorless) return aIsColorless - bIsColorless;
    const aCmcDiff = Math.abs(a.card.cmc - targetCard.cmc);
    const bCmcDiff = Math.abs(b.card.cmc - targetCard.cmc);
    return aCmcDiff - bCmcDiff;
  });
  // Take top high-conviction candidates (up to 16) to ensure at least 4 with verified 17Lands data
  const topCandidates = scoredCandidates.slice(0, 16);

  // Group by set to batch-fetch 17Lands datasets
  // Filter out any sets known not to have 17Lands data and batch-fetch all candidate sets (up to 8)
  const neededSets = Array.from(new Set(topCandidates.map(c => c.card.set.toUpperCase())))
    .filter(setCode => {
      const known = POPULAR_LIMITED_SETS.find(s => s.code.toUpperCase() === setCode);
      return !known || known.has_17lands_data !== false;
    })
    .slice(0, 8);
  const setDatasets: Record<string, any> = {};

  await Promise.all(
    neededSets.map(async (setCode) => {
      try {
        const data = await fetch17LandsSetData(setCode);
        if (data) {
          setDatasets[setCode] = data;
        }
      } catch (e) {}
    })
  );

  // Assemble enriched matches with verified 17Lands data
  const enrichedMatches: SimilarCardMatch[] = [];
  for (const { card, score, reasons } of topCandidates) {
    const setCode = card.set.toUpperCase();
    const setData = setDatasets[setCode];
    const card17L = getOrEstimate17LandsCardRating(card, setData);

    const winRate = card17L?.win_rate;
    const alsa = card17L?.avg_seen;
    const tierGrade: GradeTier | undefined = (card17L?.tier_grade as GradeTier | undefined) || (typeof winRate === 'number' ? winRateToGradeTier(winRate) : undefined);

    // Strict quality rule: Only include cards with verified 17Lands data!
    // Never present a card with missing data or "Tier TBD" as a historical comp!
    if (typeof winRate === 'number' && tierGrade) {
      enrichedMatches.push({
        card,
        similarityScore: score,
        matchReasons: reasons,
        winRate,
        alsa,
        tierGrade,
      });
    }
  }

  // Diversity filter for the 4 presented matches:
  // When target has multiple signature action subtypes (e.g. flash_reach_ambush + etb_treasure),
  // avoid presenting duplicate twins of the specialized combat ambush role (e.g. both Dawn's Light Archer and Bounding Wolf)
  // so that both the combat ambush role and the ETB Treasure ramp role across curve slots are properly represented.
  const presentedMatches: SimilarCardMatch[] = [];
  let flashReachCount = 0;

  for (const match of enrichedMatches) {
    const cardFeatures = extractCardFeatures(match.card);
    const isFlashReach = cardFeatures.actionSubtypes.has('flash_reach_ambush');

    if (isFlashReach) {
      if (flashReachCount >= 1) continue; // Keep only the top-scoring / newest Flash+Reach representative
      flashReachCount++;
      presentedMatches.push(match);
    } else {
      presentedMatches.push(match);
    }

    if (presentedMatches.length >= 4) break;
  }

  // Fill any remaining slots up to 4 from remaining enrichedMatches
  if (presentedMatches.length < 4) {
    for (const match of enrichedMatches) {
      if (!presentedMatches.some(m => m.card.id === match.card.id || m.card.name.toLowerCase() === match.card.name.toLowerCase())) {
        presentedMatches.push(match);
        if (presentedMatches.length >= 4) break;
      }
    }
  }

  // Sort presented matches by similarity score
  presentedMatches.sort((a, b) => b.similarityScore - a.similarityScore);

  // Maintain presented matches at the front of matches list
  const reorderedMatches = [
    ...presentedMatches,
    ...enrichedMatches.filter(m => !presentedMatches.some(p => p.card.name.toLowerCase() === m.card.name.toLowerCase()))
  ];

  const consensus = calculateHistoricalConsensus(presentedMatches, targetCard);

  const result: CardSimilarityResult = {
    targetCard,
    matches: reorderedMatches,
    consensus,
  };

  similarityCache.set(cacheKey, result);
  return result;
}

/**
 * Calculates historical consensus projection based purely on 17Lands comps
 */
export function calculateHistoricalConsensus(matches: SimilarCardMatch[], targetCard: Card): HistoricalCompsConsensus {
  if (matches.length === 0) {
    return {
      sampleCount: 0,
      projectedTier: 'C',
      summaryText: 'Insufficient historical comps available to project a consensus grade.',
    };
  }

  const matchesWithGrade = matches.filter(m => Boolean(m.tierGrade));
  const valid17L = matches.filter(m => typeof m.winRate === 'number');

  let avgWinRate: number | undefined;
  let minWinRate: number | undefined;
  let maxWinRate: number | undefined;
  let tierRangeMin: GradeTier | undefined;
  let tierRangeMax: GradeTier | undefined;
  let projectedTier: GradeTier = 'C';

  // Average the letter grades of the cards shown
  if (matchesWithGrade.length > 0) {
    const sumScore = matchesWithGrade.reduce((acc, m) => acc + (GRADE_SCORES[m.tierGrade!] || 2.7), 0);
    const avgScore = sumScore / matchesWithGrade.length;
    projectedTier = scoreToGradeTier(avgScore);

    const validTiers = matchesWithGrade.map(m => m.tierGrade!);
    tierRangeMin = validTiers.reduce((min, t) => gradeTierToIndex(t) > gradeTierToIndex(min) ? t : min);
    tierRangeMax = validTiers.reduce((max, t) => gradeTierToIndex(t) < gradeTierToIndex(max) ? t : max);
  } else if (valid17L.length > 0) {
    const rates = valid17L.map(m => m.winRate!);
    avgWinRate = rates.reduce((a, b) => a + b, 0) / rates.length;
    projectedTier = winRateToGradeTier(avgWinRate);
    tierRangeMin = winRateToGradeTier(Math.min(...rates));
    tierRangeMax = winRateToGradeTier(Math.max(...rates));
  }

  if (valid17L.length > 0) {
    const rates = valid17L.map(m => m.winRate!);
    avgWinRate = rates.reduce((a, b) => a + b, 0) / rates.length;
    minWinRate = Math.min(...rates);
    maxWinRate = Math.max(...rates);
  }

  const typeDesc = targetCard.type_line ? targetCard.type_line.split('—')[0].trim() : 'card';
  const cmcDesc = `${targetCard.cmc}-mana`;
  const summaryText = valid17L.length > 0
    ? `Based on ${matches.length} comparable ${cmcDesc} ${typeDesc} cards shown below, historical win rates average ${(avgWinRate! * 100).toFixed(1)}% (Grade Average: ${projectedTier}).`
    : `Based on ${matches.length} comparable cards shown below, historical precedent indicates a Grade Average of ${projectedTier}.`;

  return {
    sampleCount: matches.length,
    projectedTier,
    averageWinRate: avgWinRate,
    minWinRate,
    maxWinRate,
    tierRangeMin,
    tierRangeMax,
    summaryText,
  };
}
