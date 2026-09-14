import type { Card, MTGColor, MTGRarity } from '../types/mtg';

export type ComparisonOperator = ':' | '=' | '!=' | '<' | '<=' | '>' | '>=';

export interface SearchToken {
  field: string; // 'name', 'oracle', 'type', 'color', 'identity', 'power', 'toughness', 'cmc', 'rarity', 'set', 'keyword', 'is', 'text'
  operator: ComparisonOperator;
  value: string;
  isNegated: boolean;
}

export interface AdvancedSearchFilters {
  name: string;
  nameExact: boolean;
  oracleText: string;
  types: string[];
  subtype: string;
  colors: MTGColor[];
  colorMode: 'exact' | 'include' | 'at_most' | 'identity';
  rarities: MTGRarity[];
  cmcOperator: ComparisonOperator;
  cmcValue: string;
  powerOperator: ComparisonOperator;
  powerValue: string;
  toughnessOperator: ComparisonOperator;
  toughnessValue: string;
  isInstantSpeed?: boolean;
  isRemoval?: boolean;
  isCombatTrick?: boolean;
}

export const DEFAULT_ADVANCED_FILTERS: AdvancedSearchFilters = {
  name: '',
  nameExact: false,
  oracleText: '',
  types: [],
  subtype: '',
  colors: [],
  colorMode: 'include',
  rarities: [],
  cmcOperator: '=',
  cmcValue: '',
  powerOperator: '>=',
  powerValue: '',
  toughnessOperator: '>=',
  toughnessValue: '',
};

const RARITY_ORDINAL: Record<string, number> = {
  common: 1,
  c: 1,
  uncommon: 2,
  u: 2,
  rare: 3,
  r: 3,
  mythic: 4,
  m: 4,
  special: 5,
  bonus: 5,
};

/**
 * Parses raw search input string into an array of search tokens.
 * Supports quoted strings: o:"damage to any target" or "Acrobatic Leap"
 */
export function tokenizeQuery(query: string): SearchToken[] {
  const tokens: SearchToken[] = [];
  const trimmed = query.trim();
  if (!trimmed) return tokens;

  // Regex pattern matching tokens:
  // Optional leading '-' for negation
  // Optional prefix and operator: (field)(:|!=|<=|>=|<|>|=)
  // Value: either quoted string "..." or non-whitespace characters
  const tokenRegex = /(-)?(?:([a-zA-Z/]+)(:|!=|<=|>=|<|>|=))?("(?:[^"\\]|\\.)*"|\S+)/g;

  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(trimmed)) !== null) {
    const isNegated = Boolean(match[1]);
    const fieldRaw = match[2]?.toLowerCase();
    const operator = (match[3] as ComparisonOperator) || ':';
    let valueRaw = match[4] || '';

    // Strip surrounding quotes if present
    if (valueRaw.startsWith('"') && valueRaw.endsWith('"') && valueRaw.length >= 2) {
      valueRaw = valueRaw.slice(1, -1);
    }

    if (!valueRaw) continue;

    if (!fieldRaw) {
      // 1. Auto-detect P/T pattern: e.g. "2/3", "1/1", "*/*", "0/4", "3/*", "*/2"
      const ptMatch = valueRaw.match(/^([0-9]+|\*)\/([0-9]+|\*)$/);
      if (ptMatch) {
        tokens.push({
          field: 'pt',
          operator: ':',
          value: valueRaw,
          isNegated,
        });
        continue;
      }

      // 2. Auto-detect mana cost pattern: e.g. "{2}{W}", "{W}", "{1}{B}{B}", "{X}{R}", "{U/R}"
      const manaBraceMatch = valueRaw.match(/^(\{[a-zA-Z0-9/]+\})+$/);
      if (manaBraceMatch) {
        tokens.push({
          field: 'mana',
          operator: ':',
          value: valueRaw,
          isNegated,
        });
        continue;
      }

      // General text token
      tokens.push({
        field: 'text',
        operator: ':',
        value: valueRaw.toLowerCase(),
        isNegated,
      });
      continue;
    }

    // Map field synonyms
    let field = fieldRaw;
    if (fieldRaw === 'n' || fieldRaw === 'name') field = 'name';
    else if (fieldRaw === 'o' || fieldRaw === 'oracle' || fieldRaw === 'text') field = 'oracle';
    else if (fieldRaw === 't' || fieldRaw === 'type') field = 'type';
    else if (fieldRaw === 'c' || fieldRaw === 'color') field = 'color';
    else if (fieldRaw === 'id' || fieldRaw === 'ci' || fieldRaw === 'identity') field = 'identity';
    else if (fieldRaw === 'pow' || fieldRaw === 'power') field = 'power';
    else if (fieldRaw === 'tou' || fieldRaw === 'toughness') field = 'toughness';
    else if (fieldRaw === 'pt' || fieldRaw === 'pow/tou' || fieldRaw === 'p/t' || fieldRaw === 'stats') field = 'pt';
    else if (fieldRaw === 'm' || fieldRaw === 'cost') field = 'mana';
    else if (fieldRaw === 'mana') {
      if (valueRaw.includes('{') || isNaN(Number(valueRaw))) field = 'mana';
      else field = 'cmc';
    }
    else if (fieldRaw === 'mv' || fieldRaw === 'cmc') field = 'cmc';
    else if (fieldRaw === 'r' || fieldRaw === 'rarity') field = 'rarity';
    else if (fieldRaw === 's' || fieldRaw === 'e' || fieldRaw === 'set') field = 'set';
    else if (fieldRaw === 'kw' || fieldRaw === 'keyword') field = 'keyword';
    else if (fieldRaw === 'is') field = 'is';

    tokens.push({
      field,
      operator,
      value: valueRaw,
      isNegated,
    });
  }

  return tokens;
}

/**
 * Compares two numeric values using the specified comparison operator.
 */
function compareNumbers(actual: number, expected: number, operator: ComparisonOperator): boolean {
  switch (operator) {
    case '=':
    case ':':
      return actual === expected;
    case '!=':
      return actual !== expected;
    case '<':
      return actual < expected;
    case '<=':
      return actual <= expected;
    case '>':
      return actual > expected;
    case '>=':
      return actual >= expected;
    default:
      return actual === expected;
  }
}

/**
 * Checks if a card matches color conditions according to Scryfall & Arena logic.
 */
function matchColors(
  cardColors: MTGColor[],
  operator: ComparisonOperator,
  targetValue: string
): boolean {
  const upperVal = targetValue.toUpperCase();
  const cardColorSet = new Set(cardColors);

  // Handle special targets: C (colorless), M / MULTI (multicolor)
  if (upperVal === 'C' || upperVal === 'COLORLESS') {
    if (operator === '=' || operator === ':') return cardColors.length === 0;
    if (operator === '!=') return cardColors.length > 0;
    return cardColors.length === 0;
  }

  if (upperVal === 'M' || upperVal === 'MULTI' || upperVal === 'MULTICOLOR') {
    if (operator === '=' || operator === ':') return cardColors.length > 1;
    if (operator === '!=') return cardColors.length <= 1;
    return cardColors.length > 1;
  }

  // Parse target colors (e.g. "WGB", "G", "WU")
  const targetColors: MTGColor[] = [];
  for (const ch of upperVal) {
    if (['W', 'U', 'B', 'R', 'G'].includes(ch)) {
      targetColors.push(ch as MTGColor);
    }
  }

  // If numeric comparison (e.g. c>1, c=2, c<2)
  const numVal = parseInt(targetValue, 10);
  if (!isNaN(numVal) && targetColors.length === 0) {
    return compareNumbers(cardColors.length, numVal, operator);
  }

  if (targetColors.length === 0) return true;

  const targetColorSet = new Set(targetColors);

  switch (operator) {
    case ':':
    case '=':
      // Exact match of colors
      if (cardColors.length !== targetColors.length) return false;
      return targetColors.every((c) => cardColorSet.has(c));

    case '!=':
      if (cardColors.length !== targetColors.length) return true;
      return !targetColors.every((c) => cardColorSet.has(c));

    case '>=':
      // Must include all target colors (can have more)
      return targetColors.every((c) => cardColorSet.has(c));

    case '<=':
      // All card colors must be in target colors (or colorless)
      return cardColors.every((c) => targetColorSet.has(c));

    case '>':
      // Must include target colors and have more colors
      return targetColors.every((c) => cardColorSet.has(c)) && cardColors.length > targetColors.length;

    case '<':
      // Subset with fewer colors
      return cardColors.every((c) => targetColorSet.has(c)) && cardColors.length < targetColors.length;

    default:
      return targetColors.every((c) => cardColorSet.has(c));
  }
}

/**
 * Checks if a card matches rarity conditions.
 */
function matchRarity(actualRarity: string, operator: ComparisonOperator, targetValue: string): boolean {
  const actualLower = (actualRarity || '').toLowerCase();
  const targetLower = targetValue.toLowerCase();

  const actualRank = RARITY_ORDINAL[actualLower] || 1;
  const targetRank = RARITY_ORDINAL[targetLower] || 1;

  if (operator === ':' || operator === '=') {
    return actualRank === targetRank;
  }
  return compareNumbers(actualRank, targetRank, operator);
}

/**
 * Checks if a single search token matches a card.
 */
export function matchToken(card: Card, token: SearchToken, userNote?: string): boolean {
  let matched = false;
  const { field, operator, value } = token;
  const lowerVal = value.toLowerCase();

  switch (field) {
    case 'text': {
      // Matches name, oracle text, type line, mana cost, collector number, or user notes
      const nameMatch = card.name.toLowerCase().includes(lowerVal);
      const oracleMatch = (card.oracle_text || '').toLowerCase().includes(lowerVal);
      const typeMatch = (card.type_line || '').toLowerCase().includes(lowerVal);
      const manaMatch = (card.mana_cost || '').toLowerCase().includes(lowerVal);
      const numberMatch = (card.collector_number || '').toLowerCase() === lowerVal;
      const noteMatch = userNote ? userNote.toLowerCase().includes(lowerVal) : false;
      matched = nameMatch || oracleMatch || typeMatch || manaMatch || numberMatch || noteMatch;
      break;
    }

    case 'name': {
      if (operator === '=' || operator === ':') {
        matched = card.name.toLowerCase().includes(lowerVal);
      } else if (operator === '!=') {
        matched = !card.name.toLowerCase().includes(lowerVal);
      }
      break;
    }

    case 'oracle': {
      const oracle = (card.oracle_text || '').toLowerCase();
      // Also check card faces if present
      const facesText = card.card_faces?.map((f) => f.oracle_text?.toLowerCase() || '').join(' ') || '';
      const fullOracle = `${oracle} ${facesText}`;
      matched = fullOracle.includes(lowerVal);
      break;
    }

    case 'type': {
      const typeLine = (card.type_line || '').toLowerCase();
      const facesType = card.card_faces?.map((f) => f.type_line?.toLowerCase() || '').join(' ') || '';
      const fullType = `${typeLine} ${facesType}`;
      matched = fullType.includes(lowerVal);
      break;
    }

    case 'color': {
      matched = matchColors(card.colors || [], operator, value);
      break;
    }

    case 'identity': {
      const identity = card.color_identity || card.colors || [];
      matched = matchColors(identity, operator, value);
      break;
    }

    case 'cmc': {
      const expectedNum = parseFloat(value);
      if (isNaN(expectedNum)) return true;
      matched = compareNumbers(card.cmc ?? 0, expectedNum, operator);
      break;
    }

    case 'power': {
      if (!card.power) return false;
      const actualPower = parseFloat(card.power);
      const expectedPower = parseFloat(value);
      if (isNaN(actualPower) || isNaN(expectedPower)) {
        // Fallback for * or special
        matched = card.power.trim() === value.trim();
      } else {
        matched = compareNumbers(actualPower, expectedPower, operator);
      }
      break;
    }

    case 'toughness': {
      if (!card.toughness) return false;
      const actualTou = parseFloat(card.toughness);
      const expectedTou = parseFloat(value);
      if (isNaN(actualTou) || isNaN(expectedTou)) {
        matched = card.toughness.trim() === value.trim();
      } else {
        matched = compareNumbers(actualTou, expectedTou, operator);
      }
      break;
    }

    case 'pt': {
      const parts = value.split('/');
      if (parts.length === 2) {
        const expPow = parts[0].trim();
        const expTou = parts[1].trim();

        const matchFacePT = (cardPow?: string, cardTou?: string) => {
          if (cardPow === undefined || cardTou === undefined) return false;
          const cpTrim = cardPow.trim();
          const ctTrim = cardTou.trim();

          const cP = parseFloat(cpTrim);
          const cT = parseFloat(ctTrim);
          const eP = parseFloat(expPow);
          const eT = parseFloat(expTou);

          const powMatches = expPow === '*' ? true : (!isNaN(cP) && !isNaN(eP) ? compareNumbers(cP, eP, operator) : cpTrim.toLowerCase() === expPow.toLowerCase());
          const touMatches = expTou === '*' ? true : (!isNaN(cT) && !isNaN(eT) ? compareNumbers(cT, eT, operator) : ctTrim.toLowerCase() === expTou.toLowerCase());

          return powMatches && touMatches;
        };

        const mainMatch = matchFacePT(card.power, card.toughness);
        const facesMatch = (card.card_faces || []).some((f) => matchFacePT(f.power, f.toughness));
        matched = mainMatch || facesMatch;
      }
      break;
    }

    case 'mana': {
      let normQuery = value;
      if (!normQuery.includes('{') && /^[0-9a-zA-Z/]+$/.test(normQuery)) {
        normQuery = normQuery.replace(/([0-9]+|[a-zA-Z])/g, '{$1}');
      }
      normQuery = normQuery.replace(/\{([a-zA-Z0-9/]+)\}/g, (_, s) => `{${s.toUpperCase()}}`).replace(/\s+/g, '');

      const cardCost = (card.mana_cost || '').replace(/\s+/g, '').toUpperCase();
      const faceCosts = (card.card_faces || []).map((f) => (f.mana_cost || '').replace(/\s+/g, '').toUpperCase());
      const allCosts = [cardCost, ...faceCosts].filter(Boolean);

      if (allCosts.length === 0) {
        matched = false;
        break;
      }

      if (operator === '=') {
        matched = allCosts.some((c) => c === normQuery);
      } else if (operator === ':' || operator === '>=') {
        matched = allCosts.some((c) => c === normQuery || c.includes(normQuery));
      } else if (operator === '!=') {
        matched = !allCosts.some((c) => c === normQuery || c.includes(normQuery));
      }
      break;
    }

    case 'rarity': {
      matched = matchRarity(card.rarity, operator, value);
      break;
    }

    case 'set': {
      matched = (card.set || '').toLowerCase() === lowerVal;
      break;
    }

    case 'keyword': {
      const hasInKw = (card.keywords || []).some((k) => k.toLowerCase().includes(lowerVal));
      const hasInOracle = (card.oracle_text || '').toLowerCase().includes(lowerVal);
      matched = hasInKw || hasInOracle;
      break;
    }

    case 'is': {
      if (lowerVal === 'creature') matched = Boolean(card.is_creature || card.type_line?.toLowerCase().includes('creature'));
      else if (lowerVal === 'instant') matched = Boolean(card.type_line?.toLowerCase().includes('instant'));
      else if (lowerVal === 'sorcery') matched = Boolean(card.type_line?.toLowerCase().includes('sorcery'));
      else if (lowerVal === 'land') matched = Boolean(card.is_land || card.type_line?.toLowerCase().includes('land'));
      else if (lowerVal === 'removal') matched = Boolean(card.is_removal);
      else if (lowerVal === 'trick' || lowerVal === 'combat_trick') matched = Boolean(card.is_combat_trick);
      else if (lowerVal === 'flash' || lowerVal === 'instant_speed') matched = Boolean(card.is_instant_speed);
      else if (lowerVal === 'legendary') matched = Boolean(card.type_line?.toLowerCase().includes('legendary'));
      else matched = (card.type_line || '').toLowerCase().includes(lowerVal);
      break;
    }

    default: {
      // Unknown field prefix: treat as general text search
      matched = card.name.toLowerCase().includes(lowerVal) ||
        (card.oracle_text || '').toLowerCase().includes(lowerVal) ||
        (card.type_line || '').toLowerCase().includes(lowerVal);
      break;
    }
  }

  return token.isNegated ? !matched : matched;
}

/**
 * Checks if a card matches the full query string.
 * All space-separated tokens must match (AND).
 * If contextSetCode is provided, guarantees card belongs to that set.
 */
export function cardMatchesQuery(
  card: Card,
  query: string,
  contextSetCode?: string,
  userNote?: string
): boolean {
  // If set context is active, card must match set
  if (contextSetCode) {
    if (card.set?.toLowerCase() !== contextSetCode.toLowerCase()) {
      return false;
    }
  }

  const trimmed = query.trim();
  if (!trimmed) return true;

  const tokens = tokenizeQuery(trimmed);
  if (tokens.length === 0) return true;

  return tokens.every((token) => matchToken(card, token, userNote));
}

/**
 * Builds an Arena/Scryfall query string from the Advanced Search Modal form state.
 */
export function buildQueryFromAdvancedFilters(filters: AdvancedSearchFilters): string {
  const parts: string[] = [];

  if (filters.name.trim()) {
    if (filters.nameExact) {
      parts.push(`name:"${filters.name.trim()}"`);
    } else {
      parts.push(`name:${filters.name.trim()}`);
    }
  }

  if (filters.oracleText.trim()) {
    if (filters.oracleText.includes(' ')) {
      parts.push(`o:"${filters.oracleText.trim()}"`);
    } else {
      parts.push(`o:${filters.oracleText.trim()}`);
    }
  }

  // Types
  if (filters.types.length > 0) {
    for (const t of filters.types) {
      parts.push(`t:${t.toLowerCase()}`);
    }
  }

  if (filters.subtype.trim()) {
    parts.push(`t:${filters.subtype.trim().toLowerCase()}`);
  }

  // Colors
  if (filters.colors.length > 0) {
    const colorStr = filters.colors.join('');
    if (filters.colorMode === 'exact') {
      parts.push(`c=${colorStr}`);
    } else if (filters.colorMode === 'include') {
      parts.push(`c>=${colorStr}`);
    } else if (filters.colorMode === 'at_most') {
      parts.push(`c<=${colorStr}`);
    } else if (filters.colorMode === 'identity') {
      parts.push(`id<=${colorStr}`);
    }
  }

  // Rarities
  if (filters.rarities.length === 1) {
    parts.push(`r=${filters.rarities[0].charAt(0)}`);
  } else if (filters.rarities.length > 1 && filters.rarities.length < 4) {
    const hasC = filters.rarities.includes('common');
    const hasU = filters.rarities.includes('uncommon');
    const hasR = filters.rarities.includes('rare');
    const hasM = filters.rarities.includes('mythic');

    if (hasC && hasU && !hasR && !hasM) {
      parts.push('r<=u');
    } else if (hasR && hasM && !hasC && !hasU) {
      parts.push('r>=r');
    } else {
      parts.push(filters.rarities.map((r) => `r:${r.charAt(0)}`).join(' '));
    }
  }

  // CMC / Mana Value
  if (filters.cmcValue.trim() !== '') {
    parts.push(`mv${filters.cmcOperator}${filters.cmcValue.trim()}`);
  }

  // Power
  if (filters.powerValue.trim() !== '') {
    parts.push(`pow${filters.powerOperator}${filters.powerValue.trim()}`);
  }

  // Toughness
  if (filters.toughnessValue.trim() !== '') {
    parts.push(`tou${filters.toughnessOperator}${filters.toughnessValue.trim()}`);
  }

  // Limited utility tags
  if (filters.isInstantSpeed) parts.push('is:flash');
  if (filters.isRemoval) parts.push('is:removal');
  if (filters.isCombatTrick) parts.push('is:trick');

  return parts.join(' ');
}
