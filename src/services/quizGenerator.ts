import { Card, QuestionCategory, QuizOption, QuizQuestion, QuizSettings, SeventeenLandsSetData } from '../types/mtg';
import { is17LandsEligibleForSet } from './seventeenLands';
import { getSetThreatCards } from './removalThreats';

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getRandomElements<T>(array: T[], count: number, excludePredicate?: (item: T) => boolean): T[] {
  const filtered = excludePredicate ? array.filter(item => !excludePredicate(item)) : array;
  return shuffle(filtered).slice(0, count);
}

/**
 * Intrinsic limited card power heuristic for draft picks when empirical 17Lands data is unavailable or ineligible (< 2 weeks old).
 */
function getIntrinsicCardPower(c: Card): number {
  let score = 50;
  if (c.rarity === 'mythic') score += 30;
  else if (c.rarity === 'rare') score += 20;
  else if (c.rarity === 'uncommon') score += 10;

  if (c.is_removal) score += 15;
  if ((c.type_line || '').toLowerCase().includes('planeswalker')) score += 20;

  // Good mana curve positioning (2-4 drops)
  if (c.cmc >= 2 && c.cmc <= 4) score += 5;
  else if (c.cmc > 6) score -= 5;

  return score;
}


// 1. Pack 1 Pick 1 (P1P1) Draft Priority Choice
function generateP1P1Question(
  cards: Card[],
  landsData: SeventeenLandsSetData | null,
  is17LandsEligible: boolean
): QuizQuestion | null {
  if (cards.length < 4) return null;

  // Pick distinct cards representing a draft pack
  const pool = [...cards];
  const sample = getRandomElements(pool, Math.min(12, pool.length));

  const sortedByPower = sample.sort((a, b) => {
    if (is17LandsEligible && landsData) {
      const wrA = landsData.cards?.[a.name]?.win_rate;
      const wrB = landsData.cards?.[b.name]?.win_rate;
      if (typeof wrA === 'number' && typeof wrB === 'number') {
        return wrB - wrA;
      }
    }
    // Strict intrinsic limited heuristic when 17Lands is ineligible or unreleased (< 2 weeks old)
    const scoreA = getIntrinsicCardPower(a);
    const scoreB = getIntrinsicCardPower(b);
    return scoreB - scoreA;
  });

  const bestCard = sortedByPower[0];
  const packChoices = sortedByPower.slice(0, 4);

  const options: QuizOption[] = shuffle(packChoices.map((c) => {
    const wr = is17LandsEligible ? landsData?.cards?.[c.name]?.win_rate : undefined;
    const wrText = typeof wr === 'number' ? ` (${(wr * 100).toFixed(1)}% GIH WR)` : '';
    const isBest = c.id === bestCard.id;
    return {
      id: c.id,
      label: `${c.name} ${c.mana_cost || ''}`,
      description: `${c.type_line} • ${c.rarity.toUpperCase()}${wrText}`,
      manaCost: c.mana_cost,
      isCorrect: isBest,
    };
  }));

  const rationale = (is17LandsEligible && landsData?.cards?.[bestCard.name]?.win_rate)
    ? `${bestCard.name} boasts a ${(landsData.cards[bestCard.name].win_rate * 100).toFixed(1)}% GIH Win Rate on 17Lands, making it the premier first pick in this pack.`
    : `${bestCard.name} (${bestCard.mana_cost || 'Cost N/A'}, ${bestCard.type_line}) is the premier P1P1 choice in this pack due to its raw card efficiency, removal/bomb status, and format-defining impact.`;

  return {
    id: `p1p1_${bestCard.id}_${Date.now()}_${Math.random()}`,
    category: 'p1p1_pick',
    type: 'multiple_choice',
    title: 'Pack 1, Pick 1 (P1P1) Draft Priority',
    prompt: `You open this booster pack in Draft. Which of these 4 cards is the optimal First Pick to maximize your win equity?`,
    tacticalContext: `In P1P1, prioritize flexible top-tier bombs and premium unconditional removal over narrow synergy pieces to stay open.`,
    card: bestCard,
    obfuscation: {
      target: 'none',
      style: 'blur',
    },
    options,
    correctAnswer: bestCard.id,
    explanation: rationale,
  };
}

// 2. 17Lands Trap vs Sleeper Identification
function generateTrapOrSleeperQuestion(
  cards: Card[],
  landsData: SeventeenLandsSetData | null,
  is17LandsEligible: boolean
): QuizQuestion | null {
  // If set is unreleased or < 2 weeks old, or lacks authentic 17Lands telemetry, return null immediately
  if (!is17LandsEligible || !landsData || cards.length < 2) return null;

  // Filter strictly to cards with authentic 17Lands telemetry
  const validCards = cards.filter((c) => {
    const d = landsData.cards?.[c.name];
    return d && (d.game_count || 0) > 0 && typeof d.win_rate === 'number' && typeof d.avg_seen === 'number';
  });
  if (validCards.length === 0) return null;

  // Find a card with notable difference between ALSA and GIH WR
  const candidates = validCards.filter((c) => {
    const data = landsData.cards[c.name];
    // Trap: ALSA < 4.0 but WR < 53.5%
    const isTrap = data.avg_seen <= 3.8 && data.win_rate < 0.535;
    // Sleeper: ALSA > 5.2 but WR >= 56.0%
    const isSleeper = data.avg_seen >= 5.2 && data.win_rate >= 0.560;
    return isTrap || isSleeper;
  });

  const target = candidates.length > 0
    ? candidates[Math.floor(Math.random() * candidates.length)]
    : validCards[Math.floor(Math.random() * validCards.length)];

  const data = landsData.cards[target.name];
  if (!data || typeof data.avg_seen !== 'number' || typeof data.win_rate !== 'number') {
    return null;
  }

  const isTrap = data.avg_seen <= 4.0 && data.win_rate < 0.54;
  const wrPercent = (data.win_rate * 100).toFixed(1);
  const alsaFormatted = data.avg_seen.toFixed(1);

  const options: QuizOption[] = [
    {
      id: 'trap',
      label: '⚠️ Draft Trap (Overrated by players: picked early, but underperforms in win rate)',
      isCorrect: isTrap,
    },
    {
      id: 'sleeper',
      label: '💎 Sleeper Gem (Undervalued: wheels late in packs, but boasts a high win rate)',
      isCorrect: !isTrap,
    },
  ];

  return {
    id: `trap_sleep_${target.id}_${Date.now()}_${Math.random()}`,
    category: 'trap_or_sleeper',
    type: 'multiple_choice',
    title: '17Lands Trap vs. Sleeper Detection',
    prompt: `17Lands Data: "${target.name}" is drafted on average at Pick ${alsaFormatted} (ALSA), with a ${wrPercent}% Games-In-Hand Win Rate. Is this card a Draft Trap or a Sleeper Gem?`,
    tacticalContext: `Identifying draft traps prevents wasting early picks on flashy cards that lose games, while finding sleeper gems rewards you on late pack wheels.`,
    card: target,
    obfuscation: {
      target: 'none',
      style: 'blur',
    },
    options,
    correctAnswer: isTrap ? 'trap' : 'sleeper',
    explanation: `"${target.name}" is a ${isTrap ? 'DRAFT TRAP' : 'SLEEPER GEM'}. It is taken at Pick ${alsaFormatted} with a ${wrPercent}% GIH Win Rate on 17Lands.`,
  };
}

// 3. Quadrant Theory: Stabilizer vs Stall-Breaker
function generateQuadrantQuestion(cards: Card[]): QuizQuestion | null {
  const removals = cards.filter(c => c.is_removal);
  const fliersOrBombs = cards.filter(c => (c.keywords || []).some(k => ['Flying', 'Menace', 'Trample'].includes(k)) || c.cmc >= 5);
  const fillers = cards.filter(c => !c.is_removal && c.cmc <= 2);

  if (removals.length === 0 || fliersOrBombs.length === 0 || fillers.length === 0) return null;

  const isBehindScenario = Math.random() > 0.5;

  if (isBehindScenario) {
    // Quadrant: When Behind
    const correctCard = removals[Math.floor(Math.random() * removals.length)];
    const wrong1 = fliersOrBombs[Math.floor(Math.random() * fliersOrBombs.length)];
    const wrong2 = fillers[Math.floor(Math.random() * fillers.length)];
    const wrong3 = cards.find(c => c.type_line.includes('Instant') && c.is_combat_trick) || cards[0];

    const options: QuizOption[] = shuffle([
      { id: correctCard.id, label: `${correctCard.name} (${correctCard.mana_cost})`, description: correctCard.oracle_text?.slice(0, 60) + '...', isCorrect: true },
      { id: wrong1.id, label: `${wrong1.name} (${wrong1.mana_cost})`, description: wrong1.oracle_text?.slice(0, 60) + '...', isCorrect: false },
      { id: wrong2.id, label: `${wrong2.name} (${wrong2.mana_cost})`, description: wrong2.oracle_text?.slice(0, 60) + '...', isCorrect: false },
      { id: wrong3.id, label: `${wrong3.name} (${wrong3.mana_cost})`, description: wrong3.oracle_text?.slice(0, 60) + '...', isCorrect: false },
    ]);

    return {
      id: `quad_behind_${correctCard.id}_${Date.now()}_${Math.random()}`,
      category: 'quadrant_role',
      type: 'multiple_choice',
      title: 'Quadrant Theory: Stabilization When Behind',
      prompt: `You are falling BEHIND on board against an aggressive curve-out. According to Quadrant Theory, which card provides the highest stabilization / turnaround equity?`,
      tacticalContext: `Cards that perform when 'Behind' prevent losses. Unconditional removal and defensive stabilizers swing games back into parity.`,
      card: correctCard,
      obfuscation: { target: 'none', style: 'blur' },
      options,
      correctAnswer: correctCard.id,
      explanation: `${correctCard.name} (${correctCard.mana_cost}) directly answers the opponent's biggest threat, stabilizing the board when you are behind.`,
    };
  } else {
    // Quadrant: At Parity (Stall-Breaker)
    const correctCard = fliersOrBombs[Math.floor(Math.random() * fliersOrBombs.length)];
    const distractors = getRandomElements(cards, 3, c => c.id === correctCard.id || c.keywords.includes('Flying'));

    const options: QuizOption[] = shuffle([
      { id: correctCard.id, label: `${correctCard.name} (${correctCard.mana_cost})`, description: correctCard.oracle_text?.slice(0, 60) + '...', isCorrect: true },
      ...distractors.map(d => ({ id: d.id, label: `${d.name} (${d.mana_cost})`, description: d.oracle_text?.slice(0, 60) + '...', isCorrect: false }))
    ]);

    return {
      id: `quad_parity_${correctCard.id}_${Date.now()}_${Math.random()}`,
      category: 'quadrant_role',
      type: 'multiple_choice',
      title: 'Quadrant Theory: Stall-Breakers at Parity',
      prompt: `Both players have clogged the ground with blockers and are stalled at PARITY. Which card is the premier Stall-Breaker to break the deadlock?`,
      tacticalContext: `At parity, ground beaters cannot attack profitably. Evasion (Flying/Menace) and repeatable card advantage break stalls and win games.`,
      card: correctCard,
      obfuscation: { target: 'none', style: 'blur' },
      options,
      correctAnswer: correctCard.id,
      explanation: `${correctCard.name} (${correctCard.mana_cost}) provides critical evasion/reach to attack past ground blockers when games stall at parity.`,
    };
  }
}

// 4. Combat Tricks & Open Mana Blowout Anticipation
function generateCombatTrickQuestion(cards: Card[], trickCards: Card[]): QuizQuestion | null {
  const pool = trickCards.length >= 2 ? trickCards : cards.filter(c => c.is_instant_speed);
  if (pool.length < 2) return null;

  const target = pool[Math.floor(Math.random() * pool.length)];
  const distractors = getRandomElements(cards, Math.min(3, cards.length - 1), c => c.id === target.id);
  const manaHint = target.mana_cost || 'Open Mana';

  const options: QuizOption[] = shuffle([
    { id: target.id, label: target.name, description: target.oracle_text?.slice(0, 75) + '...', manaCost: target.mana_cost, isCorrect: true },
    ...distractors.map(d => ({
      id: d.id,
      label: d.name,
      description: d.oracle_text?.slice(0, 75) + '...',
      manaCost: d.mana_cost,
      isCorrect: false,
    }))
  ]);

  return {
    id: `trick_${target.id}_${Date.now()}_${Math.random()}`,
    category: 'combat_tricks',
    type: 'multiple_choice',
    title: 'Combat Trick & Open Mana Anticipation',
    prompt: `Your opponent has ${manaHint} untapped during combat. Which of these instant-speed spells do you need to play around?`,
    tacticalContext: `In Limited, anticipating opponent's open mana before making attacks or blocks is the #1 skill separating intermediate players from trophy leaders.`,
    card: target,
    obfuscation: {
      target: 'name_and_cost',
      style: 'blur',
      customOverlayText: 'Combat Trick Concealed',
    },
    options,
    correctAnswer: target.id,
    explanation: `${target.name} costs ${target.mana_cost}. ${target.oracle_text || ''}`,
    manaFilterHint: target.mana_cost,
  };
}

// 5. Instant vs Sorcery Speed
function generateInstantSpeedQuestion(cards: Card[]): QuizQuestion | null {
  const spells = cards.filter(c => !c.is_creature && !c.is_land && (c.type_line.includes('Instant') || c.type_line.includes('Sorcery')));
  if (spells.length === 0) return null;

  const target = spells[Math.floor(Math.random() * spells.length)];
  const isInstant = target.type_line.toLowerCase().includes('instant');

  const options: QuizOption[] = [
    { id: 'instant', label: '⚡ Instant Speed (Can be cast on opponent\'s turn / during combat)', isCorrect: isInstant },
    { id: 'sorcery', label: '⏱️ Sorcery Speed (Main phase only, empty stack)', isCorrect: !isInstant },
  ];

  return {
    id: `speed_${target.id}_${Date.now()}_${Math.random()}`,
    category: 'instant_speed',
    type: 'multiple_choice',
    title: 'Speed & Cast Timing Verification',
    prompt: `Is "${target.name}" cast at Instant speed or Sorcery speed?`,
    tacticalContext: `Mistaking a sorcery for an instant can lose you an entire game when trying to interact in response to a pump spell or during opponent's end step.`,
    card: target,
    obfuscation: {
      target: 'type_line',
      style: 'blur',
      customOverlayText: 'Type Line Concealed',
    },
    options,
    correctAnswer: isInstant ? 'instant' : 'sorcery',
    explanation: `${target.name} is a ${target.type_line}. Cost: ${target.mana_cost}.`,
  };
}

// 6. Mana Cost, Curve & Splashability
function generateManaCostAndSplashQuestion(cards: Card[]): QuizQuestion | null {
  const pool = cards.filter(c => c.mana_cost && c.mana_cost.length > 0);
  if (pool.length < 2) return null;

  const isSplashQuestion = Math.random() > 0.5;

  if (isSplashQuestion) {
    const target = pool[Math.floor(Math.random() * pool.length)];
    // Check if card has double colored pips e.g. {G}{G}, {U}{U}, {W}{W}
    const manaStr = target.mana_cost || '';
    const colorMatches = (manaStr.match(/[WUBRG]/g) || []) as string[];
    const hasDoublePips = colorMatches.some((color: string, idx: number) => colorMatches.indexOf(color) !== idx);

    const isSplashable = !hasDoublePips && target.cmc >= 3;

    const options: QuizOption[] = [
      {
        id: 'yes_splash',
        label: `✅ Splashable: Single colored pip is easily supported with 3 splash mana sources`,
        isCorrect: isSplashable,
      },
      {
        id: 'no_splash',
        label: `❌ Not Splashable: Double colored pips or cheap curve card requiring heavy mana base commitment`,
        isCorrect: !isSplashable,
      },
    ];

    return {
      id: `splash_${target.id}_${Date.now()}_${Math.random()}`,
      category: 'mana_cost_and_splash',
      type: 'multiple_choice',
      title: 'Mana Base Math & Splashability Rule',
      prompt: `In Limited 2-color draft deckbuilding, is "${target.name}" (${target.mana_cost}) safely splashable as a 3rd color?`,
      tacticalContext: `Frank Karsten's rule of splashing: Never splash double-pip cards ({C}{C}) or early 1-2 drops. Only splash high-impact single-pip cards with 3+ mana sources.`,
      card: target,
      obfuscation: { target: 'none', style: 'blur' },
      options,
      correctAnswer: isSplashable ? 'yes_splash' : 'no_splash',
      explanation: `${target.name} costs ${target.mana_cost}. It is ${isSplashable ? 'SAFE' : 'NOT SAFE'} to splash because ${hasDoublePips ? 'double colored pips require 7+ sources' : target.cmc <= 2 ? 'early 2-drops must be played on turn 2' : 'single colored pip is easily enabled with 3 sources'}.`,
    };
  } else {
    // Exact Mana Cost Recall
    const target = pool[Math.floor(Math.random() * pool.length)];
    const similarDistractors = cards.filter(c => c.id !== target.id && c.mana_cost && c.mana_cost !== target.mana_cost);
    const picked = getRandomElements(similarDistractors, Math.min(3, similarDistractors.length));

    const options: QuizOption[] = shuffle([
      { id: target.mana_cost || '{1}', label: target.mana_cost || '', isCorrect: true },
      ...picked.map(d => ({ id: d.mana_cost || '{2}', label: d.mana_cost || '', isCorrect: false }))
    ]);

    return {
      id: `cost_${target.id}_${Date.now()}_${Math.random()}`,
      category: 'mana_cost_and_splash',
      type: 'multiple_choice',
      title: 'Exact Mana Cost & Curve Memorization',
      prompt: `What is the exact casting cost of "${target.name}"?`,
      tacticalContext: `Knowing exact casting costs allows you to calculate double-spelling opportunities and curve efficiency.`,
      card: target,
      obfuscation: {
        target: 'mana_cost',
        style: 'blur',
        customOverlayText: 'Mana Cost Concealed',
      },
      options,
      correctAnswer: target.mana_cost || '',
      explanation: `${target.name} costs exactly ${target.mana_cost} (CMC ${target.cmc}).`,
    };
  }
}

// 7. Power / Toughness & Combat Math
function generatePowerToughnessQuestion(cards: Card[]): QuizQuestion | null {
  const creatures = cards.filter(c => c.power !== undefined && c.toughness !== undefined && !c.power.includes('*'));
  if (creatures.length < 1) return null;

  const target = creatures[Math.floor(Math.random() * creatures.length)];
  const correctPT = `${target.power}/${target.toughness}`;

  const p = parseInt(target.power || '2') || 2;
  const t = parseInt(target.toughness || '2') || 2;

  const variations = [
    `${p + 1}/${t}`,
    `${p}/${t + 1}`,
    `${Math.max(1, p - 1)}/${t}`,
    `${p}/${Math.max(1, t - 1)}`,
    `${t}/${p}`,
  ];

  const dummySet = new Set<string>();
  for (const v of variations) {
    if (v !== correctPT) dummySet.add(v);
    if (dummySet.size >= 3) break;
  }

  const options: QuizOption[] = shuffle([
    { id: correctPT, label: `${correctPT} (Power / Toughness)`, isCorrect: true },
    ...Array.from(dummySet).map(pt => ({ id: pt, label: `${pt} (Power / Toughness)`, isCorrect: false }))
  ]);

  return {
    id: `pt_${target.id}_${Date.now()}_${Math.random()}`,
    category: 'power_toughness',
    type: 'multiple_choice',
    title: 'Base Power & Toughness Combat Sizing',
    prompt: `What are the base Power and Toughness of "${target.name}"?`,
    tacticalContext: `Remembering creature stat lines is critical when planning attacks through blockers or sequencing burn spells (e.g. knowing if Shock kills it).`,
    card: target,
    obfuscation: {
      target: 'power_toughness',
      style: 'whiteout',
      customOverlayText: '? / ?',
    },
    options,
    correctAnswer: correctPT,
    explanation: `${target.name} is a ${correctPT} ${target.type_line}.`,
  };
}

// 8. Archetype Engine & Synergy Mechanic
const ARCHETYPE_STRATEGIES: Record<string, string> = {
  'Azorius (White/Blue)': '🪽 Fliers, Blink & Draw-Go Tempo',
  'Dimir (Blue/Black)': '👁️ Flashback, Saboteur & Graveyard Threshold',
  'Rakdos (Black/Red)': '💀 Sacrifice, Noncombat Damage & Aggro',
  'Gruul (Red/Green)': '🦖 4+ Power Stompy & Trample Beatdown',
  'Selesnya (Green/White)': '🌿 Go-Wide Tokens, Mounts & +1/+1 Counters',
  'Orzhov (White/Black)': '⚖️ Bleed, Life Gain/Loss & Aristocrats',
  'Izzet (Blue/Red)': '⚡ Instant & Sorcery Spellslinger / Velocity',
  'Golgari (Black/Green)': '🍄 Graveyard Recursion, Delirium & Pests',
  'Boros (Red/White)': '⚔️ Aggro Attack Triggers, Equipment & Valiant',
  'Simic (Green/Blue)': '🌀 5+ Mana Value Big Spells & Ramp',
};

function generateArchetypeEngineQuestion(cards: Card[]): QuizQuestion | null {
  const signposts = cards.filter(c => c.archetype_tag || (c.colors && c.colors.length === 2 && c.rarity === 'uncommon'));
  if (signposts.length === 0) return null;

  const target = signposts[Math.floor(Math.random() * signposts.length)];
  const correctArchetype = target.archetype_tag || target.colors.join('/') + ' Archetype';
  const correctStrategy = ARCHETYPE_STRATEGIES[correctArchetype] || 'Draft Synergy Engine';

  const otherStrategies = Object.values(ARCHETYPE_STRATEGIES).filter(s => s !== correctStrategy);
  const dummyStrategies = getRandomElements(otherStrategies, 3);

  const options: QuizOption[] = shuffle([
    { id: correctStrategy, label: correctStrategy, isCorrect: true },
    ...dummyStrategies.map(s => ({ id: s, label: s, isCorrect: false }))
  ]);

  return {
    id: `arch_engine_${target.id}_${Date.now()}_${Math.random()}`,
    category: 'archetype_engine',
    type: 'multiple_choice',
    title: 'Draft Archetype Engine & Strategy Payoff',
    prompt: `What core mechanical strategy / draft archetype engine does "${target.name}" anchor in Limited?`,
    tacticalContext: `Knowing each archetype's mechanical engine allows you to draft matching enablers and payoffs.`,
    card: target,
    obfuscation: {
      target: 'oracle_text',
      style: 'blur',
      customOverlayText: 'Synergy Engine Concealed',
    },
    options,
    correctAnswer: correctStrategy,
    explanation: `"${target.name}" (${correctArchetype}) anchors the strategy: "${correctStrategy}". Rules text: ${target.oracle_text || ''}`,
  };
}

// 9. 17Lands Head-to-Head Win Rate Comparison
function generateCardEvaluationQuestion(
  cards: Card[],
  landsData: SeventeenLandsSetData | null,
  is17LandsEligible: boolean
): QuizQuestion | null {
  // If set is unreleased or < 2 weeks old, or lacks authentic 17Lands telemetry, return null immediately
  if (!is17LandsEligible || !landsData || cards.length < 2) return null;

  // Filter strictly to cards with authentic 17Lands telemetry
  const validCards = cards.filter((c) => {
    const d = landsData.cards?.[c.name];
    return d && (d.game_count || 0) > 0 && typeof d.win_rate === 'number';
  });
  if (validCards.length < 2) return null;

  const sample = getRandomElements(validCards, Math.min(12, validCards.length));
  let cardA: Card | null = null;
  let cardB: Card | null = null;
  let ratingA = 0;
  let ratingB = 0;

  for (let i = 0; i < sample.length; i++) {
    for (let j = i + 1; j < sample.length; j++) {
      const c1 = sample[i];
      const c2 = sample[j];
      const r1 = landsData.cards[c1.name]?.win_rate;
      const r2 = landsData.cards[c2.name]?.win_rate;

      if (typeof r1 === 'number' && typeof r2 === 'number' && Math.abs(r1 - r2) >= 0.02) {
        cardA = c1;
        cardB = c2;
        ratingA = r1;
        ratingB = r2;
        break;
      }
    }
    if (cardA && cardB) break;
  }

  if (!cardA || !cardB) return null;

  const aIsBetter = ratingA >= ratingB;
  const bestCard = aIsBetter ? cardA : cardB;
  const wrA = (ratingA * 100).toFixed(1);
  const wrB = (ratingB * 100).toFixed(1);

  const options: QuizOption[] = [
    { id: cardA.id, label: cardA.name, manaCost: cardA.mana_cost, isCorrect: aIsBetter },
    { id: cardB.id, label: cardB.name, manaCost: cardB.mana_cost, isCorrect: !aIsBetter },
  ];

  return {
    id: `eval_${cardA.id}_${cardB.id}_${Date.now()}_${Math.random()}`,
    category: 'card_evaluation',
    type: 'head_to_head',
    title: '17Lands Head-to-Head Card Power Duel',
    prompt: `Between these two cards in Limited, which one achieves a higher Game-In-Hand Win Rate (GIH WR) according to 17Lands?`,
    tacticalContext: `Comparing perceived card power against 17Lands win rates helps identify overhyped cards.`,
    card: cardA,
    comparisonCard: cardB,
    obfuscation: {
      target: 'none',
      style: 'blur',
    },
    options,
    correctAnswer: bestCard.id,
    explanation: `${bestCard.name} has a ${aIsBetter ? wrA : wrB}% GIH Win Rate on 17Lands, whereas ${!aIsBetter ? cardA.name : cardB.name} sits at ${!aIsBetter ? wrA : wrB}%.`,
  };
}

// 10. Removal to Play Around (Open Mana & Threat Recognition)
function generateRemovalToPlayAroundQuestion(cards: Card[]): QuizQuestion | null {
  const threats = getSetThreatCards(cards);
  if (threats.length === 0) return null;

  // Filter for removal/interaction spells
  const removalThreats = threats.filter((t) =>
    t.card.is_removal ||
    t.classification.mechanism === 'Burn' ||
    t.classification.mechanism === 'Destroy' ||
    t.classification.mechanism === 'Exile' ||
    t.classification.mechanism === '-N/-N' ||
    t.classification.mechanism === 'Fight/Bite' ||
    t.classification.mechanism === 'Bounce' ||
    t.classification.mechanism === 'Counterspell' ||
    t.classification.mechanism === 'Pacifism' ||
    t.classification.mechanism === 'Sweeper'
  );

  const pool = removalThreats.length > 0 ? removalThreats : threats;
  const instantThreats = pool.filter((t) => t.classification.isInstantOrFlash);

  // 60% of the time, drill Open Mana Instant-Speed Blowout Anticipation if instant threats exist
  if (instantThreats.length >= 1 && Math.random() < 0.6) {
    const target = instantThreats[Math.floor(Math.random() * instantThreats.length)];
    const manaHint = target.card.mana_cost || 'Open Mana';

    // Distractors: prefer sorcery-speed removal in the set or cards with higher CMC / different color
    const otherCards = cards.filter((c) => c.id !== target.card.id);
    const sorceryRemoval = otherCards.filter((c) =>
      c.type_line?.toLowerCase().includes('sorcery') && (c.is_removal || c.oracle_text?.toLowerCase().includes('destroy') || c.oracle_text?.toLowerCase().includes('damage'))
    );
    const distractorCandidates = sorceryRemoval.length >= 2 ? sorceryRemoval : otherCards;
    const distractors = getRandomElements(distractorCandidates, Math.min(3, otherCards.length));

    const options: QuizOption[] = shuffle([
      {
        id: target.card.id,
        label: `${target.card.name} ${target.card.mana_cost || ''}`,
        description: `⚡ Instant: ${target.classification.shortSummary}`,
        manaCost: target.card.mana_cost,
        isCorrect: true,
      },
      ...distractors.map((d) => ({
        id: d.id,
        label: `${d.name} ${d.mana_cost || ''}`,
        description: `${d.type_line?.includes('Sorcery') ? '⏱️ Sorcery: ' : ''}${d.oracle_text?.slice(0, 60) || ''}...`,
        manaCost: d.mana_cost,
        isCorrect: false,
      })),
    ]);

    return {
      id: `removal_blowout_${target.card.id}_${Date.now()}_${Math.random()}`,
      category: 'removal_to_play_around',
      type: 'multiple_choice',
      title: 'Removal to Play Around (Open Mana Threat)',
      prompt: `Your opponent passes the turn with ${manaHint} untapped as you declare your attack. Which instant-speed removal spell can blow you out?`,
      tacticalContext: `Walking your creatures or combat tricks directly into opponent open mana is the #1 way to lose games in Limited. Always identify what instant removal is live.`,
      card: target.card,
      obfuscation: {
        target: 'name_and_cost',
        style: 'blur',
        customOverlayText: 'Removal Threat Concealed',
      },
      options,
      correctAnswer: target.card.id,
      explanation: `${target.card.name} costs ${target.card.mana_cost} and is an Instant (${target.classification.shortSummary}). Running into it without a plan or protection gives opponent a massive 2-for-1 blowout.`,
      manaFilterHint: target.card.mana_cost,
    };
  }

  // 40% of the time, drill Timing & Speed: Is this card Instant or Sorcery speed?
  const target = pool[Math.floor(Math.random() * pool.length)];
  const isInstant = target.classification.isInstantOrFlash;

  const options: QuizOption[] = [
    {
      id: 'instant',
      label: '⚡ Instant Speed (Can be cast on your turn / during combat to disrupt attacks)',
      isCorrect: isInstant,
    },
    {
      id: 'sorcery',
      label: '⏱️ Sorcery Speed (Only castable on opponent’s own main phase, cannot disrupt combat)',
      isCorrect: !isInstant,
    },
  ];

  return {
    id: `removal_speed_${target.card.id}_${Date.now()}_${Math.random()}`,
    category: 'removal_to_play_around',
    type: 'multiple_choice',
    title: 'Removal to Play Around (Speed & Timing)',
    prompt: `Opponent has "${target.card.name}" (${target.card.mana_cost || 'N/A'}) in hand with untapped lands. Can they cast this on YOUR turn to disrupt your attacks, or is it Sorcery speed?`,
    tacticalContext: `Knowing whether removal is Instant vs. Sorcery dictates whether you can safely attack, play pump spells, or develop your board with confidence.`,
    card: target.card,
    obfuscation: {
      target: 'type_line',
      style: 'blur',
      customOverlayText: 'Card Speed Concealed',
    },
    options,
    correctAnswer: isInstant ? 'instant' : 'sorcery',
    explanation: `${target.card.name} is a ${target.card.type_line} (${target.card.mana_cost || ''}). ${target.classification.shortSummary}. ${
      isInstant
        ? 'Because it is Instant speed, you must play around it during combat.'
        : 'Because it is Sorcery speed, you do NOT have to worry about it blowing you out mid-combat.'
    }`,
  };
}

export function generateQuiz(
  allCards: Card[],
  settings: QuizSettings,
  landsData: SeventeenLandsSetData | null,
  missedCardIds?: Set<string>,
  fallbackReleasedAt?: string
): QuizQuestion[] {
  const setCodeUpper = settings.setCode.toUpperCase();

  // Strict Set Isolation Guarantee
  let cardPool = allCards.filter(c => c.set.toUpperCase() === setCodeUpper);
  if (cardPool.length === 0) {
    cardPool = [...allCards];
  }

  if (settings.rarities && settings.rarities.length > 0) {
    const rarityFiltered = cardPool.filter(c => settings.rarities.includes(c.rarity));
    if (rarityFiltered.length > 0) {
      cardPool = rarityFiltered;
    }
  }

  if (settings.onlyMissedCards && missedCardIds && missedCardIds.size > 0) {
    const filteredMissed = cardPool.filter(c => missedCardIds.has(`${c.set}_${c.id}`));
    if (filteredMissed.length >= 2) {
      cardPool = filteredMissed;
    }
  }

  // Strict 17Lands Maturity Check (< 2 weeks since release or unreleased = strictly ineligible)
  const effectiveReleasedAt = settings.releasedAt || fallbackReleasedAt;
  const is17LandsEligible = is17LandsEligibleForSet(effectiveReleasedAt, landsData, settings.setCode, cardPool);

  const trickCards = cardPool.filter(c => c.is_combat_trick);

  const generators: Record<QuestionCategory, () => QuizQuestion | null> = {
    p1p1_pick: () => generateP1P1Question(cardPool, landsData, is17LandsEligible),
    trap_or_sleeper: () => generateTrapOrSleeperQuestion(cardPool, landsData, is17LandsEligible),
    quadrant_role: () => generateQuadrantQuestion(cardPool),
    combat_tricks: () => generateCombatTrickQuestion(cardPool, trickCards),
    instant_speed: () => generateInstantSpeedQuestion(cardPool),
    mana_cost_and_splash: () => generateManaCostAndSplashQuestion(cardPool),
    power_toughness: () => generatePowerToughnessQuestion(cardPool),
    archetype_engine: () => generateArchetypeEngineQuestion(cardPool),
    removal_to_play_around: () => generateRemovalToPlayAroundQuestion(cardPool),
    card_evaluation: () => generateCardEvaluationQuestion(cardPool, landsData, is17LandsEligible),
  };

  const rawSelectedCategories = settings.categories.length > 0
    ? settings.categories
    : (Object.keys(generators) as QuestionCategory[]);

  // Strict exclusion of 17Lands categories when ineligible (< 2 weeks old, unreleased, or no authentic data)
  const selectedCategories = rawSelectedCategories.filter((cat) => {
    if (!is17LandsEligible && (cat === 'trap_or_sleeper' || cat === 'card_evaluation')) {
      return false;
    }
    return true;
  });

  const activeCategories = selectedCategories.length > 0
    ? selectedCategories
    : (['p1p1_pick', 'combat_tricks', 'instant_speed', 'quadrant_role', 'removal_to_play_around'] as QuestionCategory[]);

  const questions: QuizQuestion[] = [];
  const targetCount = settings.questionCount > 0 ? settings.questionCount : Math.min(30, cardPool.length);

  let attempts = 0;
  while (questions.length < targetCount && attempts < targetCount * 8) {
    attempts++;
    const cat = activeCategories[Math.floor(Math.random() * activeCategories.length)];
    const gen = generators[cat];
    if (gen) {
      const q = gen();
      if (q && !questions.some(existing => existing.card.id === q.card.id && existing.category === q.category)) {
        questions.push(q);
      }
    }
  }

  return questions;
}
