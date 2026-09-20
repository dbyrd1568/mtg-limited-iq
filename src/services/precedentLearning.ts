import { Card } from '../types/mtg';
import { SimilarCardMatch, extractCardFeatures } from './cardSimilarity';
import { getActiveUser } from './storage';

export interface LearnedTouchstone {
  id: string;
  profileKey: string;
  touchstoneCard: Card;
  sourceCardName: string;
  sourceCardSet?: string;
  selectionCount: number;
  lastSelectedAt: string;
  reasons: string[];
}

export interface LearnedMechanicBridge {
  id: string;
  sourceMechanic: string;
  historicalTerms: string[];
  sourceCardName: string;
  targetCompName: string;
  createdAt: string;
  hitCount: number;
}

export interface LearnedPreferenceDelta {
  targetCardName: string;
  targetCardSet?: string;
  rejectedCardName?: string;
  chosenCardName: string;
  timestamp: string;
  cmcDelta: number;
  speedShift?: 'instant_to_sorcery' | 'sorcery_to_instant' | 'matched';
  inferredInsights: string[];
  mechanicBridgeFormed?: string;
}

export interface PrecedentLearningStore {
  touchstones: Record<string, LearnedTouchstone>;
  mechanicBridges: Record<string, LearnedMechanicBridge>;
  tuningLog: LearnedPreferenceDelta[];
}

export function getLearningStorageKey(userId?: string): string {
  const activeId = userId || getActiveUser()?.id || 'guest';
  return `mtg_precedent_learning_${activeId}`;
}

/**
 * Retrieves all stored learned precedents, bridges, and touchstones.
 */
export function getAllLearnedKnowledge(userId?: string): PrecedentLearningStore {
  try {
    const key = getLearningStorageKey(userId);
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    if (!raw) {
      return { touchstones: {}, mechanicBridges: {}, tuningLog: [] };
    }
    const parsed = JSON.parse(raw);
    return {
      touchstones: parsed.touchstones || {},
      mechanicBridges: parsed.mechanicBridges || {},
      tuningLog: parsed.tuningLog || [],
    };
  } catch (err) {
    console.warn('Failed to read precedent learning from storage:', err);
    return { touchstones: {}, mechanicBridges: {}, tuningLog: [] };
  }
}

/**
 * Persists the learned knowledge store.
 */
export function saveLearnedKnowledge(store: PrecedentLearningStore, userId?: string): void {
  try {
    const key = getLearningStorageKey(userId);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(store));
    }
  } catch (err) {
    console.error('Failed to save precedent learning:', err);
  }
}

/**
 * Clears all learned knowledge for a user.
 */
export function clearAllLearnedKnowledge(userId?: string): void {
  try {
    const key = getLearningStorageKey(userId);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch (err) {
    console.error('Failed to clear precedent learning:', err);
  }
}

/**
 * Evergreen and common combat keywords that are not novel set mechanics.
 */
const EVERGREEN_KEYWORDS = new Set([
  'flying', 'reach', 'deathtouch', 'lifelink', 'first strike', 'double strike',
  'trample', 'vigilance', 'haste', 'menace', 'flash', 'defender', 'ward',
  'hexproof', 'indestructible', 'enchant'
]);

/**
 * Known historical mechanics to bridge against.
 */
const HISTORICAL_MECHANIC_DEFINITIONS: Record<string, string[]> = {
  heroic: ['heroic', 'whenever you cast a spell that targets'],
  prowess: ['prowess', 'whenever you cast a noncreature spell'],
  kicker: ['kicker', 'multikicker'],
  flashback: ['flashback', 'jump-start', 'aftermath'],
  surveil: ['surveil'],
  connive: ['connive', 'connives'],
  amass: ['amass', 'amass orcs', 'amass zombies'],
  decayed: ['decayed'],
  unearth: ['unearth', 'disturb'],
  investigate: ['investigate', 'clue token'],
  blood: ['blood token', 'create a blood'],
  map: ['map token', 'explore'],
  food: ['food token', 'create a food'],
  treasure: ['treasure token', 'create a treasure'],
  proliferate: ['proliferate'],
  corrupted: ['corrupted', 'poison counter', 'toxic'],
  descend: ['descend 4', 'descend 8', 'fathomless descent'],
  threshold: ['threshold', 'seven or more cards in your graveyard'],
  delirium: ['delirium', 'four or more card types'],
};

/**
 * Extracts distinct mechanics and ability words from a card's oracle text.
 */
export function extractMechanicsFromCard(card: Card): string[] {
  const text = card.oracle_text || '';
  const mechanics: string[] = [];

  // 1. Check ability words before em-dash (e.g. "Valiant —", "Corrupted —", "Expend 4 —")
  const abilityWordRegex = /(?:^|\n)([A-Za-z][A-Za-z0-9\s]{1,24})\s*—/g;
  let match: RegExpExecArray | null;
  while ((match = abilityWordRegex.exec(text)) !== null) {
    const rawWord = match[1].trim().toLowerCase();
    // Normalize mechanics with digits like "expend 4" -> "expend"
    const normalized = rawWord.replace(/\s+\d+$/, '');
    if (!mechanics.includes(normalized)) {
      mechanics.push(normalized);
    }
  }

  // 2. Check keywords on card
  (card.keywords || []).forEach(kw => {
    const norm = kw.trim().toLowerCase().replace(/\s+\d+$/, '');
    if (!EVERGREEN_KEYWORDS.has(norm) && !mechanics.includes(norm)) {
      mechanics.push(norm);
    }
  });

  // 3. Known signature mechanics from text phrases
  if (/offspring\s*\{/i.test(text) && !mechanics.includes('offspring')) mechanics.push('offspring');
  if (/gift a\s+/i.test(text) && !mechanics.includes('gift')) mechanics.push('gift');
  if (/forage/i.test(text) && !mechanics.includes('forage')) mechanics.push('forage');
  if (/empower jace/i.test(text) && !mechanics.includes('empower_jace')) mechanics.push('empower_jace');
  if (/plot\s*\{/i.test(text) && !mechanics.includes('plot')) mechanics.push('plot');
  if (/saddle\s*\d+/i.test(text) && !mechanics.includes('saddle')) mechanics.push('saddle');
  if (/disguise\s*\{/i.test(text) && !mechanics.includes('disguise')) mechanics.push('disguise');
  if (/craft with\s+/i.test(text) && !mechanics.includes('craft')) mechanics.push('craft');

  return mechanics;
}

/**
 * Generates a normalized functional profile key for a card to group similar cards.
 */
export function getCardProfileKey(card: Card): string {
  const f = extractCardFeatures(card);
  const colors = [...f.colors].sort().join('') || 'C';
  const cmcBucket = f.cmc <= 2 ? 'cheap' : (f.cmc <= 4 ? 'mid' : 'expensive');

  let typeKey = f.primaryType;
  if (f.isInstant || f.isSorcery) {
    typeKey = 'spell';
  }

  let effectTag = 'standard';
  if (f.isCreature) {
    if (f.hasFlying) effectTag = 'flier';
    else if (f.createsTokens) effectTag = 'tokens';
    else if (f.cmc <= 2) effectTag = 'aggro_beater';
    else if (f.cmc >= 5) effectTag = 'finisher';
    else if (f.isRemoval) effectTag = 'removal';
    else if (f.detectedCategories.has('card_draw')) effectTag = 'draw';
  } else {
    if (f.isRemoval) effectTag = 'removal';
    else if (f.isCombatTrick) effectTag = 'trick';
    else if (f.detectedCategories.has('counter')) effectTag = 'counter';
    else if (f.detectedCategories.has('burn')) effectTag = 'burn';
    else if (f.detectedCategories.has('card_draw')) effectTag = 'draw';
    else if (f.createsTokens) effectTag = 'tokens';
  }

  return `${typeKey}_${colors}_${cmcBucket}_${effectTag}`;
}

/**
 * Analyzes a user replacement and extracts durable learning.
 */
export function recordPrecedentLearning(
  targetCard: Card,
  rejectedMatch: SimilarCardMatch | null,
  chosenMatch: SimilarCardMatch,
  userId?: string
): LearnedPreferenceDelta {
  const store = getAllLearnedKnowledge(userId);
  const targetFeatures = extractCardFeatures(targetCard);
  const chosenCard = chosenMatch.card;
  const chosenFeatures = extractCardFeatures(chosenCard);
  const rejectedCard = rejectedMatch?.card;
  const rejectedFeatures = rejectedCard ? extractCardFeatures(rejectedCard) : null;

  const insights: string[] = [];

  // 1. Extract and register Touchstone Benchmark
  const profileKey = getCardProfileKey(targetCard);
  const touchstoneId = `ts_${profileKey}_${chosenCard.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

  const existingTouchstone = store.touchstones[touchstoneId];
  const touchstoneReasons = [
    `User-verified touchstone comp for ${targetCard.name} (${targetCard.set})`,
    `Matches ${targetFeatures.primaryType} ${targetFeatures.colors.join('/')} ${targetCard.cmc}-mana profile`,
  ];

  store.touchstones[touchstoneId] = {
    id: touchstoneId,
    profileKey,
    touchstoneCard: chosenCard,
    sourceCardName: targetCard.name,
    sourceCardSet: targetCard.set,
    selectionCount: (existingTouchstone?.selectionCount || 0) + 1,
    lastSelectedAt: new Date().toISOString(),
    reasons: touchstoneReasons,
  };

  insights.push(`Registered ${chosenCard.name} as touchstone benchmark for [${profileKey}]`);

  // 2. Mechanic Bridge Detection (The Rosetta Stone)
  const targetMechanics = extractMechanicsFromCard(targetCard);
  let bridgedMechanicName: string | undefined;

  if (targetMechanics.length > 0) {
    const chosenMechanics = extractMechanicsFromCard(chosenCard);
    const chosenOracle = (chosenCard.oracle_text || '').toLowerCase();

    for (const tm of targetMechanics) {
      let bridgeTerms: string[] = [];

      // Check known historical mechanic definitions
      if (tm === 'valiant') {
        bridgeTerms = ['heroic', 'whenever you cast a spell that targets', 'target creature you control'];
      } else if (tm === 'offspring') {
        bridgeTerms = ['kicker', "token that's a copy", 'create a token'];
      } else if (tm === 'forage') {
        bridgeTerms = ['exile cards from your graveyard', 'food token', 'threshold'];
      } else if (tm === 'gift') {
        bridgeTerms = ['additional cost', 'opponent draws', 'opponent creates'];
      } else if (tm === 'empower_jace') {
        bridgeTerms = ['surveil', 'draw a card', 'amass'];
      } else {
        // Dynamic detection from chosen card's keywords / ability words
        if (chosenMechanics.length > 0) {
          bridgeTerms = chosenMechanics.flatMap(cm => HISTORICAL_MECHANIC_DEFINITIONS[cm] || [cm]);
        } else if (chosenOracle.includes('whenever') || chosenOracle.includes('target')) {
          // Extract specific triggering pattern
          if (/whenever you cast/i.test(chosenOracle)) bridgeTerms.push('whenever you cast');
          if (/when.*enters/i.test(chosenOracle)) bridgeTerms.push('when enters');
          if (/target creature you control/i.test(chosenOracle)) bridgeTerms.push('target creature you control');
        }
      }

      if (bridgeTerms.length > 0) {
        const bridgeId = `bridge_${tm}`;
        store.mechanicBridges[bridgeId] = {
          id: bridgeId,
          sourceMechanic: tm,
          historicalTerms: Array.from(new Set(bridgeTerms)),
          sourceCardName: targetCard.name,
          targetCompName: chosenCard.name,
          createdAt: new Date().toISOString(),
          hitCount: (store.mechanicBridges[bridgeId]?.hitCount || 0) + 1,
        };
        bridgedMechanicName = tm;
        insights.push(`Established mechanic bridge: [${tm}] <---> [${bridgeTerms.slice(0, 3).join(', ')}] via ${chosenCard.name}`);
      }
    }
  }

  // 3. Rate and Timing Delta Analysis
  const cmcDelta = rejectedCard ? chosenCard.cmc - rejectedCard.cmc : 0;
  let speedShift: 'instant_to_sorcery' | 'sorcery_to_instant' | 'matched' | undefined;

  if (rejectedCard && rejectedFeatures) {
    if (rejectedFeatures.isInstant && chosenFeatures.isSorcery) speedShift = 'instant_to_sorcery';
    else if (rejectedFeatures.isSorcery && chosenFeatures.isInstant) speedShift = 'sorcery_to_instant';
    else speedShift = 'matched';

    if (Math.abs(targetCard.cmc - chosenCard.cmc) < Math.abs(targetCard.cmc - rejectedCard.cmc)) {
      insights.push(`Prioritized exact mana value (${chosenCard.cmc} CMC over ${rejectedCard.cmc} CMC)`);
    }

    if (speedShift === 'instant_to_sorcery' && targetFeatures.isSorcery) {
      insights.push(`Strict Sorcery-speed timing respected over Instant-speed alternative`);
    } else if (speedShift === 'sorcery_to_instant' && targetFeatures.isInstant) {
      insights.push(`Strict Instant-speed timing respected over Sorcery-speed alternative`);
    }
  }

  // 4. Record to Tuning Log
  const deltaRecord: LearnedPreferenceDelta = {
    targetCardName: targetCard.name,
    targetCardSet: targetCard.set,
    rejectedCardName: rejectedCard?.name,
    chosenCardName: chosenCard.name,
    timestamp: new Date().toISOString(),
    cmcDelta,
    speedShift,
    inferredInsights: insights,
    mechanicBridgeFormed: bridgedMechanicName,
  };

  store.tuningLog.unshift(deltaRecord);
  // Cap tuning log at 100 entries
  if (store.tuningLog.length > 100) store.tuningLog.pop();

  saveLearnedKnowledge(store, userId);
  return deltaRecord;
}

/**
 * Returns learned touchstone cards that match the profile or mechanics of the target card.
 */
export function getLearnedBenchmarkCandidates(
  targetCard: Card,
  userId?: string
): { card: Card; reason: string; priority: number }[] {
  const store = getAllLearnedKnowledge(userId);
  const targetProfileKey = getCardProfileKey(targetCard);
  const targetMechanics = new Set(extractMechanicsFromCard(targetCard));

  const candidates: { card: Card; reason: string; priority: number }[] = [];
  const seenNames = new Set<string>();

  // 1. Direct Profile Match
  Object.values(store.touchstones).forEach((ts) => {
    if (ts.profileKey === targetProfileKey) {
      if (!seenNames.has(ts.touchstoneCard.name.toLowerCase()) &&
          ts.touchstoneCard.name.toLowerCase() !== targetCard.name.toLowerCase()) {
        seenNames.add(ts.touchstoneCard.name.toLowerCase());
        candidates.push({
          card: ts.touchstoneCard,
          reason: `Learned touchstone from tuning ${ts.sourceCardName}${ts.sourceCardSet ? ` (${ts.sourceCardSet})` : ''}`,
          priority: 20 + Math.min(10, ts.selectionCount * 2),
        });
      }
    }
  });

  // 2. Mechanic Bridge Match
  Object.values(store.mechanicBridges).forEach((bridge) => {
    if (targetMechanics.has(bridge.sourceMechanic)) {
      // Find touchstones associated with this bridge
      Object.values(store.touchstones).forEach((ts) => {
        if (ts.touchstoneCard.name.toLowerCase() === bridge.targetCompName.toLowerCase()) {
          if (!seenNames.has(ts.touchstoneCard.name.toLowerCase()) &&
              ts.touchstoneCard.name.toLowerCase() !== targetCard.name.toLowerCase()) {
            seenNames.add(ts.touchstoneCard.name.toLowerCase());
            candidates.push({
              card: ts.touchstoneCard,
              reason: `Learned precedent: ${bridge.sourceMechanic} matches ${bridge.historicalTerms[0]} (from tuning ${bridge.sourceCardName})`,
              priority: 30 + Math.min(10, bridge.hitCount * 2),
            });
          }
        }
      });
    }
  });

  return candidates.sort((a, b) => b.priority - a.priority);
}

/**
 * Returns Scryfall query terms derived from learned mechanic bridges for a target card.
 */
export function getLearnedQueryExpansions(targetCard: Card, userId?: string): string[] {
  const store = getAllLearnedKnowledge(userId);
  const targetMechanics = extractMechanicsFromCard(targetCard);
  if (targetMechanics.length === 0) return [];

  const expansions: string[] = [];
  for (const m of targetMechanics) {
    const bridge = store.mechanicBridges[`bridge_${m}`];
    if (bridge && bridge.historicalTerms.length > 0) {
      // Format as Scryfall oracle search clause
      const oracleClause = bridge.historicalTerms
        .map(term => term.includes(' ') ? `o:"${term}"` : `o:${term}`)
        .join(' or ');
      expansions.push(`(${oracleClause})`);
    }
  }

  return expansions;
}

/**
 * Calculates any affinity score boost and explanation if candidate matches a learned touchstone.
 */
export function getLearnedPrecedentBoost(
  targetCard: Card,
  candidateCard: Card,
  userId?: string
): { boostScore: number; reason?: string } {
  const store = getAllLearnedKnowledge(userId);
  const candidateName = (candidateCard.name || '').toLowerCase();
  const targetProfileKey = getCardProfileKey(targetCard);
  const targetMechanics = new Set(extractMechanicsFromCard(targetCard));

  // Check mechanic bridges first (highest priority)
  for (const bridge of Object.values(store.mechanicBridges)) {
    if (targetMechanics.has(bridge.sourceMechanic) && bridge.targetCompName.toLowerCase() === candidateName) {
      return {
        boostScore: 18,
        reason: `Learned precedent: ${bridge.sourceMechanic} bridges to historical comp ${candidateCard.name} (from tuning ${bridge.sourceCardName})`,
      };
    }
  }

  // Check touchstones matching profile
  for (const ts of Object.values(store.touchstones)) {
    if (ts.touchstoneCard.name.toLowerCase() === candidateName && ts.profileKey === targetProfileKey) {
      return {
        boostScore: 12,
        reason: `Learned touchstone comp from tuning ${ts.sourceCardName}`,
      };
    }
  }

  return { boostScore: 0 };
}

/**
 * Exports all learned precedent knowledge as a portable JSON string.
 */
export function exportLearnedKnowledge(userId?: string): string {
  const store = getAllLearnedKnowledge(userId);
  return JSON.stringify(store, null, 2);
}

/**
 * Imports learned precedent knowledge from JSON.
 */
export function importLearnedKnowledge(jsonStr: string, userId?: string): boolean {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== 'object') return false;
    const store: PrecedentLearningStore = {
      touchstones: parsed.touchstones || {},
      mechanicBridges: parsed.mechanicBridges || {},
      tuningLog: Array.isArray(parsed.tuningLog) ? parsed.tuningLog : [],
    };
    saveLearnedKnowledge(store, userId);
    return true;
  } catch (err) {
    console.error('Failed to import learned knowledge:', err);
    return false;
  }
}
