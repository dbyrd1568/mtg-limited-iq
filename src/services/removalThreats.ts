import { Card, MTGRarity } from '../types/mtg';
import { isRemovalSpell, isCombatTrick, isCounterspell, isInteractionSpell } from './scryfall';

export type ThreatSpeed = 'Instant' | 'Sorcery' | 'Aura' | 'Permanent' | 'Other';

export type ThreatMechanism =
  | 'Burn'
  | 'Destroy'
  | 'Exile'
  | '-N/-N'
  | 'Fight/Bite'
  | 'Pacifism'
  | 'Bounce'
  | 'Counterspell'
  | 'Combat Trick'
  | 'Sweeper'
  | 'Other';

export interface ThreatClassification {
  speed: ThreatSpeed;
  mechanism: ThreatMechanism;
  shortSummary: string;
  restriction?: string;
  damageAmount?: number;
  statMod?: string;
  isInstantOrFlash: boolean;
  isCommonOrUncommon: boolean;
  primaryColor: string; // 'W' | 'U' | 'B' | 'R' | 'G' | 'M' | 'C'
}

export interface ThreatCard {
  card: Card;
  classification: ThreatClassification;
}

export interface OpenManaPool {
  W: number;
  U: number;
  B: number;
  R: number;
  G: number;
  C: number; // Generic or colorless
}

/**
 * Parses and classifies an MTG card's removal or combat threat profile.
 */
export function classifyThreat(card: Card): ThreatClassification {
  const typeLine = (card.type_line || '').toLowerCase();
  const oracle = (card.oracle_text || '').toLowerCase();
  const keywords = (card.keywords || []).map((k) => k.toLowerCase());

  const isInstant = typeLine.includes('instant');
  const hasFlash = keywords.includes('flash') || oracle.includes('flash');
  const isInstantOrFlash = isInstant || hasFlash;
  const isAura = typeLine.includes('aura') || typeLine.includes('enchantment — aura');
  const isSorcery = typeLine.includes('sorcery');
  const isPermanent = typeLine.includes('creature') || typeLine.includes('artifact') || typeLine.includes('enchantment') || typeLine.includes('planeswalker');

  let speed: ThreatSpeed = 'Other';
  if (isInstantOrFlash) speed = 'Instant';
  else if (isAura) speed = 'Aura';
  else if (isSorcery) speed = 'Sorcery';
  else if (isPermanent) speed = 'Permanent';

  const isCU = card.rarity === 'common' || card.rarity === 'uncommon';

  // Primary color determination
  let primaryColor = 'C';
  if (card.colors && card.colors.length === 1) {
    primaryColor = card.colors[0];
  } else if (card.colors && card.colors.length > 1) {
    primaryColor = 'M';
  }

  // Detect restriction
  let restriction: string | undefined;
  if (oracle.includes('tapped creature') || oracle.includes('target tapped')) {
    restriction = 'Tapped only';
  } else if (oracle.includes('attacking or blocking') || oracle.includes('target attacking')) {
    restriction = 'Attacking / Blocking';
  } else if (oracle.includes('power 4 or greater') || oracle.includes('power 3 or greater')) {
    restriction = 'Power ≥ 4';
  } else if (oracle.includes('nonlegendary') || oracle.includes('non-legendary')) {
    restriction = 'Non-legendary';
  } else if (oracle.includes('flying') && (oracle.includes('with flying') || oracle.includes('creature with flying'))) {
    restriction = 'Flying only';
  } else if (oracle.includes('artifact or enchantment') || oracle.includes('enchantment or artifact')) {
    restriction = 'Artifact / Enchantment';
  }

  // Damage amount detection
  let damageAmount: number | undefined;
  const dmgMatch = oracle.match(/deals (\d+) damage/);
  if (dmgMatch) {
    damageAmount = parseInt(dmgMatch[1], 10);
  }

  // Stat modification detection (e.g. +3/+3, -2/-2)
  let statMod: string | undefined;
  const modMatch = oracle.match(/([+-]\d+\/[+-]\d+)/);
  if (modMatch) {
    statMod = modMatch[1];
  }

  // Mechanism detection
  let mechanism: ThreatMechanism = 'Other';
  let shortSummary = '';

  const isSweeper = (oracle.includes('destroy all') || oracle.includes('exile all') || oracle.includes('destroy each') || oracle.includes('exile each')) &&
    (oracle.includes('creature') || oracle.includes('nonland permanent'));

  if (isSweeper) {
    mechanism = 'Sweeper';
    shortSummary = oracle.includes('exile') ? 'Exile all creatures (Board Wipe)' : 'Destroy all creatures (Board Wipe)';
  } else if (isCounterspell(card)) {
    mechanism = 'Counterspell';
    shortSummary = oracle.includes('noncreature')
      ? 'Counter target noncreature spell'
      : oracle.includes('creature spell')
      ? 'Counter target creature spell'
      : oracle.includes('unless its controller pays')
      ? 'Soft counter (mana tax)'
      : 'Counter target spell';
  } else if (damageAmount !== undefined) {
    mechanism = 'Burn';
    shortSummary = oracle.includes('any target')
      ? `Deals ${damageAmount} damage to any target`
      : `Deals ${damageAmount} damage to target creature`;
  } else if (statMod && statMod.startsWith('-')) {
    mechanism = '-N/-N';
    shortSummary = `Target creature gets ${statMod}`;
  } else if (oracle.includes('fights target') || oracle.includes('deals damage equal to its power') || oracle.includes("equal to target creature's power")) {
    mechanism = 'Fight/Bite';
    shortSummary = oracle.includes('fights') ? 'Creature fight spell' : 'Bite (deals power as damage)';
  } else if (oracle.includes("can't attack or block") || oracle.includes("doesn't untap") || oracle.includes('loses all abilities')) {
    mechanism = 'Pacifism';
    shortSummary = oracle.includes("doesn't untap") ? "Tap & doesn't untap" : "Can't attack or block (Neutralize)";
  } else if (oracle.includes('return target') && (oracle.includes('hand') || oracle.includes("owner's hand"))) {
    mechanism = 'Bounce';
    shortSummary = 'Bounce target to hand';
  } else if (oracle.includes('exile target creature') || oracle.includes('exile target permanent') || oracle.includes('exile target nonland')) {
    mechanism = 'Exile';
    shortSummary = restriction ? `Exile target creature (${restriction})` : 'Exile target creature';
  } else if (oracle.includes('destroy target creature') || oracle.includes('destroy target permanent') || oracle.includes('destroy target nonland')) {
    mechanism = 'Destroy';
    shortSummary = restriction ? `Destroy target creature (${restriction})` : 'Destroy target creature';
  } else if (isCombatTrick(card)) {
    mechanism = 'Combat Trick';
    shortSummary = statMod ? `Buffs ${statMod} at instant speed` : 'Combat trick & keyword buff';
  } else {
    shortSummary = card.type_line || 'Interaction spell';
  }

  return {
    speed,
    mechanism,
    shortSummary,
    restriction,
    damageAmount,
    statMod,
    isInstantOrFlash,
    isCommonOrUncommon: isCU,
    primaryColor,
  };
}

/**
 * Tests whether a card constitutes an interactive threat (removal, combat trick, counterspell, bounce, sweeper).
 */
export function isCardThreat(card: Card): boolean {
  if (card.is_land || (card.type_line || '').toLowerCase().includes('basic land')) {
    return false;
  }

  // Direct boolean helpers
  if (isRemovalSpell(card) || isCombatTrick(card) || isCounterspell(card) || isInteractionSpell(card)) {
    return true;
  }

  const type = (card.type_line || '').toLowerCase();
  const oracle = (card.oracle_text || '').toLowerCase();

  // Instant or Flash interaction
  if (type.includes('instant') || (card.keywords || []).some((k) => k.toLowerCase() === 'flash')) {
    if (
      oracle.includes('target creature') ||
      oracle.includes('target permanent') ||
      oracle.includes('target spell') ||
      oracle.includes('counter target') ||
      oracle.includes('deals') ||
      oracle.includes('destroy') ||
      oracle.includes('exile') ||
      oracle.includes('return target') ||
      oracle.includes('tap target') ||
      oracle.includes('gets +') ||
      oracle.includes('gets -') ||
      oracle.includes('gains') ||
      oracle.includes('prevent')
    ) {
      return true;
    }
  }

  // Pacifism or neutralization enchantment
  if (type.includes('enchantment') && (oracle.includes("can't attack or block") || oracle.includes("doesn't untap"))) {
    return true;
  }

  return false;
}

/**
 * Extracts and classifies all threats for a set of cards.
 */
export function getSetThreatCards(cards: Card[]): ThreatCard[] {
  const result: ThreatCard[] = [];
  const seenIds = new Set<string>();

  for (const card of cards) {
    if (seenIds.has(card.id)) continue;
    if (isCardThreat(card)) {
      seenIds.add(card.id);
      result.push({
        card,
        classification: classifyThreat(card),
      });
    }
  }

  // Sort by CMC ascending, then by name
  return result.sort((a, b) => {
    if (a.card.cmc !== b.card.cmc) return a.card.cmc - b.card.cmc;
    return a.card.name.localeCompare(b.card.name);
  });
}

/**
 * Determines whether a card could be cast given an opponent's available open mana pool.
 */
export function canCastWithOpenMana(card: Card, pool: OpenManaPool): boolean {
  const totalOpen = pool.W + pool.U + pool.B + pool.R + pool.G + pool.C;
  if (totalOpen < card.cmc) {
    return false;
  }

  const cost = card.mana_cost || '';
  if (!cost) {
    return true;
  }

  // Parse required colored pips
  const requiredColors: { W: number; U: number; B: number; R: number; G: number } = {
    W: 0,
    U: 0,
    B: 0,
    R: 0,
    G: 0,
  };

  const matches = cost.match(/\{[^}]+\}/g) || [];
  for (const sym of matches) {
    const clean = sym.replace(/[{}]/g, '').toUpperCase();
    if (clean === 'W') requiredColors.W++;
    else if (clean === 'U') requiredColors.U++;
    else if (clean === 'B') requiredColors.B++;
    else if (clean === 'R') requiredColors.R++;
    else if (clean === 'G') requiredColors.G++;
  }

  // Verify all specific colored pip requirements are met
  if (pool.W < requiredColors.W) return false;
  if (pool.U < requiredColors.U) return false;
  if (pool.B < requiredColors.B) return false;
  if (pool.R < requiredColors.R) return false;
  if (pool.G < requiredColors.G) return false;

  return true;
}
