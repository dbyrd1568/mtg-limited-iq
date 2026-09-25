import type { Card, MTGColor, MTGRarity } from '../types/mtg';

export type ComparisonOperator = ':' | '=' | '!=' | '<' | '<=' | '>' | '>=';

export interface SearchToken {
  field: string; // 'name', 'oracle', 'type', 'color', 'identity', 'power', 'toughness', 'cmc', 'rarity', 'set', 'keyword', 'is', 'text'
  operator: ComparisonOperator;
  value: string;
  isNegated: boolean;
  isQuoted?: boolean;
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
 * Returns all searchable text segments on a card across all fields and card faces.
 */
export function getAllCardSearchableTexts(card: Card, userNote?: string): string[] {
  const parts: string[] = [];

  if (card.name) parts.push(card.name);
  if (card.type_line) parts.push(card.type_line);
  if (card.oracle_text) parts.push(card.oracle_text);
  if (card.mana_cost) parts.push(card.mana_cost);
  if (card.collector_number) parts.push(card.collector_number);
  if (card.keywords && Array.isArray(card.keywords) && card.keywords.length > 0) {
    parts.push(card.keywords.join(' '));
  }
  if ((card as any).flavor_text) parts.push((card as any).flavor_text);
  if (card.archetype_tag) parts.push(card.archetype_tag);

  if (card.card_faces && Array.isArray(card.card_faces)) {
    for (const face of card.card_faces) {
      if (face.name) parts.push(face.name);
      if (face.type_line) parts.push(face.type_line);
      if (face.oracle_text) parts.push(face.oracle_text);
      if (face.mana_cost) parts.push(face.mana_cost);
      if ((face as any).flavor_text) parts.push((face as any).flavor_text);
    }
  }

  if (userNote) parts.push(userNote);

  return parts;
}

/**
 * Returns a unified lowercase string of all searchable text on a card.
 */
export function getFullCardSearchableText(card: Card, userNote?: string): string {
  return getAllCardSearchableTexts(card, userNote).join(' \n ').toLowerCase();
}

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
    const wasQuoted = valueRaw.startsWith('"') && valueRaw.endsWith('"') && valueRaw.length >= 2;
    if (wasQuoted) {
      valueRaw = valueRaw.slice(1, -1);
    } else {
      // Strip trailing punctuation like commas or semicolons when unquoted (e.g. "flying, 2/3, {2}{W}")
      valueRaw = valueRaw.replace(/[,;]+$/, '');
    }

    if (!valueRaw) continue;

    if (!fieldRaw) {
      if (!wasQuoted) {
        // 1. Auto-detect P/T pattern: e.g. "2/3", "1/1", "*/*", "0/4", "3/*", "*/2"
        const ptMatch = valueRaw.match(/^([0-9]+|\*)\/([0-9]+|\*)$/);
        if (ptMatch) {
          tokens.push({
            field: 'pt',
            operator: ':',
            value: valueRaw,
            isNegated,
            isQuoted: false,
          });
          continue;
        }

        // 2. Auto-detect bracketed mana cost pattern: e.g. "{2}{W}", "{W}", "{1}{B}{B}", "{X}{R}", "{U/R}"
        const manaBraceMatch = valueRaw.match(/^(\{[a-zA-Z0-9/]+\})+$/);
        if (manaBraceMatch) {
          tokens.push({
            field: 'mana',
            operator: ':',
            value: valueRaw,
            isNegated,
            isQuoted: false,
          });
          continue;
        }

        // 3. Auto-detect shorthand mana pattern: e.g. "2W", "1U", "3BB", "1G", "4RR", "WW", "WUBRG"
        const shorthandManaMatch = valueRaw.match(/^([0-9]+[wubrgcWUBRGC]+|[WUBRGC]{2,})$/);
        if (shorthandManaMatch) {
          tokens.push({
            field: 'mana',
            operator: ':',
            value: valueRaw,
            isNegated,
            isQuoted: false,
          });
          continue;
        }
      }

      // General text token
      tokens.push({
        field: 'text',
        operator: ':',
        value: valueRaw.toLowerCase(),
        isNegated,
        isQuoted: wasQuoted,
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
      isQuoted: wasQuoted,
    });
  }

  return tokens;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Checks whether an unquoted word or term appears in text at a natural word boundary.
 * Short words (<= 2 chars) like "a", "or", "in", "to" require exact word boundaries
 * to avoid matching inside longer words like "instant", "target", "creature", "sorcery".
 * Longer terms (>= 3 chars) match natural word prefix/boundaries (e.g. "count" -> "counter", "fly" -> "flying").
 */
export function matchWordInText(fullText: string, word: string): boolean {
  if (!word || !fullText) return false;
  const lowerText = fullText.toLowerCase();
  const lowerWord = word.toLowerCase();
  const escaped = escapeRegex(lowerWord);

  if (lowerWord.length <= 2) {
    return new RegExp(`(^|[^a-zA-Z0-9])${escaped}([^a-zA-Z0-9]|$)`, 'i').test(lowerText);
  }

  return new RegExp(`(^|[^a-zA-Z0-9])${escaped}`, 'i').test(lowerText);
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
      // Matches full unified text across name, oracle text, card faces, type line, keywords, mana cost, collector number, or user notes
      const fullText = getFullCardSearchableText(card, userNote);
      const numberMatch = (card.collector_number || '').toLowerCase() === lowerVal;
      if (token.isQuoted) {
        matched = fullText.includes(lowerVal) || numberMatch;
      } else {
        matched = matchWordInText(fullText, lowerVal) || numberMatch;
      }
      break;
    }

    case 'name': {
      const cardName = card.name.toLowerCase();
      const faceNames = (card.card_faces || []).map((f) => (f.name || '').toLowerCase());
      const allNames = [cardName, ...faceNames];
      if (token.isQuoted) {
        matched = allNames.some((n) => n.includes(lowerVal));
      } else {
        matched = allNames.some((n) => matchWordInText(n, lowerVal));
      }
      if (operator === '!=') {
        matched = !matched;
      }
      break;
    }

    case 'oracle': {
      const oracle = (card.oracle_text || '').toLowerCase();
      // Also check card faces if present
      const facesText = card.card_faces?.map((f) => f.oracle_text?.toLowerCase() || '').join(' ') || '';
      const fullOracle = `${oracle} ${facesText}`;
      if (token.isQuoted) {
        matched = fullOracle.includes(lowerVal);
      } else {
        matched = matchWordInText(fullOracle, lowerVal);
      }
      if (operator === '!=') {
        matched = !matched;
      }
      break;
    }

    case 'type': {
      const typeLine = (card.type_line || '').toLowerCase();
      const facesType = card.card_faces?.map((f) => f.type_line?.toLowerCase() || '').join(' ') || '';
      const fullType = `${typeLine} ${facesType}`;
      if (token.isQuoted) {
        matched = fullType.includes(lowerVal);
      } else {
        matched = matchWordInText(fullType, lowerVal);
      }
      if (operator === '!=') {
        matched = !matched;
      }
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
      const facesOracle = (card.card_faces || []).some((f) => (f.oracle_text || '').toLowerCase().includes(lowerVal));
      matched = hasInKw || hasInOracle || facesOracle;
      break;
    }

    case 'is': {
      if (lowerVal === 'creature') matched = Boolean(card.is_creature || card.type_line?.toLowerCase().includes('creature'));
      else if (lowerVal === 'instant') matched = Boolean(card.type_line?.toLowerCase().includes('instant'));
      else if (lowerVal === 'sorcery') matched = Boolean(card.type_line?.toLowerCase().includes('sorcery'));
      else if (lowerVal === 'land') matched = Boolean(card.is_land || card.type_line?.toLowerCase().includes('land'));
      else if (lowerVal === 'removal') matched = Boolean(card.is_removal);
      else if (lowerVal === 'interaction') matched = Boolean(card.is_interaction);
      else if (lowerVal === 'counter' || lowerVal === 'counterspell') matched = Boolean(card.is_counterspell);
      else if (lowerVal === 'draw' || lowerVal === 'card_draw' || lowerVal === 'advantage') matched = Boolean(card.is_card_draw);
      else if (lowerVal === 'trick' || lowerVal === 'combat_trick') matched = Boolean(card.is_combat_trick);
      else if (lowerVal === 'flash' || lowerVal === 'instant_speed') matched = Boolean(card.is_instant_speed);
      else if (lowerVal === 'legendary') matched = Boolean(card.type_line?.toLowerCase().includes('legendary'));
      else matched = (card.type_line || '').toLowerCase().includes(lowerVal);
      break;
    }

    default: {
      // Unknown field prefix: treat as general text search
      const fullText = getFullCardSearchableText(card, userNote);
      matched = fullText.includes(lowerVal);
      break;
    }
  }

  return token.isNegated ? !matched : matched;
}

/**
 * Checks if a card matches the full query string.
 * Supports auto-inferred multi-word text phrases (e.g. "draw a card", "counter target spell"),
 * mana costs ({2}{W}, 2W), creature stats (2/3), and advanced filter tokens in any combination or order.
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

  // Split tokens into specific syntax filters and general text tokens
  const nonTextTokens = tokens.filter((t) => t.field !== 'text');
  const textTokens = tokens.filter((t) => t.field === 'text');

  // All specific syntax tokens must match
  if (!nonTextTokens.every((token) => matchToken(card, token, userNote))) {
    return false;
  }

  // If no general text tokens exist, card has passed all syntax criteria
  if (textTokens.length === 0) {
    return true;
  }

  // If there are negated text tokens, verify they do not match
  const negatedText = textTokens.filter((t) => t.isNegated);
  if (negatedText.length > 0 && !negatedText.every((t) => matchToken(card, t, userNote))) {
    return false;
  }

  const positiveText = textTokens.filter((t) => !t.isNegated);
  if (positiveText.length === 0) {
    return true;
  }

  const quotedTokens = positiveText.filter((t) => t.isQuoted);
  const unquotedTokens = positiveText.filter((t) => !t.isQuoted);

  // 1. Quoted exact string searches:
  // Quotes "" keep the string search together: searches for that exact combo of words in that exact order
  if (quotedTokens.length > 0) {
    const allQuotedMatch = quotedTokens.every((token) => matchToken(card, token, userNote));
    if (!allQuotedMatch) {
      return false;
    }
  }

  // 2. Unquoted text tokens:
  // Unquoted terms search for any/or of those words
  if (unquotedTokens.length > 0) {
    if (unquotedTokens.length === 1) {
      return matchToken(card, unquotedTokens[0], userNote);
    }

    // Filter out common connector/stop words ('a', 'an', 'the', 'or', 'and') when other content words exist,
    // so connector words don't cause every card to match
    const STOP_WORDS = new Set(['a', 'an', 'the', 'or', 'and']);
    const contentTokens = unquotedTokens.filter((t) => !STOP_WORDS.has(t.value.toLowerCase()));
    const effectiveUnquoted = contentTokens.length > 0 ? contentTokens : unquotedTokens;

    const anyUnquotedMatch = effectiveUnquoted.some((token) => matchToken(card, token, userNote));
    if (!anyUnquotedMatch) {
      return false;
    }
  }

  return true;
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
