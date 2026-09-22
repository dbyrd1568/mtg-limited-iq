import { Card, GradeTier, MTGColor, MTGRarity } from '../types/mtg';
import { normalizeScryfallCard, POPULAR_LIMITED_SETS } from './scryfall';
import { fetch17LandsSetData, winRateToGradeTier, gradeTierToIndex, indexToGradeTier, GRADE_SCORES, scoreToGradeTier, getOrEstimate17LandsCardRating } from './seventeenLands';
import { getLearnedBenchmarkCandidates, getLearnedQueryExpansions, getLearnedPrecedentBoost } from './precedentLearning';

const SCRYFALL_API_BASE = 'https://api.scryfall.com';

// Benchmark modern premier booster draft sets with rich 17Lands sample sizes (released sets only)
export const COMPARABLE_PREMIER_SETS = [
  'FIN', 'ECL', 'TDM', 'EOE', 'TLA', 'TMT', 'SOS', 'MSH', 'DFT', 'FDN', 'DSK', 'BLB', 'MH3', 'OTJ', 'MKM', 'LCI', 'WOE', 'LTR', 'MOM', 'ONE', 'BRO', 'DMU', 'SNC', 'NEO', 'VOW', 'MID', 'AFR', 'STX', 'KHM', 'ZNR', 'IKO', 'THB', 'ELD', 'M21', 'M20', 'WAR'
];

export interface SimilarCardMatch {
  card: Card;
  similarityScore: number; // 0 to 100%
  matchReasons: string[];
  winRate?: number;
  alsa?: number;
  tierGrade?: GradeTier;
  isCustomOverride?: boolean;
  originalCardName?: string;
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

/**
 * Synchronous lookup in similarity cache to prevent flicker/flashing in UI
 */
export function getCachedSimilarCards(targetCard: Card | null | undefined): CardSimilarityResult | null {
  if (!targetCard || !targetCard.name || !targetCard.set) return null;
  const cacheKey = `${targetCard.set.toUpperCase()}_${targetCard.name.toUpperCase()}_v68`;
  if (similarityCache.has(cacheKey)) {
    const cached = similarityCache.get(cacheKey)!;
    if (cached && cached.matches && cached.matches.length >= 2) {
      return cached;
    }
  }
  return null;
}

function createBenchmarkCard(
  name: string,
  set: string,
  mana_cost: string,
  cmc: number,
  type_line: string,
  oracle_text: string,
  colors: MTGColor[],
  power?: string,
  toughness?: string,
  rarity: MTGRarity = 'common',
  keywords: string[] = []
): Card {
  return {
    id: `bench_${set.toLowerCase()}_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    name,
    set: set.toUpperCase(),
    set_name: set.toUpperCase(),
    collector_number: '1',
    mana_cost,
    cmc,
    type_line,
    oracle_text,
    power,
    toughness,
    colors,
    color_identity: colors,
    rarity,
    keywords,
    image_uris: {
      small: `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=small`,
      normal: `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=normal`,
      large: `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=large`,
      art_crop: `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=art_crop`,
      png: `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=png`,
    },
  };
}

export const HISTORICAL_BENCHMARK_CARDS: Card[] = [
  // White
  createBenchmarkCard('Novice Inspector', 'MKM', '{W}', 1, 'Creature — Human Detective', 'When Novice Inspector enters the battlefield, investigate.', ['W'], '1', '2'),
  createBenchmarkCard('Lifecreed Duo', 'BLB', '{1}{W}', 2, 'Creature — Bird Mouse', 'Flying. Whenever another creature enters the battlefield under your control, you gain 1 life.', ['W'], '1', '2', 'common', ['Flying']),
  createBenchmarkCard("Raffine's Informant", 'SNC', '{1}{W}', 2, 'Creature — Human Wizard', "When Raffine's Informant enters the battlefield, it connives.", ['W'], '2', '1'),
  createBenchmarkCard('Ossification', 'ONE', '{1}{W}', 2, 'Enchantment — Aura', 'Enchant basic land you control. When Ossification enters the battlefield, exile target creature or planeswalker an opponent controls until Ossification leaves the battlefield.', ['W']),
  createBenchmarkCard('Holy Cow', 'OTJ', '{2}{W}', 3, 'Creature — Ox Angel', 'Flash, flying. When Holy Cow enters the battlefield, you gain 2 life and scry 1.', ['W'], '2', '2', 'common', ['Flash', 'Flying']),
  createBenchmarkCard('Destroy Evil', 'DMU', '{1}{W}', 2, 'Instant', 'Choose one —\n• Destroy target creature with toughness 4 or greater.\n• Destroy target enchantment.', ['W'], undefined, undefined, 'common'),
  createBenchmarkCard('Valorous Stance', 'VOW', '{1}{W}', 2, 'Instant', 'Choose one —\n• Target creature gains indestructible until end of turn.\n• Destroy target creature with toughness 4 or greater.', ['W'], undefined, undefined, 'uncommon'),
  createBenchmarkCard('Repel Calamity', 'BLB', '{1}{W}', 2, 'Instant', 'Destroy target creature with power or toughness 4 or greater.', ['W'], undefined, undefined, 'uncommon'),
  createBenchmarkCard('Gallant Strike', 'DFT', '{1}{W}', 2, 'Instant', 'Destroy target creature with toughness 4 or greater.', ['W'], undefined, undefined, 'common'),
  createBenchmarkCard('Bovine Intervention', 'OTJ', '{1}{W}', 2, 'Instant', 'Destroy target artifact or creature. Its controller creates a 2/2 white Ox creature token.', ['W'], undefined, undefined, 'uncommon'),
  createBenchmarkCard('Make Your Move', 'MKM', '{2}{W}', 3, 'Instant', 'Destroy target artifact, enchantment, or creature with power 4 or greater.', ['W']),
  createBenchmarkCard('Oltec Cloud Guard', 'LCI', '{3}{W}', 4, 'Creature — Human Soldier', 'Flying. When Oltec Cloud Guard enters the battlefield, create a 1/1 colorless Gnome artifact creature token.', ['W'], '3', '2', 'common', ['Flying']),
  createBenchmarkCard('Head of the Homestead', 'BLB', '{3}{W}', 4, 'Creature — Rabbit Citizen', 'When Head of the Homestead enters the battlefield, create two 1/1 white Rabbit creature tokens.', ['W'], '2', '2'),
  createBenchmarkCard('Warren Warleader', 'BLB', '{2}{W}{W}', 4, 'Creature — Rabbit Knight', 'Offspring {2}. Whenever you attack, choose one — Create a 1/1 white Rabbit; or attacking creatures get +1/+1 until end of turn.', ['W'], '4', '4', 'rare'),
  createBenchmarkCard('Auspicious Arrival', 'MKM', '{1}{W}', 2, 'Instant', 'Target creature gets +2/+2 until end of turn. Investigate.', ['W'], undefined, undefined, 'common'),
  createBenchmarkCard('Hop to It', 'BLB', '{2}{W}', 3, 'Sorcery', 'Create three 1/1 white Rabbit creature tokens.', ['W'], undefined, undefined, 'uncommon'),
  createBenchmarkCard('Rally for the Throne', 'ELD', '{2}{W}', 3, 'Instant', 'Create two 1/1 white Human creature tokens. Adamant — If at least three white mana was spent to cast this spell, you gain 1 life for each creature you control.', ['W'], undefined, undefined, 'common'),
  createBenchmarkCard('Raise the Alarm', 'M20', '{1}{W}', 2, 'Instant', 'Create two 1/1 white Soldier creature tokens.', ['W'], undefined, undefined, 'common'),
  createBenchmarkCard('Call the Cavalry', 'DOM', '{3}{W}', 4, 'Sorcery', 'Create two 2/2 white Knight creature tokens with vigilance.', ['W'], undefined, undefined, 'common'),
  createBenchmarkCard('Join the Dance', 'MID', '{G}{W}', 2, 'Sorcery', 'Create two 1/1 white Human creature tokens. Flashback {3}{G}{W}', ['G', 'W'], undefined, undefined, 'common'),
  createBenchmarkCard('Griffin Aerie', 'M21', '{1}{W}', 2, 'Enchantment', 'At the beginning of your end step, if you gained 3 or more life this turn, create a 2/2 white Griffin creature token with flying.', ['W'], undefined, undefined, 'uncommon'),
  createBenchmarkCard('Depopulate', 'SNC', '{2}{W}{W}', 4, 'Sorcery', 'Each player who controls a multicolored creature draws a card. Destroy all creatures.', ['W'], undefined, undefined, 'rare'),
  createBenchmarkCard('The Battle of Bywater', 'LTR', '{1}{W}{W}', 3, 'Sorcery', 'Destroy all creatures with power 3 or greater. Then create a Food token for each creature you control.', ['W'], undefined, undefined, 'rare'),
  createBenchmarkCard('Sunfall', 'MOM', '{3}{W}{W}', 5, 'Sorcery', 'Exile all creatures. Incubate X, where X is the number of creatures exiled this way.', ['W'], undefined, undefined, 'rare'),
  createBenchmarkCard('Imperial Oath', 'NEO', '{5}{W}', 6, 'Sorcery', 'Create three 2/2 white Samurai creature tokens with vigilance. Scry 3.', ['W'], undefined, undefined, 'common'),
  createBenchmarkCard('Hero in Training', 'MSC', '{2}{W}', 3, 'Creature — Human Hero', 'When Hero in Training enters the battlefield, draw a card. If you control another Hero, you gain 2 life.', ['W'], '2', '2', 'common'),
  createBenchmarkCard('Stone Docent', 'SOS', '{1}{W}', 2, 'Creature — Spirit Chimera', '{W}, Exile this card from your graveyard: You gain 2 life. Surveil 1.', ['W'], '3', '1', 'common'),
  createBenchmarkCard('Star Pupil', 'STX', '{W}', 1, 'Creature — Human Wizard', 'Star Pupil enters the battlefield with a +1/+1 counter on it. When Star Pupil dies, put its counters on target creature you control.', ['W'], '0', '0', 'common'),
  createBenchmarkCard('Mikaeus, the Lunarch', 'ISD', '{X}{W}', 1, 'Legendary Creature — Human Cleric', 'Mikaeus, the Lunarch enters the battlefield with X +1/+1 counters on it.\n{T}: Put a +1/+1 counter on Mikaeus.\n{T}, Remove a +1/+1 counter from Mikaeus: Put a +1/+1 counter on each other creature you control.', ['W'], '0', '0', 'mythic'),
  createBenchmarkCard('Luminarch Aspirant', 'ZNR', '{1}{W}', 2, 'Creature — Human Cleric', 'At the beginning of combat on your turn, put a +1/+1 counter on target creature you control.', ['W'], '1', '1', 'rare'),
  createBenchmarkCard('Siege Veteran', 'BRO', '{2}{W}', 3, 'Creature — Human Soldier', 'At the beginning of combat on your turn, put a +1/+1 counter on target creature you control.\nWhenever another nontoken Soldier you control dies, create a 1/1 colorless Soldier artifact creature token.', ['W'], '2', '2', 'rare'),
  createBenchmarkCard('Shalai, Voice of Plenty', 'DOM', '{3}{W}', 4, 'Legendary Creature — Angel', 'Flying\nYou, planeswalkers you control, and other creatures you control have hexproof.\n{4}{G}{G}: Put a +1/+1 counter on each creature you control.', ['W'], '3', '4', 'rare', ['Flying']),

  // Blue
  createBenchmarkCard('Consider', 'MID', '{U}', 1, 'Instant', 'Surveil 1. Draw a card.', ['U']),
  createBenchmarkCard('Shore Up', 'BLB', '{U}', 1, 'Instant', 'Target creature you control gets +1/+1 and gains hexproof until end of turn. Untap it.', ['U']),
  createBenchmarkCard('Into the Flood Maw', 'BLB', '{U}', 1, 'Instant', "Gift a tapped Fish. Return target nonland permanent an opponent controls to its owner's hand.", ['U'], undefined, undefined, 'uncommon'),
  createBenchmarkCard("Long River's Pull", 'BLB', '{U}{U}', 2, 'Instant', 'Gift a card. Counter target creature spell. If the gift was promised, counter target spell instead.', ['U'], undefined, undefined, 'uncommon'),
  createBenchmarkCard("Saruman's Trickery", 'LTR', '{1}{U}{U}', 3, 'Instant', 'Counter target spell. Amass Orcs 1.', ['U'], undefined, undefined, 'uncommon'),
  createBenchmarkCard('Falcon Abomination', 'MID', '{2}{U}', 3, 'Creature — Zombie Bird', 'Flying. When Falcon Abomination enters the battlefield, create a 2/2 black Zombie creature token with decayed.', ['U'], '2', '2', 'common', ['Flying']),
  createBenchmarkCard('Waterwind Scout', 'LCI', '{2}{U}', 3, 'Creature — Merfolk Scout', 'Flying. When Waterwind Scout enters the battlefield, create a Map token.', ['U'], '2', '2', 'common', ['Flying']),
  createBenchmarkCard('Organ Hoarder', 'MID', '{3}{U}', 4, 'Creature — Zombie', 'When Organ Hoarder enters the battlefield, look at the top three cards of your library. Put one of them into your hand and the rest into your graveyard.', ['U'], '3', '2'),
  createBenchmarkCard('Ancestral Reminiscence', 'LCI', '{3}{U}', 4, 'Sorcery', 'Draw three cards, then discard a card.', ['U'], undefined, undefined, 'common'),
  createBenchmarkCard('Daring Waverider', 'BLB', '{4}{U}{U}', 6, 'Creature — Otter Wizard', 'When Daring Waverider enters the battlefield, you may cast target instant or sorcery card from your graveyard without paying its mana cost.', ['U'], '4', '4', 'uncommon'),
  createBenchmarkCard('Desynchronize', 'BRO', '{4}{U}', 5, 'Instant', "Target nonland permanent's owner puts it on their choice of the top or bottom of their library. Scry 2.", ['U'], undefined, undefined, 'common', ['Scry']),
  createBenchmarkCard('Dire Downdraft', 'BLB', '{3}{U}', 4, 'Instant', "This spell costs {1} less to cast if it targets an attacking or tapped creature.\nTarget creature's owner puts it on their choice of the top or bottom of their library.", ['U'], undefined, undefined, 'common'),
  createBenchmarkCard('Run Aground', 'XLN', '{3}{U}', 4, 'Instant', "Put target artifact or creature on top of its owner's library.", ['U'], undefined, undefined, 'common'),
  createBenchmarkCard('Cruel Witness', 'VOW', '{2}{U}{U}', 4, 'Creature — Bird Horror', "Flying\nWhenever you cast a noncreature spell, surveil 1.", ['U'], '3', '3', 'common', ['Flying', 'Surveil']),
  createBenchmarkCard('Out of Sight', 'MH3', '{3}{U}', 4, 'Instant', "Put target nonland permanent into its owner's library third from the top.", ['U'], undefined, undefined, 'uncommon'),

  // Black
  createBenchmarkCard('Eaten Alive', 'MID', '{B}', 1, 'Sorcery', 'As an additional cost to cast this spell, sacrifice a creature or pay {2}{B}. Exile target creature or planeswalker.', ['B']),
  createBenchmarkCard('Disfigure', 'BRO', '{B}', 1, 'Instant', 'Target creature gets -2/-2 until end of turn.', ['B']),
  createBenchmarkCard('Burglar Rat', 'GRN', '{1}{B}', 2, 'Creature — Rat', 'When Burglar Rat enters the battlefield, each opponent discards a card.', ['B'], '1', '1', 'common'),
  createBenchmarkCard('Fell', 'BLB', '{1}{B}', 2, 'Sorcery', 'Destroy target creature.', ['B'], undefined, undefined, 'uncommon'),
  createBenchmarkCard('Bonebind Orator', 'BLB', '{1}{B}', 2, 'Creature — Bat Cleric', 'Lifelink. {2}{B}, Exile Bonebind Orator from your graveyard: Return target creature card with mana value 2 or less from your graveyard to your hand.', ['B'], '2', '2', 'common', ['Lifelink']),
  createBenchmarkCard('Deep-Cavern Bat', 'LCI', '{1}{B}', 2, 'Creature — Bat', "Flying, lifelink. When Deep-Cavern Bat enters the battlefield, look at target opponent's hand and exile a nonland card until Deep-Cavern Bat leaves the battlefield.", ['B'], '1', '1', 'uncommon', ['Flying', 'Lifelink']),
  createBenchmarkCard('Murder', 'DMU', '{1}{B}{B}', 3, 'Instant', 'Destroy target creature.', ['B']),
  createBenchmarkCard("Hero's Downfall", 'VOW', '{1}{B}{B}', 3, 'Instant', 'Destroy target creature or planeswalker.', ['B'], undefined, undefined, 'uncommon'),
  createBenchmarkCard('Vault Plunderer', 'OTJ', '{2}{B}', 3, 'Creature — Rogue', 'When Vault Plunderer enters the battlefield, you draw a card and you lose 1 life.', ['B'], '3', '1'),
  createBenchmarkCard('Consuming Ashes', 'OTJ', '{3}{B}', 4, 'Instant', 'Exile target creature. Scry 2.', ['B']),
  createBenchmarkCard('Diregraf Horde', 'MID', '{4}{B}', 5, 'Creature — Zombie', 'When Diregraf Horde enters the battlefield, create two 2/2 black Zombie creature tokens with decayed and exile up to two target cards from graveyards.', ['B'], '3', '4'),
  createBenchmarkCard('Huskburster Swarm', 'BLB', '{7}{B}', 8, 'Creature — Insect', 'This spell costs {1} less to cast for each creature card in your graveyard. Menace.', ['B'], '6', '6', 'uncommon', ['Menace']),

  // Red
  createBenchmarkCard('Heartfire Hero', 'BLB', '{R}', 1, 'Creature — Mouse Soldier', 'Valiant — Whenever Heartfire Hero becomes the target of a spell or ability you control for the first time each turn, put a +1/+1 counter on it. When Heartfire Hero dies, it deals damage equal to its power to each opponent.', ['R'], '1', '1', 'uncommon'),
  createBenchmarkCard('Shock', 'MKM', '{R}', 1, 'Instant', 'Shock deals 2 damage to any target.', ['R']),
  createBenchmarkCard('Playful Shove', 'BLB', '{1}{R}', 2, 'Sorcery', 'Playful Shove deals 1 damage to any target. Draw a card.', ['R']),
  createBenchmarkCard('Abrade', 'LCI', '{1}{R}', 2, 'Instant', 'Choose one — Abrade deals 3 damage to target creature; or destroy target artifact.', ['R']),
  createBenchmarkCard('Take Out the Trash', 'BLB', '{1}{R}', 2, 'Instant', 'Take Out the Trash deals 3 damage to target creature. If you control a legendary creature, you may draw a card, then discard a card.', ['R']),
  createBenchmarkCard('Conduit Goblin', 'MH3', '{1}{R}', 2, 'Creature — Goblin Warrior', 'Whenever Conduit Goblin attacks, another target attacking creature gains haste until end of turn.', ['R'], '2', '2'),
  createBenchmarkCard("Dragon's Fire", 'AFR', '{1}{R}', 2, 'Instant', "As an additional cost to cast this spell, you may reveal a Dragon card from your hand or choose a Dragon you control. Dragon's Fire deals 3 damage to target creature or planeswalker.", ['R']),
  createBenchmarkCard('Fateful End', 'THB', '{2}{R}', 3, 'Instant', 'Fateful End deals 3 damage to any target. Scry 1.', ['R'], undefined, undefined, 'uncommon'),
  createBenchmarkCard('Redcap Thief', 'WOE', '{2}{R}', 3, 'Creature — Goblin Rogue', 'When Redcap Thief enters the battlefield, create a Treasure token.', ['R'], '2', '3'),
  createBenchmarkCard('Sunspine Lynx', 'BLB', '{2}{R}{R}', 4, 'Creature — Elemental Cat', "Players can't gain life. Damage can't be prevented. When Sunspine Lynx enters the battlefield, it deals damage to each player equal to the number of nonbasic lands that player controls.", ['R'], '5', '4', 'rare'),

  // Green
  createBenchmarkCard('Hardened Escort', 'DSK', '{1}{G}', 2, 'Creature — Human Survivor', 'Whenever Hardened Escort becomes tapped, another target creature gains indestructible until end of turn.', ['G'], '2', '1'),
  createBenchmarkCard('Quirion Beastcaller', 'DMU', '{1}{G}', 2, 'Creature — Dryad Warrior', 'Whenever you cast a creature spell, put a +1/+1 counter on Quirion Beastcaller. When Quirion Beastcaller dies, distribute its counters among creatures you control.', ['G'], '2', '2', 'rare'),
  createBenchmarkCard('Treeguard Duo', 'BLB', '{2}{G}', 3, 'Creature — Frog Rabbit', 'When Treeguard Duo enters the battlefield, target creature gets +1/+1 and gains vigilance until end of turn.', ['G'], '3', '3'),
  createBenchmarkCard('Rabid Gnaw', 'BLB', '{1}{G}', 2, 'Sorcery', "Target creature you control gets +1/+0 until end of turn, then it deals damage equal to its power to target creature you don't control.", ['G']),
  createBenchmarkCard('Brambleguard Veteran', 'BLB', '{3}{G}', 4, 'Creature — Raccoon Warrior', 'Whenever you expend 4, creatures you control get +1/+1 until end of turn.', ['G'], '3', '4', 'uncommon'),
  createBenchmarkCard('Owlbear', 'AFR', '{3}{G}{G}', 5, 'Creature — Bird Bear', 'Trample. When Owlbear enters the battlefield, draw a card.', ['G'], '4', '4', 'common', ['Trample']),
  createBenchmarkCard('Polliwallop', 'BLB', '{3}{G}', 4, 'Instant', "This spell costs {2} less to cast if it targets a Frog you control. Target creature you control fights target creature you don't control.", ['G']),
  createBenchmarkCard("Baker's Bane Beastie", 'BLB', '{4}{G}', 5, 'Creature — Beast', 'Vigilance. When Baker\'s Bane Beastie enters the battlefield, create a Food token.', ['G'], '5', '4', 'common', ['Vigilance']),
  createBenchmarkCard('Writhing Chrysalis', 'MH3', '{2}{R}{G}', 4, 'Creature — Eldrazi Drone', 'Reach. When you cast this spell, create two 0/1 colorless Eldrazi Spawn creature tokens. Whenever you sacrifice another Eldrazi, put a +1/+1 counter on Writhing Chrysalis.', ['R', 'G'], '2', '3', 'common', ['Reach']),
  createBenchmarkCard('Goldvein Hydra', 'OTJ', '{X}{G}', 1, 'Creature — Plant Hydra', 'Vigilance, trample, haste\nGoldvein Hydra enters the battlefield with X +1/+1 counters on it.\nWhen Goldvein Hydra dies, create X tapped Treasure tokens, where X is its power.', ['G'], '0', '0', 'mythic', ['Vigilance', 'Trample', 'Haste']),
  createBenchmarkCard('Wildwood Scourge', 'M21', '{X}{G}', 1, 'Creature — Hydra', 'Wildwood Scourge enters the battlefield with X +1/+1 counters on it.\nWhenever one or more +1/+1 counters are put on another non-Hydra creature you control, put a +1/+1 counter on Wildwood Scourge.', ['G'], '0', '0', 'rare'),
  createBenchmarkCard('Voracious Hydra', 'M20', '{X}{G}{G}', 2, 'Creature — Hydra', 'Trample\nVoracious Hydra enters the battlefield with X +1/+1 counters on it.\nWhen Voracious Hydra enters the battlefield, choose one —\n• Double the number of +1/+1 counters on Voracious Hydra.\n• Voracious Hydra fights target creature you don\'t control.', ['G'], '0', '1', 'rare', ['Trample']),

  // Colorless & Artifacts
  createBenchmarkCard('Skyreach Manta', 'MMA', '{5}', 5, 'Artifact Creature — Spire Owl', 'Flying\nSunburst (This enters the battlefield with a +1/+1 counter on it for each color of mana spent to cast it.)', [], '0', '0', 'common', ['Flying', 'Sunburst']),
  createBenchmarkCard('Etched Oracle', 'MMA', '{4}', 4, 'Artifact Creature — Wizard', 'Sunburst\n{1}, Remove four +1/+1 counters from Etched Oracle: Target player draws three cards.', [], '0', '0', 'uncommon', ['Sunburst']),
  createBenchmarkCard('Stonecoil Serpent', 'ELD', '{X}', 0, 'Artifact Creature — Snake', 'Reach, trample, protection from multicolored\nStonecoil Serpent enters the battlefield with X +1/+1 counters on it.', [], '0', '0', 'rare', ['Reach', 'Trample']),
  createBenchmarkCard('Endless One', 'BFZ', '{X}', 0, 'Creature — Eldrazi', 'Endless One enters the battlefield with X +1/+1 counters on it.', [], '0', '0', 'rare'),
  createBenchmarkCard('Candy Trail', 'WOE', '{1}', 1, 'Artifact — Food Clue', 'When Candy Trail enters the battlefield, scry 2. {2}, {T}, Sacrifice Candy Trail: You gain 3 life and draw a card.', []),
  createBenchmarkCard('Witching Well', 'ELD', '{U}', 1, 'Artifact', 'When Witching Well enters the battlefield, scry 2. {3}{U}, Sacrifice Witching Well: Draw two cards.', ['U']),
  createBenchmarkCard('Clockwork Percussionist', 'DSK', '{1}', 1, 'Artifact Creature — Monkey', 'Haste. When Clockwork Percussionist dies, exile the top card of your library. You may play it until the end of your next turn.', [], '1', '1', 'common', ['Haste']),
  createBenchmarkCard('Iron Apprentice', 'NEO', '{1}', 1, 'Artifact Creature — Homunculus', 'Iron Apprentice enters the battlefield with a +1/+1 counter on it. When Iron Apprentice dies, if it had counters on it, put those counters on target creature you control.', [], '0', '0', 'common'),
  createBenchmarkCard('Campus Guide', 'STX', '{2}', 2, 'Artifact Creature — Golem', 'When Campus Guide enters the battlefield, you may search your library for a basic land card, reveal it, then shuffle and put that card on top.', [], '2', '1'),
  createBenchmarkCard('Patchwork Banner', 'BLB', '{3}', 3, 'Artifact', 'As Patchwork Banner enters the battlefield, choose a creature type. Creatures you control of the chosen type get +1/+1. {T}: Add one mana of any color.', [], undefined, undefined, 'uncommon'),
  createBenchmarkCard('Barrow-Blade', 'LTR', '{1}', 1, 'Artifact — Equipment', 'Equipped creature gets +1/+1. Whenever equipped creature blocks or becomes blocked by a creature, that creature loses all abilities until end of turn. Equip {1}.', []),
  createBenchmarkCard('Kor Halberd', 'MOM', '{W}', 1, 'Artifact — Equipment', 'Equipped creature gets +1/+1 and has vigilance. Equip {1}.', ['W']),
  createBenchmarkCard('Key to the City', 'BRO', '{2}', 2, 'Artifact', '{T}, Discard a card: Up to one target creature can\'t be blocked this turn. Whenever Key to the City becomes untapped, you may pay {2}. If you do, draw a card.', []),
  createBenchmarkCard('Ecologist\'s Terrarium', 'NEO', '{2}', 2, 'Artifact', 'When Ecologist\'s Terrarium enters the battlefield, you may search your library for a basic land card, reveal it, put it into your hand, then shuffle. {2}, {T}, Sacrifice Ecologist\'s Terrarium: Put a +1/+1 counter on target creature.', []),
  createBenchmarkCard('Collector\'s Vault', 'WOE', '{2}', 2, 'Artifact', '{2}, {T}: Draw a card, then discard a card. Create a Treasure token.', []),
  createBenchmarkCard('Sterling Hound', 'OTJ', '{3}', 3, 'Artifact Creature — Dog', 'When Sterling Hound enters the battlefield, surveil 2.', [], '3', '2', 'common'),
  createBenchmarkCard('Circuit Mender', 'NEO', '{3}', 3, 'Artifact Creature — Insect', 'When Circuit Mender enters the battlefield, you gain 2 life. When Circuit Mender leaves the battlefield, draw a card.', [], '2', '3', 'uncommon'),
  createBenchmarkCard('Burnished Hart', 'FDN', '{3}', 3, 'Artifact Creature — Elk', '{3}, Sacrifice Burnished Hart: Search your library for up to two basic land cards, put them onto the battlefield tapped, then shuffle.', [], '2', '2', 'uncommon'),
  createBenchmarkCard('Suspicious Bookcase', 'SNC', '{2}', 2, 'Artifact Creature — Wall', 'Defender. {3}, {T}: Target creature can\'t be blocked this turn.', [], '0', '4', 'uncommon', ['Defender']),

  // Multicolor Archetypes & Signposts
  createBenchmarkCard('Stickytongue Sentinel', 'BLB', '{2}{G}', 3, 'Creature — Frog Warrior', 'Reach. When Stickytongue Sentinel enters the battlefield, return another target permanent you control to its owner\'s hand.', ['G'], '3', '3', 'common', ['Reach']),
  createBenchmarkCard('Infernal Vessel', 'FDN', '{2}{B}', 3, 'Creature — Human Warlock', 'When Infernal Vessel dies, if it wasn\'t a Demon, return it to the battlefield under its owner\'s control with two +1/+1 counters on it. It\'s a Demon in addition to its other types.', ['B'], '2', '1', 'uncommon'),
  createBenchmarkCard('Easterling Vanguard', 'LTR', '{1}{B}', 2, 'Creature — Human Warrior', 'When Easterling Vanguard dies, amass Orcs 1.', ['B'], '2', '1', 'common'),
  createBenchmarkCard('Skyfisher Spider', 'BRO', '{2}{B}{G}', 4, 'Creature — Spider', 'Reach. When Skyfisher Spider enters the battlefield, you may sacrifice another creature. When you do, destroy target nonland permanent. When Skyfisher Spider dies, you may gain 1 life for each creature card in your graveyard.', ['B', 'G'], '3', '3', 'uncommon', ['Reach']),
  createBenchmarkCard('Ruthless Lawbringer', 'OTJ', '{1}{W}{B}', 3, 'Creature — Vampire Assassin', 'When Ruthless Lawbringer enters the battlefield, you may sacrifice another creature. When you do, destroy target nonland permanent.', ['W', 'B'], '3', '2', 'uncommon'),
  createBenchmarkCard('Quaketusk Boar', 'BLB', '{3}{R}{R}', 5, 'Creature — Boar', 'Reach, trample, haste.', ['R'], '5', '5', 'uncommon', ['Reach', 'Trample', 'Haste']),
  createBenchmarkCard('Gurgling Anointer', 'BRO', '{1}{B}{B}', 3, 'Creature — Phyrexian Horror', 'Flying. Whenever you draw your second card each turn, put a +1/+1 counter on Gurgling Anointer. When Gurgling Anointer dies, return target creature card with mana value less than or equal to Gurgling Anointer\'s power from your graveyard to the battlefield.', ['B'], '1', '3', 'uncommon', ['Flying']),
  createBenchmarkCard('Faerie Vandal', 'SNC', '{1}{U}', 2, 'Creature — Faerie Rogue', 'Flash, flying. Whenever you draw your second card each turn, put a +1/+1 counter on Faerie Vandal.', ['U'], '1', '2', 'uncommon', ['Flash', 'Flying']),
  createBenchmarkCard('Astral Wingspan', 'MOM', '{4}{U}', 5, 'Enchantment — Aura', 'Convoke. Enchant creature. When Astral Wingspan enters the battlefield, draw a card. Enchanted creature gets +2/+2 and has flying.', ['U'], undefined, undefined, 'uncommon'),
  createBenchmarkCard('Lofty Dreams', 'ECL', '{3}{U}{U}', 5, 'Enchantment — Aura', 'Convoke. Enchant creature. When Lofty Dreams enters the battlefield, draw a card. Enchanted creature gets +2/+2 and has flying.', ['U'], undefined, undefined, 'uncommon'),
  createBenchmarkCard('Malamet Brawler', 'LCI', '{1}{G}', 2, 'Creature — Cat Warrior', 'Whenever Malamet Brawler attacks, target attacking creature gains trample until end of turn.', ['G'], '2', '2', 'common'),
  createBenchmarkCard('Flesh Burrower', 'DSK', '{1}{G}', 2, 'Creature — Insect', 'Deathtouch. Whenever Flesh Burrower attacks, another target creature gains deathtouch until end of turn.', ['G'], '2', '2', 'common', ['Deathtouch']),
  createBenchmarkCard('Dawnhand Eulogist', 'ECL', '{3}{B}', 4, 'Creature — Elf Warlock', 'Menace. When Dawnhand Eulogist enters the battlefield, mill three cards, then if an Elf card is in your graveyard, each opponent loses 2 life and you gain 2 life.', ['B'], '3', '3', 'common', ['Menace']),
  createBenchmarkCard('Yavimaya Iconoclast', 'DMU', '{1}{G}', 2, 'Creature — Elf Warrior', 'Trample. Kicker {R}. When Yavimaya Iconoclast enters the battlefield, if it was kicked, it gets +1/+1 and gains haste until end of turn.', ['G'], '3', '2', 'uncommon', ['Trample']),
  createBenchmarkCard('Belligerent Yearling', 'LCI', '{1}{R}', 2, 'Creature — Dinosaur', 'Trample. Whenever another Dinosaur you control enters the battlefield, you may have Belligerent Yearling\'s base power become equal to that creature\'s power until end of turn.', ['R'], '3', '2', 'uncommon', ['Trample']),
  createBenchmarkCard('Elfsworn Giant', 'FDN', '{3}{G}{G}', 5, 'Creature — Giant Warrior', 'Reach. Landfall — Whenever a land you control enters the battlefield, create a 1/1 green Elf creature token.', ['G'], '5', '3', 'uncommon', ['Reach']),
  createBenchmarkCard('Wildvine Pummeler', 'ECL', '{6}{G}', 7, 'Creature — Elemental Giant', 'Vivid — This spell costs {1} less to cast for each color among permanents you control.\nReach, trample', ['G'], '6', '5', 'common', ['Reach', 'Trample', 'Vivid']),
  createBenchmarkCard('Woodland Wanderer', 'BFZ', '{3}{G}', 4, 'Creature — Elemental', 'Vigilance, trample\nConverge — This creature enters the battlefield with a +1/+1 counter on it for each color of mana spent to cast it.', ['G'], '2', '2', 'rare', ['Vigilance', 'Trample', 'Converge']),
  createBenchmarkCard('Tajuru Stalwart', 'BFZ', '{2}{G}', 3, 'Creature — Elf Scout Ally', 'Converge — Tajuru Stalwart enters the battlefield with a +1/+1 counter on it for each color of mana spent to cast it.', ['G'], '0', '0', 'common', ['Converge']),
  createBenchmarkCard('Nishoba Brawler', 'DMU', '{1}{G}', 2, 'Creature — Cat Warrior', 'Trample\nDomain — Nishoba Brawler\'s power is equal to the number of basic land types among lands you control.', ['G'], '*', '3', 'common', ['Trample', 'Domain']),
  createBenchmarkCard('Steelclaw Lance', 'ELD', '{B}{R}', 2, 'Artifact — Equipment', 'Equipped creature gets +2/+2. Equip Knight {1}. Equip {3}.', ['B', 'R'], undefined, undefined, 'uncommon'),
  createBenchmarkCard('Cultivate', 'M11', '{2}{G}', 3, 'Sorcery', 'Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.', ['G'], undefined, undefined, 'common'),
  // Toughness Combat Damage & "Butt-Strike" Benchmarks
  createBenchmarkCard('Bedrock Tortoise', 'LCI', '{3}{G}', 4, 'Creature — Turtle', 'During your turn, creatures you control have hexproof.\nEach creature you control with toughness greater than its power assigns combat damage equal to its toughness rather than its power.', ['G'], '0', '6', 'rare'),
  createBenchmarkCard('Doran, Besieged by Time', 'ECL', '{1}{W}{B}{G}', 4, 'Legendary Creature — Treefolk Druid', 'Each creature spell you cast with toughness greater than its power costs {1} less to cast.\nWhenever a creature you control attacks or blocks, it gets +X/+X until end of turn, where X is the difference between its power and toughness.', ['W', 'B', 'G'], '0', '5', 'rare'),
  createBenchmarkCard('Ancient Lumberknot', 'VOW', '{2}{B}{G}', 4, 'Creature — Treefolk', 'Each creature you control with toughness greater than its power assigns combat damage equal to its toughness rather than its power.', ['B', 'G'], '1', '4', 'uncommon'),
  createBenchmarkCard('Doran, the Siege Tower', '2X2', '{W}{B}{G}', 3, 'Legendary Creature — Treefolk Shaman', 'Each creature assigns combat damage equal to its toughness rather than its power.', ['W', 'B', 'G'], '0', '5', 'rare'),
  createBenchmarkCard('High Alert', 'RNA', '{1}{W}{U}', 3, 'Enchantment', 'Each creature you control assigns combat damage equal to its toughness rather than its power.\nCreatures you control can attack as though they didn\'t have defender.\n{2}{W}{U}: Untap target creature.', ['W', 'U'], undefined, undefined, 'uncommon'),
  // Token Anthems, Discard / Channel Removal, and White Utility Benchmarks
  createBenchmarkCard('Intangible Virtue', 'EMA', '{1}{W}', 2, 'Enchantment', 'Creature tokens you control get +1/+1 and have vigilance.', ['W'], undefined, undefined, 'uncommon'),
  createBenchmarkCard('Touch the Spirit Realm', 'NEO', '{2}{W}', 3, 'Enchantment', 'When Touch the Spirit Realm enters the battlefield, exile up to one other target artifact or creature until Touch the Spirit Realm leaves the battlefield.\nChannel — {1}{W}, Discard Touch the Spirit Realm: Exile target artifact or creature. Return it to the battlefield under its owner\'s control at the beginning of the next end step.', ['W'], undefined, undefined, 'uncommon'),
  createBenchmarkCard('Flowering of the White Tree', 'LTR', '{W}{W}', 2, 'Legendary Enchantment', 'Legendary creatures you control get +2/+1 and have ward {1}.\nNonlegendary creatures you control get +1/+1.', ['W'], undefined, undefined, 'rare'),
  createBenchmarkCard('Gideon\'s Reproach', 'BFZ', '{1}{W}', 2, 'Instant', 'Gideon\'s Reproach deals 4 damage to target attacking or blocking creature.', ['W'], undefined, undefined, 'common'),
  createBenchmarkCard('Phantom General', 'RTR', '{3}{W}', 4, 'Creature — Spirit Soldier', 'Creature tokens you control get +1/+1.', ['W'], '2', '3', 'uncommon'),

  // Lands & Fetchlands
  createBenchmarkCard('Terramorphic Expanse', 'SOS', '', 0, 'Land', '{T}, Sacrifice Terramorphic Expanse: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.', [], undefined, undefined, 'common'),
  createBenchmarkCard('Evolving Wilds', 'FDN', '', 0, 'Land', '{T}, Sacrifice Evolving Wilds: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.', [], undefined, undefined, 'common'),
  createBenchmarkCard('Escape Tunnel', 'MKM', '', 0, 'Land', '{T}, Sacrifice Escape Tunnel: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle. {1}, {T}, Sacrifice Escape Tunnel: Target creature with power 2 or less can\'t be blocked this turn.', [], undefined, undefined, 'common'),
  createBenchmarkCard('Rogue\'s Passage', 'FDN', '', 0, 'Land', '{T}: Add {C}. {4}, {T}: Target creature can\'t be blocked this turn.', [], undefined, undefined, 'uncommon'),
  createBenchmarkCard('Expressive Iteration', 'STX', '{U}{R}', 2, 'Sorcery', 'Look at the top three cards of your library. Put one into your hand, one on the bottom of your library, and exile one. You may play the exiled card this turn.', ['U', 'R'], undefined, undefined, 'uncommon'),
  createBenchmarkCard('Rip Apart', 'STX', '{R}{W}', 2, 'Sorcery', 'Choose one — Rip Apart deals 3 damage to target creature or planeswalker; or destroy target artifact or enchantment.', ['R', 'W'], undefined, undefined, 'uncommon'),
  createBenchmarkCard('Killian, Ink Duelist', 'STX', '{W}{B}', 2, 'Creature — Human Warlock', 'Lifelink, menace. Spells you cast that target a creature cost {2} less to cast.', ['W', 'B'], '2', '2', 'uncommon', ['Lifelink', 'Menace']),
  createBenchmarkCard('Dina, Soul Steeper', 'STX', '{B}{G}', 2, 'Creature — Dryad Druid', 'Whenever you gain life, each opponent loses 1 life. {1}, Sacrifice another creature: Target creature gets +X/+0 until end of turn, where X is the sacrificed creature\'s power.', ['B', 'G'], '1', '3', 'uncommon'),
  createBenchmarkCard('Quandrix Apprentice', 'STX', '{G}{U}', 2, 'Creature — Human Wizard', 'Magecraft — Whenever you cast or copy an instant or sorcery spell, look at the top three cards of your library. You may reveal a land card from among them and put it into your hand.', ['G', 'U'], '2', '2', 'uncommon'),
  createBenchmarkCard('Vinereap Mentor', 'BLB', '{B}{G}', 2, 'Creature — Squirrel Druid', 'When Vinereap Mentor enters the battlefield, create a Food token. Whenever you expend 4, put a +1/+1 counter on Vinereap Mentor.', ['B', 'G'], '2', '2', 'uncommon'),
  createBenchmarkCard('Wandertale Mentor', 'BLB', '{R}{G}', 2, 'Creature — Raccoon Bard', 'Whenever you cast a creature spell with mana value 4 or greater, put a +1/+1 counter on Wandertale Mentor. {T}: Add {R} or {G}.', ['R', 'G'], '2', '2', 'uncommon'),
  createBenchmarkCard('Finneas, Ace Archer', 'BLB', '{G}{W}', 2, 'Creature — Rabbit Archer', 'Vigilance, reach. Whenever Finneas attacks, other Rabbits and creatures with counters you control get +1/+1 until end of turn. If you control four or more Rabbits, draw a card.', ['G', 'W'], '2', '2', 'rare', ['Vigilance', 'Reach']),
  createBenchmarkCard('Gev, Scaled Scorch', 'BLB', '{B}{R}', 2, 'Creature — Lizard Mercenary', 'Ward — Pay 2 life. Other Lizards you control enter the battlefield with an additional +1/+1 counter on them if an opponent lost life this turn.', ['B', 'R'], '3', '2', 'rare', ['Ward']),
  createBenchmarkCard('Kastral, the Windcrested', 'BLB', '{3}{W}{U}', 5, 'Creature — Bird Soldier', 'Flying. Whenever a Bird you control deals combat damage to a player, choose one — Draw a card; or put a +1/+1 counter on each Bird you control; or return target Bird card from your graveyard to the battlefield.', ['W', 'U'], '4', '5', 'rare', ['Flying']),

  // Lands & Bombs
  createBenchmarkCard('Oteclan Landmark', 'LCI', '{1}', 1, 'Artifact', 'When Oteclan Landmark enters the battlefield, scry 2. Craft with land {2}{W}.', ['W']),
  createBenchmarkCard('Railway Brawler', 'OTJ', '{3}{G}{G}', 5, 'Creature — Rhino Warrior', 'Plot {2}{G}{G}. Reach, trample. Whenever another creature enters the battlefield under your control, double its power and toughness until end of turn.', ['G'], '5', '5', 'mythic', ['Reach', 'Trample']),
  createBenchmarkCard('Professor Onyx', 'STX', '{4}{B}{B}', 6, 'Planeswalker — Liliana', 'Magecraft — Whenever you cast or copy an instant or sorcery spell, each opponent loses 2 life and you gain 2 life.', ['B'], undefined, undefined, 'mythic'),
  createBenchmarkCard('Enlightened Tutor', 'EMA', '{W}', 1, 'Instant', 'Search your library for an artifact or enchantment card, reveal it, then shuffle and put that card on top.', ['W'], undefined, undefined, 'rare'),
  createBenchmarkCard('Search for Glory', 'KHM', '{2}{W}', 3, 'Snow Sorcery', 'Search your library for a snow permanent card, a legendary card, or a Saga card, reveal it, put it into your hand, then shuffle. You gain 1 life for each {S} spent to cast this spell.', ['W'], undefined, undefined, 'uncommon'),
  createBenchmarkCard('Idyllic Tutor', 'THB', '{2}{W}', 3, 'Sorcery', 'Search your library for an enchantment card, reveal it, put it into your hand, then shuffle.', ['W'], undefined, undefined, 'rare'),
  createBenchmarkCard('Solve the Equation', 'STX', '{2}{U}', 3, 'Sorcery', 'Search your library for an instant or sorcery card, reveal it, put it into your hand, then shuffle.', ['U'], undefined, undefined, 'uncommon'),
  createBenchmarkCard('Demonic Counsel', 'DSK', '{1}{B}', 2, 'Sorcery', 'Search your library for a Demon card, reveal it, put it into your hand, then shuffle. Delirium — If there are four or more card types among cards in your graveyard, instead search your library for any card, put it into your hand, then shuffle.', ['B'], undefined, undefined, 'rare'),
  createBenchmarkCard('Insatiable Avarice', 'OTJ', '{B}', 1, 'Sorcery', 'Spree\n+ {2} — Search your library for a card, then shuffle and put that card on top.\n+ {B}{B} — Target player draws three cards and loses 3 life.', ['B'], undefined, undefined, 'rare'),

  // Ramp Dorks (2-drop vs 3-drop), Mana Rocks, Powerstone / Heartwood Artifacts & Animating Auras
  createBenchmarkCard('Poison Dart Frog', 'LCI', '{1}{G}', 2, 'Creature — Frog', 'Reach, deathtouch. {T}: Add one mana of any color. {2}: Poison Dart Frog gains deathtouch until end of turn.', ['G'], '1', '1', 'common', ['Reach', 'Deathtouch']),
  createBenchmarkCard('Three Tree Rootweaver', 'BLB', '{1}{G}', 2, 'Creature — Mouse Druid', '{T}: Add one mana of any color. Spend this mana only to cast a creature spell.', ['G'], '1', '3', 'common'),
  createBenchmarkCard('Deathbloom Gardener', 'DMU', '{2}{G}', 3, 'Creature — Elf Druid', 'Deathtouch. {T}: Add one mana of any color.', ['G'], '1', '1', 'common', ['Deathtouch']),
  createBenchmarkCard('Oasis Gardener', 'OTJ', '{2}{G}', 3, 'Creature — Plant Druid', 'When Oasis Gardener enters the battlefield, you gain 2 life. {T}: Add one mana of any color.', ['G'], '2', '2', 'common'),
  createBenchmarkCard('Weaver of Blossoms', 'VOW', '{2}{G}', 3, 'Creature — Human Werewolf', 'Daybound. {T}: Add one mana of any color.', ['G'], '2', '3', 'common'),
  createBenchmarkCard('Dragonstorm Globe', 'TDM', '{3}', 3, 'Artifact', '{T}: Add one mana of any color. {3}, {T}: Dragon spells you cast this turn cost {1} less to cast.', []),
  createBenchmarkCard('Starting Column', 'DFT', '{3}', 3, 'Artifact', '{T}: Add one mana of any color. {5}, {T}, Sacrifice Starting Column: Draw two cards.', []),
  createBenchmarkCard('Argothian Opportunist', 'BRO', '{2}{G}', 3, 'Creature — Human Artificer', 'When Argothian Opportunist enters the battlefield, create a tapped Powerstone token.', ['G'], '3', '2', 'common'),
  createBenchmarkCard('Zoetic Glyph', 'LCI', '{2}{U}', 3, 'Enchantment — Aura', 'Enchant artifact. Enchanted artifact is a Golem creature with base power and toughness 5/4 in addition to its other types. When Zoetic Glyph is put into a graveyard from the battlefield, discover 3.', ['U'], undefined, undefined, 'uncommon'),
  createBenchmarkCard('Ensoul Artifact', 'M15', '{1}{U}', 2, 'Enchantment — Aura', 'Enchant artifact. Enchanted artifact is a creature with base power and toughness 5/5 in addition to its other types.', ['U'], undefined, undefined, 'uncommon'),
  createBenchmarkCard('Scrapwork Cohort', 'BRO', '{4}', 4, 'Artifact Creature — Soldier', 'When Scrapwork Cohort enters the battlefield, create a 1/1 colorless Soldier artifact creature token. Unearth {2}{W}', ['W'], '3', '1', 'common'),
  createBenchmarkCard('Svella, Ice Shaper', 'KHM', '{1}{R}{G}', 3, 'Legendary Creature — Troll Shaman', '{3}, {T}: Create an Icy Manalith token. {6}{R}{G}, {T}: Look at the top four cards of your library. You may cast a spell from among them without paying its mana cost. Put the rest on the bottom of your library in a random order.', ['R', 'G'], '2', '4', 'uncommon'),
  createBenchmarkCard('Tinker\'s Tote', 'LCI', '{2}{W}', 3, 'Artifact', 'When Tinker\'s Tote enters the battlefield, create two 1/1 colorless Gnome artifact creature tokens and you gain 2 life. {3}{W}, {T}, Sacrifice Tinker\'s Tote: Put a +1/+1 counter on each creature you control.', ['W'], undefined, undefined, 'common'),
  createBenchmarkCard('Gleaming Geardrake', 'MKM', '{U}{R}', 2, 'Artifact Creature — Drake', 'Flying. When Gleaming Geardrake enters the battlefield, investigate. Whenever you sacrifice an artifact, put a +1/+1 counter on Gleaming Geardrake.', ['U', 'R'], '1', '1', 'uncommon', ['Flying']),
  createBenchmarkCard('Oni-Cult Anvil', 'NEO', '{B}{R}', 2, 'Artifact', 'Whenever one or more artifacts you control leave the battlefield during your turn, create a 1/1 colorless Construct artifact creature token. {T}, Sacrifice an artifact: Oni-Cult Anvil deals 1 damage to each opponent. You gain 1 life.', ['B', 'R'], undefined, undefined, 'uncommon'),
  createBenchmarkCard('Unctus\'s Retrofitter', 'ONE', '{1}{U}', 2, 'Creature — Phyrexian Artificer', 'When Unctus\'s Retrofitter enters the battlefield, target noncreature artifact you control becomes an artifact creature with base power and toughness 4/4 for as long as Unctus\'s Retrofitter remains on the battlefield.', ['U'], '2', '3', 'uncommon'),
];

export const HISTORICAL_BENCHMARK_NAMES = new Set(
  HISTORICAL_BENCHMARK_CARDS.map(c => c.name.trim().toLowerCase())
);

// Known Limited functional effect clauses with category classification
export interface EffectPattern {
  pattern: RegExp;
  label: string;
  category: 'removal' | 'damage' | 'counter' | 'draw' | 'selection' | 'trick' | 'bounce' | 'pacifism' | 'token' | 'counters' | 'sweeper' | 'synergy' | 'graveyard' | 'equipment' | 'tutor' | 'token_army' | 'token_creature' | 'token_resource' | 'lifegain_payoff';
}

const EFFECT_PATTERNS: EffectPattern[] = [
  { pattern: /(destroy|exile) (up to \w+ )?target (attacking |tapped |blocking |nontoken |nonartifact |non-outlaw |nonlegendary |nonblack |artifact or |enchantment or |artifact, enchantment, or tapped )?creature/i, label: 'Creature Removal', category: 'removal' },
  { pattern: /(destroy|exile) (up to \w+ )?target creature/i, label: 'Creature Removal', category: 'removal' },
  { pattern: /destroy target \[(attacking|blocking|tapped)\] creature/i, label: 'Creature Removal', category: 'removal' },
  { pattern: /(destroy|exile) (up to \w+ )?target (permanent|nonland permanent|artifact, creature, or enchantment|artifact, enchantment, or tapped creature|artifact|enchantment)/i, label: 'Permanent Removal', category: 'removal' },
  { pattern: /search your library for .* card.*put that card on top|search your library for .* then shuffle and put that card on top/i, label: 'Top-of-Library Tutor', category: 'tutor' },
  { pattern: /search your library for .* into your hand/i, label: 'Library Tutor to Hand', category: 'tutor' },
  { pattern: /search your library for/i, label: 'Library Tutor / Search', category: 'tutor' },
  { pattern: /deals \d+ damage to (any target|target creature)/i, label: 'Burn / Direct Damage', category: 'damage' },
  { pattern: /(destroy|exile) all (creatures|nonland permanents)/i, label: 'Board Wipe / Wrath', category: 'sweeper' },
  { pattern: /destroy all creatures with power/i, label: 'Board Wipe / Conditional Wrath', category: 'sweeper' },
  { pattern: /deals \d+ damage to each creature/i, label: 'Board Wipe / Sweeper', category: 'sweeper' },
  { pattern: /each creature gets [+-]?-\d+\/[+-]?-\d+/i, label: 'Board Wipe / Languish', category: 'sweeper' },
  { pattern: /destroy all creatures/i, label: 'Board Wipe / Wrath', category: 'sweeper' },
  { pattern: /counter target (spell|noncreature spell|creature spell)/i, label: 'Counterspell', category: 'counter' },
  { pattern: /(draw|draws) (a|\d+|one|two|three|four|five|x|that many) cards?/i, label: 'Card Draw', category: 'draw' },
  { pattern: /where x is the amount of life you gained|if you gained life|whenever you gain life|amount of life you gained|if you gained \d+ or more life/i, label: 'Lifegain Payoff', category: 'lifegain_payoff' },
  { pattern: /target creature gets [+-]\d+\/[+-]\d+/i, label: 'Stat Modifier', category: 'trick' },
  { pattern: /(creatures|attacking creatures|other creatures) you control get [+-]\d+\/[+-]\d+/i, label: 'Team Stat Buff / Anthem', category: 'trick' },
  { pattern: /\{[0-9WUBRG]+\}(, \{t\})?: (creatures|attacking creatures|other creatures) you control get/i, label: 'Activated Team Pump / Mana Sink', category: 'trick' },
  { pattern: /create (a|\d+|one|two|three|four|five|x|that many) .* (creature|artifact creature) tokens?|amass/i, label: 'Creature Token Creation', category: 'token_creature' },
  { pattern: /create (a|\d+|one|two|three|four|five|x|that many) .*(food|clue|blood|treasure|map|powerstone|heartwood|junk|incubator) tokens?|investigate/i, label: 'Resource Token Creation', category: 'token_resource' },
  { pattern: /create (a|\d+|one|two|three|four|five|x) .* tokens?|amass|investigate/i, label: 'Token Creation', category: 'token' },
  { pattern: /scry (\d+|x)|surveil (\d+|x)/i, label: 'Scry / Surveil', category: 'selection' },
  { pattern: /put (a|\d+) \+1\/\+1 counter/i, label: '+1/+1 Counter', category: 'counters' },
  { pattern: /return target .* to its owner's hand/i, label: 'Bounce Effect', category: 'bounce' },
  { pattern: /(?:the owner of )?(?:up to \w+\s+|other\s+)*target (?:nonland permanent|creature|permanent)(?:'s owner)? puts it on (?:their choice of )?the (?:top or bottom|top|bottom) of (?:their|its owner's) library|(?:put|puts) (?:target )?(?:nonland permanent|creature|permanent) (?:on|into) (?:the )?(?:top or bottom|top|bottom) of its owner's library/i, label: 'Tuck Removal / Library Bounce', category: 'bounce' },
  { pattern: /target creature can't (block|attack)/i, label: 'Pacifism / Lock', category: 'pacifism' },
  { pattern: /enchanted (creature|permanent) (can't attack|can't block|doesn't untap)/i, label: 'Pacifism Aura', category: 'pacifism' },
  { pattern: /enchanted (creature|permanent) loses all abilities|lose all abilities|has no abilities/i, label: 'Ability Loss Aura', category: 'pacifism' },
  { pattern: /base power and toughness/i, label: 'Stat Reduction / Transformation', category: 'pacifism' },
  { pattern: /doesn't untap during (its|their) controller's untap step|doesn't untap/i, label: 'Freeze Lockdown', category: 'pacifism' },
  { pattern: /connive|recruit|draw a card, then discard|then discard a card|discard a card, then draw|discard (a|\d+|one|two) cards?/i, label: 'Looting / Card Selection', category: 'selection' },
  { pattern: /look at the top \d+ cards/i, label: 'Card Selection / Impulse', category: 'selection' },
  { pattern: /when .* enters the battlefield|when .* enters/i, label: 'ETB Ability', category: 'synergy' },
  { pattern: /sacrifice/i, label: 'Sacrifice Synergy', category: 'synergy' },
  { pattern: /from your graveyard|exile this card from your graveyard|flashback|disturb|embalm|eternalize/i, label: 'Graveyard Value', category: 'graveyard' },
  { pattern: /equipped creature gets [+-]\d+\/[+-]\d+|equip \{/i, label: 'Equipment Buff', category: 'equipment' },
  { pattern: /draw (your|their|a) second card|draws? (your|their|a) second card/i, label: 'Draw Second Card Synergy', category: 'synergy' },
  { pattern: /landfall|whenever a land (you control )?enters/i, label: 'Landfall Synergy', category: 'synergy' },
  { pattern: /target creature can't be blocked/i, label: 'Unblockable Effect', category: 'trick' },
  { pattern: /heartwood token|powerstone token/i, label: 'Ramp Artifact Token (Heartwood/Powerstone)', category: 'synergy' },
  { pattern: /enchant (artifact|non-aura enchantment|permanent).*base power and toughness|enchant artifact/i, label: 'Artifact Animation Aura', category: 'synergy' },
  { pattern: /sacrifice (an|another) artifact/i, label: 'Artifact Sacrifice Payoff', category: 'synergy' },
  { pattern: /tap \w+ untapped artifacts/i, label: 'Artifact Tap Payoff', category: 'synergy' },
  { pattern: /\{t\}: add/i, label: 'Mana Production / Ramp', category: 'synergy' },
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
  const rawOracle = (card.oracle_text || (card.card_faces ? card.card_faces.map(f => f.oracle_text).join('\n//\n') : '')).toLowerCase();
  const oracle = cleanOracleText(rawOracle).toLowerCase();

  const isPlaneswalker = frontTypeLine.includes('planeswalker');
  const isBattle = frontTypeLine.includes('battle');
  const isLand = frontTypeLine.includes('land');
  const isCreature = frontTypeLine.includes('creature');
  const hasFlash = (card.keywords || []).some(k => k.toLowerCase() === 'flash') || oracle.includes('flash');
  const hasFlying = (card.keywords || []).some(k => k.toLowerCase() === 'flying') || oracle.includes('flying');
  const isInstant = frontTypeLine.includes('instant');
  const isSorcery = frontTypeLine.includes('sorcery');
  const isEnchantment = frontTypeLine.includes('enchantment');
  const isArtifact = frontTypeLine.includes('artifact');
  const isHydra = frontTypeLine.includes('hydra');
  const hasXCost = /\{X\}/i.test(card.mana_cost || '') ||
                   /\{X\}/i.test(card.card_faces?.[0]?.mana_cost || '') ||
                   /\{X\}/i.test(card.card_faces?.[1]?.mana_cost || '');

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

  const isAura = isEnchantment && (
    oracle.includes('enchant creature') ||
    oracle.includes('enchant permanent') ||
    oracle.includes('enchant nonland permanent') ||
    frontTypeLine.includes('aura')
  );

  const isAbilityLossAura = isAura && (
    /loses all abilities|lose all abilities|has no abilities/i.test(oracle) ||
    (/base power and toughness/i.test(oracle) && /enchanted (creature|permanent)/i.test(oracle))
  );

  const isFreezeAura = isAura && (
    /doesn't untap during (its|their) controller's untap step|doesn't untap/i.test(oracle) ||
    (/tap enchanted/i.test(oracle) && !/gets [+-]\d/i.test(oracle)) ||
    /becomes unprepared/i.test(oracle)
  );

  const isLockdownAura = isAura && (
    /can't attack|can't block|activated abilities.*can't be activated/i.test(oracle)
  );

  const isExileAura = isAura && /exile/i.test(oracle);

  const isAuraRemoval = isAbilityLossAura || isFreezeAura || isLockdownAura || isExileAura;

  const createsCreatureTokens = (
    /create (a|\d+|one|two|three|four|five|x|that many) .* (creature|artifact creature) tokens?/i.test(oracle) ||
    /create x 2\/2/i.test(oracle) ||
    /create (a|\d+|one|two|three|four|five|x) .* tokens? named/i.test(oracle) ||
    /amass|living weapon|for mirrodin/i.test(oracle)
  );

  const createsResourceTokens = (
    /create (a|\d+|one|two|three|four|five|x|that many) .*(food|clue|blood|treasure|map|powerstone|heartwood|junk|incubator) tokens?/i.test(oracle) ||
    /investigate/i.test(oracle)
  );

  const createsTokens = createsCreatureTokens || createsResourceTokens || (oracle.includes('create') && oracle.includes('token')) || /amass|investigate/i.test(oracle) || /empower jace/i.test(rawOracle);

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

  // Flicker / Self-Blink Check
  const isFlicker = (
    /exile target .* (you control|you own).*return (it|that card)/i.test(oracle) ||
    /exile target creature you control/i.test(oracle) ||
    /exile target nonland permanent you control/i.test(oracle)
  );

  // METHOD 1: Lexical Effect Patterns
  const detectedClauses: { label: string; raw: string; category: string }[] = [];
  const detectedCategories = new Set<string>();

  EFFECT_PATTERNS.forEach((ep) => {
    if (ep.pattern.test(oracle)) {
      if (isFlicker && ep.category === 'removal') return;
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
  const isModalSpell = /choose (one|two|three)\b/i.test(rawOracle);

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
  if (isFlicker) {
    actionSubtypes.add('flicker_protection');
  } else if (isAuraRemoval) {
    actionSubtypes.add('aura_removal');
    if (isAbilityLossAura) actionSubtypes.add('ability_loss_aura');
    if (isFreezeAura) actionSubtypes.add('freeze_aura');
    if (isLockdownAura) actionSubtypes.add('pacifism_aura');
  } else if (
    /(destroy|exile) all (creatures|nonland permanents)/i.test(oracle) ||
    /destroy all creatures with power/i.test(oracle) ||
    /deals \d+ damage to each creature/i.test(oracle) ||
    /each creature gets [+-]?-\d+\/[+-]?-\d+/i.test(oracle)
  ) {
    actionSubtypes.add('sweeper');
    detectedCategories.add('sweeper');
  } else if (/deals \d+ damage to (any target|target creature)/i.test(oracle)) {
    actionSubtypes.add('burn_damage');
  } else if (/deals damage equal to (its|target creature's) power|fights target creature/i.test(oracle)) {
    actionSubtypes.add('bite_fight');
  } else if (
    /(?:the owner of )?(?:up to \w+\s+|other\s+)*target (?:nonland permanent|artifact or creature|creature|permanent)(?:'s owner)? puts it on (?:their choice of )?the (?:top or bottom|top|bottom) of (?:their|its owner's) library/i.test(oracle) ||
    /(?:put|puts) (?:target )?(?:nonland permanent|artifact or creature|creature|permanent) (?:on|into) (?:the )?(?:top or bottom|top|bottom) of its owner's library/i.test(oracle) ||
    /target (?:nonland permanent|artifact or creature) into its owner's library/i.test(oracle)
  ) {
    actionSubtypes.add('tuck_removal');
    actionSubtypes.add('bounce_removal');
    detectedCategories.add('removal');
    detectedCategories.add('bounce');
    if (/target (?:nonland permanent|permanent)/i.test(oracle)) {
      actionSubtypes.add('permanent_removal');
      actionSubtypes.add('unconditional_removal');
    } else {
      actionSubtypes.add('conditional_removal');
    }
    const isEtbTuck = /when .* enters/i.test(rawOracle) || /when .* enters/i.test(oracle);
    if (isEtbTuck) {
      actionSubtypes.add('etb_tuck_removal');
      actionSubtypes.add('etb_removal');
    }
  } else if (/(destroy|exile) (up to \w+ )?target (permanent|nonland permanent|artifact, creature, or enchantment)/i.test(oracle)) {
    actionSubtypes.add('permanent_removal');
    actionSubtypes.add('unconditional_removal');
    detectedCategories.add('removal');
  } else if (/(destroy|exile) (up to \w+ )?target (artifact or enchantment|artifact, enchantment, or tapped creature)/i.test(oracle)) {
    actionSubtypes.add('conditional_removal');
    detectedCategories.add('removal');
  } else if (/(destroy|exile) (up to \w+ )?target (artifact|enchantment)/i.test(oracle) && !/(creature|permanent)/i.test(oracle)) {
    actionSubtypes.add('artifact_enchantment_removal');
    detectedCategories.add('removal');
  } else {
    const isCreatureDestructionOrExile = (
      /(destroy|exile) (up to \w+ )?target (attacking |tapped |blocking |nontoken |nonartifact |non-outlaw |nonlegendary |nonblack |artifact or |enchantment or |artifact, enchantment, or tapped )?creature/i.test(oracle) ||
      /(destroy|exile) (up to \w+ )?target creature/i.test(oracle) ||
      /destroy target \[(attacking|blocking|tapped)\] creature/i.test(rawOracle)
    );
    if (isCreatureDestructionOrExile) {
      detectedCategories.add('removal');

      const hasOpponentCompensation = (
        /its controller (draws a card|investigates|creates|manifests)/i.test(oracle) ||
        /controller gains life equal to/i.test(oracle) ||
        /gift a/i.test(oracle)
      );
      if (hasOpponentCompensation) {
        actionSubtypes.add('removal_with_compensation');
      }

      const hasCombatCondition = (
        /wasn't attacking|attacking creature|tapped creature|blocked/i.test(oracle) ||
        /\[attacking\]/i.test(rawOracle)
      );
      if (hasCombatCondition) {
        actionSubtypes.add('combat_removal');
      }

      const hasPowerToughnessCondition = (
        /with power|with toughness|power or toughness|with mana value/i.test(oracle)
      );
      if (hasPowerToughnessCondition) {
        actionSubtypes.add('power_toughness_removal');
      }

      const hasToughness4PlusCondition = (
        /toughness [456] or greater|power or toughness [456] or greater/i.test(oracle)
      );
      if (hasToughness4PlusCondition) {
        actionSubtypes.add('toughness_4_plus_removal');
      }

      const hasPower4PlusCondition = (
        /power [456] or greater|power or toughness [456] or greater/i.test(oracle)
      );
      if (hasPower4PlusCondition) {
        actionSubtypes.add('power_4_plus_removal');
      }

      if (isModalSpell) {
        actionSubtypes.add('modal_removal');
      }

      const isRestrictedTargetCreature = (
        /(destroy|exile) (up to one )?target (attacking |tapped |blocking |nontoken |nonartifact |non-outlaw |nonlegendary |nonblack )creature/i.test(oracle) ||
        /destroy target \[(attacking|blocking|tapped)\] creature/i.test(rawOracle)
      );

      if (hasPowerToughnessCondition || isRestrictedTargetCreature) {
        actionSubtypes.add('conditional_removal');
      } else {
        actionSubtypes.add('unconditional_removal');
      }
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
    if (!isModalSpell) {
      actionSubtypes.add('cantrip');
    } else {
      actionSubtypes.add('card_selection');
    }
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

  // Draw Second Card Each Turn Synergy (e.g. Bard the Bowman, Roxxon Brutes, Gurgling Anointer, Faerie Vandal)
  const isSecondCardDrawn = /draw (your|their|a) second card|draws? (your|their|a) second card/i.test(oracle);
  if (isSecondCardDrawn) {
    actionSubtypes.add('second_card_drawn');
    detectedCategories.add('synergy');
    if (/draw (your|their|a) second card.*target creature/i.test(oracle) || (/draw (your|their|a) second card/i.test(oracle) && /put a \+1\/\+1 counter on target creature/i.test(oracle))) {
      actionSubtypes.add('second_card_target_buff');
    }
  }

  // Landfall Payoff (e.g. Thranduil Sindarin Liege, Silvan Reveler, Elfsworn Giant, Mole Man, Bloodghast)
  const isLandfall = /landfall|whenever a land (you control )?enters/i.test(oracle);
  if (isLandfall) {
    actionSubtypes.add('landfall_payoff');
    detectedCategories.add('synergy');
    if (/create (a|two|\d+)?.*token/i.test(oracle)) {
      actionSubtypes.add('landfall_token');
      valueRiders.add('token');
    }
    if (/from your graveyard/i.test(oracle)) {
      actionSubtypes.add('landfall_recursion');
      detectedCategories.add('graveyard');
    }
  }

  // Unblockable Ability Granter (e.g. Key to the Side-Door, Key to the City, Suspicious Bookcase, Rogue's Passage, Escape Tunnel)
  const isUnblockableGranter = /target creature can't be blocked/i.test(oracle);
  if (isUnblockableGranter) {
    actionSubtypes.add('unblockable_granter');
    detectedCategories.add('trick');
  }

  // 5. Combat Trick Subtypes
  if (isCombatTrick) {
    if (/gets [+-]\d+\/[+-]\d+/i.test(oracle)) actionSubtypes.add('pump_trick');
    if (/gains (hexproof|indestructible|protection)/i.test(oracle)) actionSubtypes.add('protection_trick');
    if (/gains (flying|first strike|lifelink|deathtouch|trample)/i.test(oracle)) actionSubtypes.add('keyword_trick');
  }

  // 6. Creature Role Subtypes
  if (isCreature) {
    const isManaDork = (/{t}: add/i.test(oracle) || /{t}, (pay \d+ life, )?add/i.test(oracle));
    if (isManaDork) {
      actionSubtypes.add('mana_dork');
      detectedCategories.add('synergy');
      if ((card.cmc || 0) <= 2) {
        actionSubtypes.add('two_drop_mana_dork');
      } else {
        actionSubtypes.add('three_drop_mana_dork');
      }
    }
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

    // Land tutor to top of library (e.g., Old Thrush, Campus Guide, Embermouth Sentinel)
    const isLandTutorTop = /search your library for a (basic )?land.*put that card on top/i.test(oracle);
    if (isLandTutorTop) {
      actionSubtypes.add('land_tutor_top');
      valueRiders.add('ramp');
      detectedCategories.add('ramp');
    }

    // Low-CMC evasive lifegain synergy (e.g., Old Thrush, Lifecreed Duo, Yellowjacket, Heartless Marauder)
    const hasFlying = (card.keywords || []).some(k => /flying/i.test(k)) || oracle.includes('flying');
    const hasEtbLifeTrigger = (
      (/when .* enters/i.test(oracle) && /gain \d+ life|lifelink/i.test(oracle)) ||
      (/whenever another .* enters/i.test(oracle) && (/gain \d+ life|lifelink/i.test(oracle)))
    );
    if (hasFlying && hasEtbLifeTrigger && (card.cmc || 0) <= 2) {
      actionSubtypes.add('flying_lifegain_evasion');
      detectedCategories.add('evasion');
      detectedCategories.add('synergy');
    }

    if (/deals combat damage to a player/i.test(oracle)) actionSubtypes.add('saboteur');
    if (/when .* dies/i.test(oracle)) actionSubtypes.add('death_trigger');

    const isAttackKeywordGranter = /whenever .* attacks/i.test(oracle) &&
      /(another target|target attacking|target creature).* gains (first strike|trample|deathtouch|menace|flying|lifelink|vigilance|double strike|haste|indestructible)/i.test(oracle);
    if (isAttackKeywordGranter) {
      actionSubtypes.add('attack_keyword_granter');
      detectedCategories.add('trick');
    }

    const isTeamPump = /(creatures|attacking creatures|other creatures) you control get \+[0-9]\/\+[0-9]/i.test(oracle);
    const isActivatedTeamPump = (
      /\{[0-9WUBRG]+\}(, \{t\})?: (creatures|attacking creatures|other creatures) you control get/i.test(oracle) ||
      (oracle.includes(':') && isTeamPump)
    );

    if (isActivatedTeamPump) {
      actionSubtypes.add('activated_team_pump');
      actionSubtypes.add('team_pump');
      detectedCategories.add('trick');
    } else if (isTeamPump) {
      actionSubtypes.add('team_pump');
      detectedCategories.add('trick');
    }

    const isManaSink = /\{[4-9X]|\{[1-9][0-9]\}|\{[0-9WUBRG]\}\{[0-9WUBRG]\}\{[0-9WUBRG]\}\{[0-9WUBRG]\}/i.test(oracle.split(':')[0] || '');
    if (isManaSink && oracle.includes(':')) {
      actionSubtypes.add('mana_sink');
    }

    // ETB Self-Bounce Permanent Engine (e.g. Mirkwood Nurturer, Stickytongue Sentinel, Mischievous Pup, Exosuit Savior)
    const isEtbSelfBounce = (/when .* enters/i.test(rawOracle) || /when .* enters/i.test(oracle)) &&
      (/return (another |a )?target permanent (you control|to its owner's hand)/i.test(oracle) || /return another permanent you control/i.test(oracle));
    if (isEtbSelfBounce) {
      actionSubtypes.add('etb_self_bounce');
      detectedCategories.add('synergy');
    }

    // Dies-into-Token / Amass Replacement (e.g. Fearsome Goblin Pair, Easterling Vanguard, Infernal Vessel, Earth Village Ruffians)
    const isDeathAmassOrToken = /when .* dies/i.test(oracle) &&
      (oracle.includes('amass') || /create (a|two|\d+)?.*token/i.test(oracle) || /if it wasn't a .* return it/i.test(oracle));
    if (isDeathAmassOrToken) {
      actionSubtypes.add('death_amass_token');
      valueRiders.add('token');
      detectedCategories.add('token');
    }

    // ETB Sacrifice Creature for Removal / Damage (e.g. Bolg of the North, Skyfisher Spider, Killmonger, Ruthless Lawbringer, Boilerbilges Ripper)
    const isEtbSacRemoval = (/when .* enters/i.test(rawOracle) || /when .* enters/i.test(oracle)) &&
      /sacrifice another (creature|permanent)/i.test(oracle) &&
      (oracle.includes('destroy') || /deals damage/i.test(oracle));
    if (isEtbSacRemoval) {
      actionSubtypes.add('etb_sac_removal');
      detectedCategories.add('removal');
    }

    // Power 4 or Greater Synergies / Ferocious (e.g. The Chief Warg, Bitter Work, Hunter's Talent)
    const hasPower4PlusSynergy = /creature with power 4 or greater/i.test(oracle) ||
      (/power 4 or greater/i.test(oracle) && !/destroy|exile|toughness/i.test(oracle));
    if (hasPower4PlusSynergy) {
      actionSubtypes.add('power_4_plus_synergy');
      detectedCategories.add('synergy');
    }

    // Cultivate Double-Land Ramp on a Creature / Spell (e.g. Troop of Ponies, Burnished Hart, Cultivate, Reach the Horizon)
    const isCultivateRamp = /search your library for (up to )?(two|2) (basic )?land cards/i.test(oracle);
    if (isCultivateRamp) {
      actionSubtypes.add('cultivate_ramp');
      valueRiders.add('ramp');
      detectedCategories.add('ramp');
    }
  }

  // Prepared creature / spell (Reality Fracture)
  const isPreparedCreature = /enters prepared|becomes prepared|prepared\b/i.test(rawOracle);
  if (isPreparedCreature) {
    actionSubtypes.add('prepared_creature');
    detectedCategories.add('synergy');
  }

  // Ramp Artifact Token Producers (Heartwood, Powerstone, Lander)
  const createsRampToken = (
    /create (a|two|\d+)?.*(heartwood|powerstone|lander) token/i.test(rawOracle) ||
    /create (a|two|\d+)?.*(heartwood|powerstone|lander) token/i.test(oracle) ||
    (isPreparedCreature && /(heartwood|powerstone)/i.test(rawOracle))
  );
  if (createsRampToken) {
    actionSubtypes.add('ramp_token_producer');
    valueRiders.add('token');
    valueRiders.add('ramp');
    detectedCategories.add('synergy');
    if (/heartwood/i.test(rawOracle)) actionSubtypes.add('heartwood_token_producer');
    if (/powerstone/i.test(rawOracle)) actionSubtypes.add('powerstone_token_producer');
  }

  // Artifact Animation Aura (e.g. Puppet Crafting, Zoetic Glyph, Ensoul Artifact)
  const isArtifactAnimatorAura = (isEnchantment || /aura/i.test(typeLine) || isAura) && (
    (/enchant (artifact|non-aura enchantment|permanent)/i.test(rawOracle) || /enchanted (artifact|permanent) is a/i.test(rawOracle) || /enchant artifact/i.test(rawOracle)) &&
    (/is a .* creature/i.test(rawOracle) || /base power and toughness/i.test(rawOracle) || /construct|golem/i.test(rawOracle))
  );
  if (isArtifactAnimatorAura) {
    actionSubtypes.add('artifact_animator_aura');
    valueRiders.add('buff');
    detectedCategories.add('synergy');
  }

  // Artifact Sacrifice Payoff (e.g. Hungering Puppetbeast, Tinker's Tote, Megatog, Gleaming Geardrake, Oni-Cult Anvil)
  const isArtifactSacPayoff = (
    /sacrifice (an|another) artifact:/i.test(oracle) ||
    /whenever you sacrifice (an|another|one or more) artifacts?/i.test(oracle) ||
    /whenever one or more artifacts you control leave the battlefield/i.test(oracle)
  );
  if (isArtifactSacPayoff) {
    actionSubtypes.add('artifact_sacrifice_payoff');
    detectedCategories.add('synergy');
  }

  // Artifact Tap Payoff (e.g. Tenured Tethermage, Inspiring Statuary)
  const isArtifactTapPayoff = /tap (an|two|\d+|another)?\s+untapped artifacts? you control/i.test(oracle);
  if (isArtifactTapPayoff) {
    actionSubtypes.add('artifact_tap_payoff');
    detectedCategories.add('synergy');
  }

  // Empower Jace Engine (Reality Fracture)
  const empowerJaceMatch = rawOracle.match(/empower jace\s*(\d+)?/i);
  const hasEmpowerJace = !!empowerJaceMatch;
  const empowerJaceCount = empowerJaceMatch ? (empowerJaceMatch[1] ? parseInt(empowerJaceMatch[1], 10) : 1) : 0;

  if (hasEmpowerJace) {
    actionSubtypes.add('empower_jace');
    actionSubtypes.add('amass_parallel'); // Rectangle Theory: generates/expands permanent planeswalker presence
    valueRiders.add('token');
    valueRiders.add('surveil_scry');
    valueRiders.add('life_gain'); // Soft life gain / damage diversion away from player life total

    if (empowerJaceCount >= 1) {
      actionSubtypes.add('empower_jace_surveil');
      detectedCategories.add('selection');
    }

    if (empowerJaceCount >= 3) {
      actionSubtypes.add('empower_jace_draw');
      detectedCategories.add('draw');
      valueRiders.add('cantrip');
      if (isCreature) {
        actionSubtypes.add('etb_value');
        actionSubtypes.add('cantrip');
      }
    }

    if (empowerJaceCount >= 6) {
      actionSubtypes.add('raw_draw');
      detectedCategories.add('draw');
    }

    const isNoncreatureTrigger = /whenever you cast (?:a|your first) noncreature spell/i.test(oracle);
    if (isNoncreatureTrigger) {
      actionSubtypes.add('noncreature_spell_trigger');
      actionSubtypes.add('spellslinger_payoff');
      actionSubtypes.add('noncreature_surveil_engine');
      actionSubtypes.add('empower_jace_surveil');
      detectedCategories.add('selection');
    }
  }

  // Generic Noncreature Spell Triggers (Spellslinger Payoffs e.g. Cruel Witness, Third Path Iconoclast, Ledger Shredder)
  const isGenericNoncreatureTrigger = /whenever you cast (?:a|your first) noncreature spell/i.test(oracle);
  if (isGenericNoncreatureTrigger && !hasEmpowerJace) {
    actionSubtypes.add('noncreature_spell_trigger');
    actionSubtypes.add('spellslinger_payoff');
    if (/surveil/i.test(oracle) || actionSubtypes.has('surveil')) {
      actionSubtypes.add('noncreature_surveil_engine');
      detectedCategories.add('selection');
    }
  }

  // ETB Counter Distribution, Static Entry & Growth Subtypes
  let entersWithCountersCount = 0;
  const entersWithMatch = oracle.match(/enters(?:\s+the\s+battlefield)?\s+with\s+(a|an|\d+|one|two|three|four|five)\s+\+1\/\+1\s+counters?/i);
  if (entersWithMatch) {
    const rawNum = entersWithMatch[1].toLowerCase();
    if (rawNum === 'a' || rawNum === 'an' || rawNum === 'one' || rawNum === '1') entersWithCountersCount = 1;
    else if (rawNum === 'two' || rawNum === '2') entersWithCountersCount = 2;
    else if (rawNum === 'three' || rawNum === '3') entersWithCountersCount = 3;
    else if (rawNum === 'four' || rawNum === '4') entersWithCountersCount = 4;
    else if (rawNum === 'five' || rawNum === '5') entersWithCountersCount = 5;
    else {
      const parsed = parseInt(rawNum, 10);
      if (!isNaN(parsed)) entersWithCountersCount = parsed;
    }
  }

  let etbSelfCounterCount = 0;
  const etbSelfMatch = oracle.match(/when\s+(?:this\s+creature|this\s+permanent|it)\s+enters(?:\s+the\s+battlefield)?,?\s+put\s+(a|an|\d+|one|two|three)\s+\+1\/\+1\s+counter[s]?\s+on\s+(?:it|this)/i);
  if (etbSelfMatch) {
    const rawNum = etbSelfMatch[1].toLowerCase();
    if (rawNum === 'a' || rawNum === 'an' || rawNum === 'one' || rawNum === '1') etbSelfCounterCount = 1;
    else if (rawNum === 'two' || rawNum === '2') etbSelfCounterCount = 2;
    else if (rawNum === 'three' || rawNum === '3') etbSelfCounterCount = 3;
    else {
      const parsed = parseInt(rawNum, 10);
      if (!isNaN(parsed)) etbSelfCounterCount = parsed;
    }
  }

  // 1. Static enters with counters (e.g. Graft Surgeon, Riot, Modular)
  if (entersWithCountersCount > 0) {
    actionSubtypes.add('enters_with_counters');
    valueRiders.add('counters');
    detectedCategories.add('counters');
  }

  // 2. ETB counter distributor (targets other/another creature)
  if (/when\s+.*\s+enters/i.test(oracle) && /put (?:a|\d+|one|two)\s+\+1\/\+1 counter[s]?\s+on (?:target|another|a) creature/i.test(oracle)) {
    actionSubtypes.add('etb_counter_distributor');
    valueRiders.add('counters');
    detectedCategories.add('counters');
  } else if (etbSelfCounterCount > 0 || (/when\s+(?:this\s+creature|this|it)\s+enters/i.test(oracle) && /explores/i.test(oracle))) {
    actionSubtypes.add('etb_counter_self');
    valueRiders.add('counters');
    detectedCategories.add('counters');
  }

  // 3. Alliance / Creature-fall / Entry-triggered growth (e.g. Avatar Enthusiasts)
  // "Whenever another Ally you control enters, put a +1/+1 counter on this creature"
  const isTriggeredGrowthOtherEnters = /(?:whenever|when)\s+(?:another|a)\s+[^,\.]*enters.*put\s+(?:a|\d+|one|two)\s+\+1\/\+1\s+counter[s]?\s+on\s+(?:this|it)/i.test(oracle);
  if (isTriggeredGrowthOtherEnters) {
    actionSubtypes.add('triggered_growth_other_enters');
    valueRiders.add('counters');
    detectedCategories.add('counters');
  }

  // 4. Death Counter Transfer / Modular / Bequeath
  // "When this creature dies, put its counters on up to one target creature you control"
  // "When Quirion Beastcaller dies, distribute its counters among creatures you control"
  const isDeathCounterTransfer = (
    (/when\s+.*\s+dies,?\s+(?:put|distribute|move)\s+(?:its|those|\+1\/\+1)\s+counters\s+on\s+(?:up\s+to\s+one\s+target|target|another|creatures)/i.test(oracle)) ||
    (/when\s+.*\s+dies,?\s+distribute\s+its\s+counters/i.test(oracle)) ||
    (/modular\s+\d+/i.test(oracle)) ||
    (card.keywords || []).some(k => /modular/i.test(k))
  );
  if (isDeathCounterTransfer) {
    actionSubtypes.add('death_counter_transfer');
    actionSubtypes.add('death_trigger');
    valueRiders.add('counters');
    detectedCategories.add('counters');
  }

  // 5. Scalable X-Spells & Enters with X counters (e.g. Guiding Hydra, Stonecoil Serpent, Mikaeus)
  const entersWithXCounters = /enters(?:\s+the\s+battlefield)?\s+with\s+x\s+\+1\/\+1\s+counters?/i.test(oracle) ||
    (hasXCost && /enters(?:\s+the\s+battlefield)?\s+with\s+x/i.test(oracle));
  if (entersWithXCounters) {
    actionSubtypes.add('enters_with_x_counters');
    actionSubtypes.add('scalable_x_spell');
    valueRiders.add('counters');
    detectedCategories.add('counters');
  } else if (hasXCost) {
    actionSubtypes.add('scalable_x_spell');
  }

  if (isHydra) {
    actionSubtypes.add('hydra');
  }

  // 6. Team Counter Distribution (e.g. Guiding Hydra, Mikaeus, Shalai, Inspiring Call)
  // "put a +1/+1 counter on each other creature you control" / "put a +1/+1 counter on each creature you control"
  const isTeamCounterDistributor = /put\s+(?:a|an|\d+|one|two)?\s*(?:\+1\/\+1)?\s+counters?\s+on\s+each\s+(?:other\s+)?creature\s+you\s+control/i.test(oracle) ||
    /distribute\s+.*\s+counters?\s+among\s+each\s+creature\s+you\s+control/i.test(oracle);
  if (isTeamCounterDistributor) {
    actionSubtypes.add('team_counter_distributor');
    valueRiders.add('counters');
    detectedCategories.add('counters');
    detectedCategories.add('trick');
  }

  // 7. Combat Counter Distribution (e.g. Guiding Hydra, Luminarch Aspirant, Siege Veteran)
  const isCombatCounterDistributor = /at\s+the\s+beginning\s+of\s+combat\s+on\s+your\s+turn.*put\s+(?:a|an|\d+|one|two)?\s*(?:\+1\/\+1)?\s+counter/i.test(oracle) ||
    /at\s+the\s+beginning\s+of\s+combat\s+on\s+your\s+turn.*remove\s+a\s+\+1\/\+1\s+counter/i.test(oracle);
  if (isCombatCounterDistributor) {
    actionSubtypes.add('combat_counter_distributor');
    valueRiders.add('counters');
    detectedCategories.add('counters');
  }

  // 8. Counter Transfer Distributor (converting own counters into team-wide board growth)
  const isCounterTransferDistributor = /remove\s+(?:a|an|\d+|one)?\s*(?:\+1\/\+1)?\s+counter.*from\s+(?:this\s+creature|it|this).*put\s+.*counter.*on\s+each/i.test(oracle);
  if (isCounterTransferDistributor) {
    actionSubtypes.add('counter_transfer_distributor');
    valueRiders.add('counters');
    detectedCategories.add('counters');
  }

  // 9. Multicolor Scaling & "Colors of Mana Spent" Mechanics (Converge, Sunburst, Vivid, Domain)
  const isConverge = /converge\b|each color of mana spent to cast/i.test(oracle) ||
    (card.keywords || []).some(k => /converge/i.test(k));
  const isSunburst = /sunburst\b|each color of mana spent to pay/i.test(oracle) ||
    (card.keywords || []).some(k => /sunburst/i.test(k));
  const isVivid = /vivid\b|number of colors among permanents you control|each color among permanents you control|permanents of three or more colors/i.test(oracle) ||
    (card.keywords || []).some(k => /vivid/i.test(k));
  const isDomain = /domain\b|number of basic land types/i.test(oracle);
  const isColorsSpentMechanic = isConverge || isSunburst ||
    /for each color of mana spent/i.test(oracle) ||
    /if at least .* mana was spent/i.test(oracle) ||
    /colors of mana spent/i.test(oracle);
  const isMultiColorScaling = isConverge || isSunburst || isVivid || isDomain || isColorsSpentMechanic;

  if (isConverge || isSunburst) {
    actionSubtypes.add('converge_sunburst');
    actionSubtypes.add('color_scaling_payoff');
    detectedCategories.add('synergy');
    valueRiders.add('counters');
  }

  if (isVivid || isDomain) {
    actionSubtypes.add('domain_vivid_scaling');
    actionSubtypes.add('color_scaling_payoff');
    detectedCategories.add('synergy');
  }

  if (isColorsSpentMechanic) {
    actionSubtypes.add('colors_spent_mechanic');
    detectedCategories.add('synergy');
  }

  // 10. Toughness Combat Damage ("Butt-Strike") & Toughness-Matters Archetype
  const isToughnessCombatDamage = (
    /assigns combat damage equal to (?:its|their) toughness/i.test(oracle) ||
    /assigns combat damage equal to toughness rather than/i.test(oracle) ||
    /difference between (?:its|their) power and toughness/i.test(oracle)
  );

  const isDefenderAttackEnabler = (
    /can attack as though (?:they|it) didn['’]t have defender/i.test(oracle) ||
    /can attack as though (?:they|it) had not defender/i.test(oracle)
  );

  const isSelfToughnessCostReduction = (
    /this spell costs (?:\{X\}|\{\d+\}|[0-9]+) less to cast, where X is (?:the )?greatest toughness/i.test(oracle)
  );

  const isToughnessCostReduction = (
    isSelfToughnessCostReduction ||
    /costs (?:\{X\}|\{\d+\}|[0-9]+) less to cast, where X is (?:the )?greatest toughness/i.test(oracle) ||
    /creature spell(?:s)? you cast with toughness greater than (?:its|their) power costs? (?:\{X\}|\{\d+\}|[0-9]+) less/i.test(oracle)
  );

  const isToughnessCombatPump = (
    /difference between (?:its|their) power and toughness/i.test(oracle) ||
    /where X is (?:its|their|the) toughness/i.test(oracle) ||
    /where X is (?:the )?greatest toughness/i.test(oracle)
  );

  const isToughnessMatters = (
    isToughnessCombatDamage ||
    isDefenderAttackEnabler ||
    isToughnessCostReduction ||
    isToughnessCombatPump ||
    /toughness greater than (?:its|their) power/i.test(oracle) ||
    /greatest toughness among creatures you control/i.test(oracle)
  );

  if (isToughnessCombatDamage) {
    actionSubtypes.add('toughness_combat_damage');
    detectedCategories.add('synergy');
  }

  if (isDefenderAttackEnabler) {
    actionSubtypes.add('defender_attack_enabler');
    detectedCategories.add('synergy');
  }

  if (isToughnessCostReduction) {
    actionSubtypes.add('toughness_cost_reduction');
    detectedCategories.add('ramp');
  }

  if (isToughnessMatters) {
    actionSubtypes.add('toughness_matters_archetype');
    detectedCategories.add('synergy');
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

    const isPlaneswalkerOnlyMana = /spend this mana only to cast a planeswalker spell/i.test(oracle);
    if (/{t}: add/i.test(oracle) && !isPlaneswalkerOnlyMana) {
      actionSubtypes.add('mana_rock');
    }

    const isBasicTutorArtifact = /search your library for a (basic )?land card/i.test(oracle) && /into your hand/i.test(oracle);
    if (isBasicTutorArtifact) {
      actionSubtypes.add('basic_tutor_artifact');
      detectedCategories.add('selection');
    }
  }

  if (isAura) {
    const isAuraGyRecursion = /return this card from your graveyard|from your graveyard to the battlefield attached/i.test(oracle);
    if (isAuraGyRecursion) {
      actionSubtypes.add('aura_gy_recursion');
      detectedCategories.add('graveyard');
    }
  }

  if (isLand) {
    const isFetchLand = /search your library for a (basic )?land card/i.test(oracle) &&
      (/battlefield tapped/i.test(oracle) || /sacrifice/i.test(oracle));
    if (isFetchLand) {
      actionSubtypes.add('fetch_land');
      detectedCategories.add('ramp');
    }
  }

  // 9. Library Search & Tutor Subtypes (Spells and non-creature tutors)
  const isTutor = /search your library/i.test(oracle);
  let isTutorTop = false;
  let isTutorHand = false;
  let isTutorBattlefield = false;
  let isPlaneswalkerTutor = false;
  let isLegendaryTutor = false;

  if (isTutor) {
    actionSubtypes.add('library_tutor');
    detectedCategories.add('tutor');
    detectedCategories.add('selection');

    if (/put that card on top|then shuffle and put that card on top|shuffle, then put that card on top/i.test(oracle) || /search your library .* on top/i.test(oracle)) {
      isTutorTop = true;
      actionSubtypes.add('tutor_to_top');
    }
    if (/into your hand/i.test(oracle)) {
      isTutorHand = true;
      actionSubtypes.add('tutor_to_hand');
    }
    if (/onto the battlefield/i.test(oracle)) {
      isTutorBattlefield = true;
      actionSubtypes.add('tutor_to_battlefield');
    }
    if (/planeswalker/i.test(oracle)) {
      isPlaneswalkerTutor = true;
      actionSubtypes.add('planeswalker_tutor');
    }
    if (/legendary/i.test(oracle)) {
      isLegendaryTutor = true;
      actionSubtypes.add('legendary_tutor');
    }
    if (/(basic )?land card/i.test(oracle)) {
      actionSubtypes.add('land_tutor');
    }
    if (/creature card/i.test(oracle)) {
      actionSubtypes.add('creature_tutor');
    }
    if (/(instant|sorcery) card/i.test(oracle)) {
      actionSubtypes.add('spell_tutor');
    }
    if (/(permanent|enchantment|artifact|saga|aura|equipment) card/i.test(oracle)) {
      actionSubtypes.add('permanent_tutor');
    }
  }

  // Cost Structure
  let costProfile: 'x_cost' | 'additional_cost' | 'cost_reduction' | 'standard_cost' = hasXCost ? 'x_cost' : 'standard_cost';
  if (!hasXCost) {
    if (/as an additional cost|kicker|spree|gift|bargain|casualty|sacrifice (a|another) (creature|artifact)|tap an untapped|behold/i.test(oracle)) {
      costProfile = 'additional_cost';
    } else if (/this spell costs \{\d+\} less|affinity|convoke|delve|improvise/i.test(oracle)) {
      costProfile = 'cost_reduction';
    }
  }

  // Incidental Value Riders
  if (/proliferate/i.test(oracle)) valueRiders.add('proliferate');
  if (/surveil|scry/i.test(oracle)) valueRiders.add('surveil_scry');
  if (/investigate/i.test(oracle)) {
    valueRiders.add('token');
    valueRiders.add('resource_token');
    valueRiders.add('cantrip');
    detectedCategories.add('token');
    detectedCategories.add('token_resource');
  }
  if (isConnive || /\+1\/\+1 counter/i.test(oracle)) valueRiders.add('counters');
  if (createsCreatureTokens) {
    valueRiders.add('token');
    valueRiders.add('creature_token');
    detectedCategories.add('token');
    detectedCategories.add('token_creature');
  }
  if (createsResourceTokens) {
    valueRiders.add('token');
    valueRiders.add('resource_token');
    detectedCategories.add('token');
    detectedCategories.add('token_resource');
  }
  if ((isRecruit || /create .* token|empower|amass|investigate/i.test(oracle)) && !/its controller (creates|draws)/i.test(oracle)) {
    valueRiders.add('token');
  }
  if (/gain \d+ life|lifelink/i.test(oracle)) valueRiders.add('life_gain');
  if (/draw a card/i.test(oracle) && !/its controller draws a card/i.test(oracle)) {
    if (!isModalSpell) {
      valueRiders.add('cantrip');
    }
  }
  if (isConnive || isRecruit || /if you discarded/i.test(oracle)) valueRiders.add('discard_payoff');

  // Lifegain Payoff Action Subtype & Value Rider
  if (/where x is the amount of life you gained|if you gained life|whenever you gain life|amount of life you gained|for each 1 life you gained|if you gained \d+ or more life/i.test(oracle)) {
    actionSubtypes.add('lifegain_payoff');
    valueRiders.add('lifegain_payoff');
    detectedCategories.add('lifegain_payoff');
  }

  // Creature Token Army Action Subtype
  // An instant or sorcery whose primary role is creating creature bodies
  const isCreatureTokenArmy = (isInstant || isSorcery) &&
    createsCreatureTokens &&
    !isAuraRemoval &&
    !detectedCategories.has('removal') &&
    !actionSubtypes.has('sweeper') &&
    !actionSubtypes.has('artifact_enchantment_removal') &&
    !actionSubtypes.has('hard_counter') &&
    !actionSubtypes.has('soft_tax_counter') &&
    !actionSubtypes.has('restricted_counter') &&
    !actionSubtypes.has('power_toughness_removal') &&
    !actionSubtypes.has('toughness_4_plus_removal') &&
    !actionSubtypes.has('unconditional_removal') &&
    !actionSubtypes.has('conditional_removal') &&
    !actionSubtypes.has('combat_removal') &&
    !actionSubtypes.has('bite_fight') &&
    !actionSubtypes.has('burn_damage') &&
    !isCombatTrick;

  if (isCreatureTokenArmy) {
    actionSubtypes.add('creature_token_army');
    detectedCategories.add('token_army');
  }

  // Token Anthems, Team Anthems & Discard / Channel Removal
  const isTokenAnthem = (
    /creature tokens (?:you control )?get \+[0-9x]+\/\+[0-9x]+/i.test(oracle) ||
    /tokens you control get \+[0-9x]+\/\+[0-9x]+/i.test(oracle) ||
    /creature tokens you control (?:get|have)/i.test(oracle) ||
    /tokens you control have/i.test(oracle)
  );
  if (isTokenAnthem) {
    actionSubtypes.add('token_anthem');
    actionSubtypes.add('team_anthem');
    detectedCategories.add('token_anthem');
    detectedCategories.add('synergy');
  }

  const isTeamAnthem = (
    /creatures you control get \+[0-9x]+\/\+[0-9x]+/i.test(oracle) ||
    /other creatures you control get \+[0-9x]+\/\+[0-9x]+/i.test(oracle) ||
    /creatures you control have (?:vigilance|flying|first strike|lifelink|trample)/i.test(oracle)
  );
  if (isTeamAnthem) {
    actionSubtypes.add('team_anthem');
    detectedCategories.add('team_anthem');
    detectedCategories.add('synergy');
  }

  const isDiscardRemoval = (
    /discard (?:this card|~):\s*(?:(?:it|~) deals \d+ damage|destroy target|exile target)/i.test(oracle) ||
    /channel\s*—.*discard (?:this card|~):\s*(?:(?:it|~) deals \d+ damage|destroy target|exile target)/i.test(oracle)
  );
  if (isDiscardRemoval) {
    actionSubtypes.add('discard_removal');
    actionSubtypes.add('conditional_removal');
    detectedCategories.add('removal');
  }

  // Effective CMC: Scalable X spells typically cast for X=2, 3, or 4 in Limited
  // Vivid spells typically cast with 2-3 colors among permanents (-2.5 cost reduction)
  // Toughness cost reduction spells (e.g. Ghalta) typically cast with 4-5 toughness on board (-4.5 cost reduction)
  // Accounting for the Instant Speed Tax (-0.75 for noncreature instant/flash)
  const effectiveCmc = hasXCost
    ? Math.max(3.5, (card.cmc || 0) + 2.5)
    : (isSelfToughnessCostReduction
      ? Math.max(3.5, (card.cmc || 0) - 4.5)
      : ((isVivid && /costs \{\d+\} less.*for each color/i.test(oracle))
        ? Math.max(2, (card.cmc || 0) - 2.5)
        : (((isInstant || hasFlash) && !isCreature) ? Math.max(0.5, (card.cmc || 0) - 0.75) : (card.cmc || 0))));

  const cardColors = (card.colors || []).filter(c => c !== 'C');

  // Effective Power & Toughness accounting for static entry counters & immediate self-ETB counters
  // For Converge and Sunburst creatures, Limited decks average 3 colors of mana spent (+3/+3 in counters)
  const isConvergeOrSunburstCreature = isCreature && (
    isSunburst ||
    /enters(?:\s+the\s+battlefield)?\s+with\s+(?:a\s+)?\+1\/\+1\s+counters?.*(?:for each color of mana spent|converge)/i.test(oracle) ||
    (isConverge && /enters(?:\s+the\s+battlefield)?\s+with.*counter/i.test(oracle))
  );
  const basePower = card.power !== undefined ? parseInt(card.power, 10) : undefined;
  const baseToughness = card.toughness !== undefined ? parseInt(card.toughness, 10) : undefined;
  const counterBoost = isConvergeOrSunburstCreature
    ? (3 + etbSelfCounterCount)
    : (entersWithCountersCount + etbSelfCounterCount);
  let effectivePower = (basePower !== undefined && !isNaN(basePower)) ? basePower + counterBoost : basePower;
  const effectiveToughness = (baseToughness !== undefined && !isNaN(baseToughness)) ? baseToughness + counterBoost : baseToughness;

  // Toughness-based combat damage ("Butt-Strike" & Doran combat pump):
  // When a creature assigns combat damage equal to its toughness rather than its power,
  // or pumps by the difference between power and toughness, its effective combat threat is its toughness!
  if (isCreature && (isToughnessCombatDamage || isToughnessCombatPump)) {
    if (effectiveToughness !== undefined && !isNaN(effectiveToughness)) {
      effectivePower = effectiveToughness;
    }
  }

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
    hasFlying,
    isCombatTrick,
    isAura,
    isAbilityLossAura,
    isFreezeAura,
    isLockdownAura,
    isAuraRemoval,
    createsTokens,
    createsCreatureTokens,
    createsResourceTokens,
    detectedClauses,
    detectedCategories,
    actionSubtypes,
    costProfile,
    valueRiders,
    cmc: card.cmc || 0,
    effectiveCmc,
    hasXCost,
    isHydra,
    entersWithXCounters,
    isTeamCounterDistributor,
    isCombatCounterDistributor,
    isCounterTransferDistributor,
    isConverge,
    isSunburst,
    isVivid,
    isDomain,
    isColorsSpentMechanic,
    isMultiColorScaling,
    isToughnessCombatDamage,
    isDefenderAttackEnabler,
    isToughnessCostReduction,
    isToughnessMatters,
    colors: cardColors,
    creatureSubtypes,
    basePower,
    baseToughness,
    power: effectivePower,
    toughness: effectiveToughness,
    effectivePower,
    effectiveToughness,
    entersWithCountersCount,
    etbSelfCounterCount,
    rarity: (card.rarity || 'common').toLowerCase(),
    cleanOracle: oracle,
    rawOracle,
    isHybrid,
    isConnive,
    isRecruit,
    isModalSpell,
    isTutor,
    isTutorTop,
    isTutorHand,
    isTutorBattlefield,
    isPlaneswalkerTutor,
    isLegendaryTutor,
    hasEmpowerJace,
    empowerJaceCount,
    isTokenAnthem,
    isTeamAnthem,
    isDiscardRemoval,
    isTuckRemoval: actionSubtypes.has('tuck_removal'),
    isEtbTuckRemoval: actionSubtypes.has('etb_tuck_removal'),
    isRemoval: isDiscardRemoval || actionSubtypes.has('tuck_removal') || actionSubtypes.has('etb_tuck_removal') || detectedCategories.has('removal') || isAuraRemoval || actionSubtypes.has('sweeper') || actionSubtypes.has('burn_damage') || actionSubtypes.has('bite_fight') || actionSubtypes.has('permanent_removal') || actionSubtypes.has('unconditional_removal') || actionSubtypes.has('conditional_removal') || actionSubtypes.has('power_toughness_removal') || actionSubtypes.has('toughness_4_plus_removal') || actionSubtypes.has('artifact_enchantment_removal'),
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

  // 0. Sweepers / Board Wipes (Strict: Sweepers ONLY compare to Sweepers)
  // In MTG Limited, board wipes serve a completely unique strategic role and cannot be compared to spot removal, tricks, or token armies.
  const tIsSweeper = tFeatures.actionSubtypes.has('sweeper') || tFeatures.detectedCategories.has('sweeper');
  const cIsSweeper = cFeatures.actionSubtypes.has('sweeper') || cFeatures.detectedCategories.has('sweeper');
  if (tIsSweeper !== cIsSweeper) {
    return false;
  }

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
    // A creature can compare to another creature, or to a spell that produces creature tokens (excluding removal/sweepers)
    return (tFeatures.isCreature && cFeatures.isCreature) ||
           (tFeatures.isCreature && cFeatures.createsCreatureTokens && !cFeatures.isRemoval && !cIsSweeper) ||
           (cFeatures.isCreature && tFeatures.createsCreatureTokens && !tFeatures.isRemoval && !tIsSweeper);
  }

  // 6. Non-permanent spells (Instants & Sorceries)
  const tSpell = tFeatures.isInstant || tFeatures.isSorcery;
  const cSpell = cFeatures.isInstant || cFeatures.isSorcery;

  if (tSpell && cSpell) {
    // Creature Token Army vs Removal gatekeeper:
    // A spell whose primary function is creating creature bodies cannot compare to pure removal or sweepers!
    const tIsTokenArmy = tFeatures.actionSubtypes.has('creature_token_army');
    const cIsTokenArmy = cFeatures.actionSubtypes.has('creature_token_army');
    if (tIsTokenArmy && (cFeatures.isRemoval || cIsSweeper)) return false;
    if (cIsTokenArmy && (tFeatures.isRemoval || tIsSweeper)) return false;

    // Pure library tutor cannot compare to removal spells, combat tricks, sweepers, or counterspells!
    const isPureTutor = (f: ReturnType<typeof extractCardFeatures>) =>
      (f.actionSubtypes.has('library_tutor') || f.detectedCategories.has('tutor')) &&
      !f.isRemoval && !f.isCombatTrick;

    const isNonTutorInteraction = (f: ReturnType<typeof extractCardFeatures>) =>
      (f.isRemoval || f.isCombatTrick || f.detectedCategories.has('counter') || f.detectedCategories.has('sweeper')) &&
      !f.actionSubtypes.has('library_tutor') && !f.detectedCategories.has('tutor');

    if (isPureTutor(tFeatures) && isNonTutorInteraction(cFeatures)) return false;
    if (isPureTutor(cFeatures) && isNonTutorInteraction(tFeatures)) return false;

    // Pure combat tricks must match instant speed (modal removal or spells that also provide removal like Valorous Stance are valid comps for removal)
    const isPureCombatTrick = (f: ReturnType<typeof extractCardFeatures>) =>
      f.isCombatTrick &&
      !f.isRemoval &&
      !f.actionSubtypes.has('power_toughness_removal') &&
      !f.actionSubtypes.has('toughness_4_plus_removal') &&
      !f.actionSubtypes.has('conditional_removal') &&
      !f.actionSubtypes.has('unconditional_removal') &&
      !f.actionSubtypes.has('modal_removal');

    if (isPureCombatTrick(tFeatures) && !cFeatures.isInstant) return false;
    if (isPureCombatTrick(cFeatures) && !tFeatures.isInstant) return false;
    return true;
  }

  // 7. Aura Removal can compare to Sorcery/Instant removal
  if (tFeatures.isAuraRemoval && (cSpell || cFeatures.isAuraRemoval)) {
    if (cIsSweeper) return false;
    return true;
  }
  if (cFeatures.isAuraRemoval && (tSpell || tFeatures.isAuraRemoval)) {
    if (tIsSweeper) return false;
    return true;
  }

  // 8. Artifacts and Enchantments
  if (tFeatures.isArtifact && cFeatures.isArtifact) return true;
  if (tFeatures.isEnchantment && cFeatures.isEnchantment) return true;

  // Non-creature permanent peers (Artifact vs Enchantment for Anthems, Utility, Sagas, Tutors, and Engines)
  if ((tFeatures.isArtifact || tFeatures.isEnchantment) && (cFeatures.isArtifact || cFeatures.isEnchantment)) {
    if (!tFeatures.isEquipment && !cFeatures.isEquipment && !tFeatures.isAura && !cFeatures.isAura) {
      return true;
    }
  }

  // Discard / Channel removal permanent vs Instant / Sorcery removal
  if ((tFeatures.actionSubtypes.has('discard_removal') || tFeatures.actionSubtypes.has('channel_removal')) && cSpell && cFeatures.isRemoval) {
    return true;
  }
  if ((cFeatures.actionSubtypes.has('discard_removal') || cFeatures.actionSubtypes.has('channel_removal')) && tSpell && tFeatures.isRemoval) {
    return true;
  }

  // ETB Removal / Tuck permanents can compare to Instant / Sorcery removal / bounce
  const tIsEtbRemovalOrTuck = tFeatures.actionSubtypes.has('tuck_removal') || tFeatures.actionSubtypes.has('etb_removal') || tFeatures.actionSubtypes.has('etb_tuck_removal');
  const cIsEtbRemovalOrTuck = cFeatures.actionSubtypes.has('tuck_removal') || cFeatures.actionSubtypes.has('etb_removal') || cFeatures.actionSubtypes.has('etb_tuck_removal');

  if (tIsEtbRemovalOrTuck && cSpell && (cFeatures.isRemoval || cFeatures.detectedCategories.has('bounce') || cFeatures.actionSubtypes.has('tuck_removal'))) {
    if (cIsSweeper) return false;
    return true;
  }
  if (cIsEtbRemovalOrTuck && tSpell && (tFeatures.isRemoval || tFeatures.detectedCategories.has('bounce') || tFeatures.actionSubtypes.has('tuck_removal'))) {
    if (tIsSweeper) return false;
    return true;
  }

  return false;
}

/**
 * Construct Scryfall search queries with prioritized fallback tiers.
 * Prioritizes EXACT color matches (e.g. c=w for mono-white) before broadening.
 */
export function buildScryfallQueries(card: Card, features: ReturnType<typeof extractCardFeatures>): string[] {
  const setFilter = `(${COMPARABLE_PREMIER_SETS.map(s => `s:${s.toLowerCase()}`).join(' or ')})`;
  const baseFilter = `-is:reprint -t:basic -t:token -is:extra -is:alchemy ${setFilter}`;

  // Exclude the current set and exact same card name
  const excludeSelf = card.set ? `-s:${card.set.toLowerCase()} -!"${card.name}"` : `-!"${card.name}"`;

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
  } else if (features.isInstant || features.isSorcery) {
    if (features.isCombatTrick) {
      typeFilter = '(t:instant or o:flash)';
    } else {
      typeFilter = '(t:instant or t:sorcery)';
    }
  } else if (features.isAuraRemoval) {
    typeFilter = 't:enchantment';
  } else if (features.isEquipment) {
    typeFilter = 't:equipment';
  } else if (features.isCreature) {
    typeFilter = 't:creature';
  }

  const minCmc = features.actionSubtypes.has('toughness_cost_reduction')
    ? Math.max(2, Math.round(features.effectiveCmc) - 1)
    : Math.max(1, features.cmc - 1);
  const maxCmc = features.actionSubtypes.has('toughness_cost_reduction')
    ? Math.round(features.effectiveCmc) + 1
    : features.cmc + 1;

  const queries: string[] = [];

  // Toughness Combat Damage ("Butt-Strike") & Toughness-Matters Queries
  if (features.actionSubtypes.has('toughness_combat_damage') || features.actionSubtypes.has('toughness_matters_archetype')) {
    queries.push(`${baseFilter} ${excludeSelf} t:creature (o:"assigns combat damage equal to" or o:"toughness greater than its power")`);
    queries.push(`${baseFilter} ${excludeSelf} (o:"assigns combat damage equal to" or o:"toughness greater than its power")`);
    queries.push(`${baseFilter} ${excludeSelf} t:creature (o:"can attack as though" o:defender)`);
    queries.push(`${baseFilter} ${excludeSelf} (o:"where X is the greatest toughness" or o:"greatest toughness among")`);
    queries.push(`${baseFilter} ${excludeSelf} t:creature (c=W or c=G or c=B or c=U) (o:"damage equal to" o:toughness)`);
  }

  // Token Anthems, Team Anthems & Discard / Channel Removal Queries
  if (features.actionSubtypes.has('token_anthem')) {
    queries.push(`${baseFilter} ${excludeSelf} (t:artifact or t:enchantment) ${exactColorQuery} (o:"tokens you control get" or o:"creature tokens you control get")`);
    queries.push(`${baseFilter} ${excludeSelf} (t:artifact or t:enchantment) (o:"tokens you control get" o:vigilance)`);
    queries.push(`${baseFilter} ${excludeSelf} (t:artifact or t:enchantment) ${exactColorQuery} (o:"creatures you control get" o:vigilance)`);
    queries.push(`${baseFilter} ${excludeSelf} (t:artifact or t:enchantment) ${exactColorQuery} cmc>=1 cmc<=3 (o:"tokens you control get" or o:"creatures you control get")`);
  } else if (features.actionSubtypes.has('team_anthem')) {
    queries.push(`${baseFilter} ${excludeSelf} (t:artifact or t:enchantment) ${exactColorQuery} (o:"creatures you control get" o:"+1/+1" or o:"creatures you control get +1/+0")`);
    queries.push(`${baseFilter} ${excludeSelf} (t:artifact or t:enchantment) ${exactColorQuery} cmc>=1 cmc<=3 (o:"creatures you control get")`);
  }
  if (features.actionSubtypes.has('discard_removal')) {
    queries.push(`${baseFilter} ${excludeSelf} (t:instant or t:artifact or t:enchantment) ${exactColorQuery} (o:"deals 4 damage to target attacking or blocking creature" or o:"target attacking or blocking creature")`);
    queries.push(`${baseFilter} ${excludeSelf} (t:artifact or t:enchantment) (o:"discard this card" o:damage)`);
  }

  // Tuck / Library-Bounce Removal Queries
  if (features.actionSubtypes.has('tuck_removal')) {
    queries.push(`${baseFilter} ${excludeSelf} (t:instant or t:sorcery or t:enchantment) ${exactColorQuery} (o:"puts it on their choice of the top or bottom" or o:"top or bottom of their library" or o:"top or bottom of its owner's library")`);
    queries.push(`${baseFilter} ${excludeSelf} ${exactColorQuery} (o:"target nonland permanent" (o:"top or bottom" or o:"owner's library"))`);
    queries.push(`${baseFilter} ${excludeSelf} (t:instant or t:enchantment) ${exactColorQuery} cmc>=${minCmc} cmc<=${maxCmc} (o:"top or bottom" or o:"owner's library")`);
  }

  // Noncreature Spellslinger Surveil Engine Queries
  if (features.actionSubtypes.has('noncreature_surveil_engine') || (features.actionSubtypes.has('noncreature_spell_trigger') && features.actionSubtypes.has('empower_jace'))) {
    queries.push(`${baseFilter} ${excludeSelf} ${exactColorQuery} (o:"whenever you cast a noncreature spell" or o:"whenever you cast your first noncreature spell")`);
    queries.push(`${baseFilter} ${excludeSelf} ${exactColorQuery} (o:"noncreature spell" (o:surveil or o:scry or o:draw))`);
  }

  // Learned Mechanic Bridge Queries (Rosetta Stone):
  // When a card features a mechanic with a learned bridge to historical terms, execute priority queries
  const learnedExpansions = getLearnedQueryExpansions(card);
  if (learnedExpansions.length > 0) {
    learnedExpansions.forEach(exp => {
      queries.push(`${baseFilter} ${excludeSelf} ${typeFilter} ${exactColorQuery} ${exp}`);
      queries.push(`${baseFilter} ${excludeSelf} ${typeFilter} ${exp}`);
    });
  }

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

  // Dedicated Library Search & Tutor Queries (e.g. Loyal Tutor, Search for Glory, Enlightened Tutor, Hobbit Hole, Ecologist's Terrarium)
  if (features.actionSubtypes.has('library_tutor')) {
    const tutorTypeFilter = features.isLand
      ? 't:land'
      : (features.isArtifact ? 't:artifact' : (features.isCreature ? 't:creature' : '(t:instant or t:sorcery)'));
    if (features.actionSubtypes.has('tutor_to_top')) {
      queries.push(`${baseFilter} ${excludeSelf} ${tutorTypeFilter} o:"search your library" (o:"put that card on top" or o:"on top")`);
    }
    if (features.actionSubtypes.has('planeswalker_tutor') || features.actionSubtypes.has('legendary_tutor')) {
      queries.push(`${baseFilter} ${excludeSelf} ${tutorTypeFilter} o:"search your library" (o:"planeswalker" or o:"legendary")`);
    }
    queries.push(`${baseFilter} ${excludeSelf} ${tutorTypeFilter} ${exactColorQuery} o:"search your library"`);
    if (features.cmc > 0) {
      queries.push(`${baseFilter} ${excludeSelf} ${tutorTypeFilter} cmc<=3 o:"search your library"`);
    }
    queries.push(`${baseFilter} ${excludeSelf} ${tutorTypeFilter} o:"search your library"`);
    if (features.isLand) {
      queries.push(`${baseFilter} ${excludeSelf} t:land (o:"search your library for a basic land card" or o:"cycling")`);
      return queries;
    }
    queries.push(`${baseFilter} ${excludeSelf} o:"search your library"`);
    return queries;
  }

  // SIGNATURE ENGINE MECHANIC QUERY (Cross-Color & Archetype-Level)
  // Empower Jace Engine Queries (Functional cross-mechanic queries)
  if (features.actionSubtypes.has('empower_jace')) {
    if (features.isCreature) {
      if (features.empowerJaceCount <= 2) {
        queries.push(`${baseFilter} ${excludeSelf} t:creature (o:surveil or o:scry) cmc>=${minCmc} cmc<=${maxCmc}`);
        queries.push(`${baseFilter} ${excludeSelf} t:creature ${exactColorQuery} (o:surveil or o:scry)`);
        queries.push(`${baseFilter} ${excludeSelf} t:creature (o:"when" o:"enters" (o:surveil or o:scry))`);
      } else {
        queries.push(`${baseFilter} ${excludeSelf} t:creature (o:"when" o:"enters" o:"draw a card") cmc>=${minCmc} cmc<=${maxCmc}`);
        queries.push(`${baseFilter} ${excludeSelf} t:creature ${exactColorQuery} (o:"when" o:"enters" o:"draw a card")`);
      }
    } else if (features.isInstant || features.isSorcery) {
      if (features.actionSubtypes.has('hard_counter') || features.detectedCategories.has('counter')) {
        queries.push(`${baseFilter} ${excludeSelf} t:instant (o:"counter target" (o:amass or o:token or o:investigate))`);
        queries.push(`${baseFilter} ${excludeSelf} t:instant ${exactColorQuery} cmc>=${minCmc} cmc<=${maxCmc} o:"counter target spell"`);
      } else if (features.isCombatTrick) {
        queries.push(`${baseFilter} ${excludeSelf} t:instant (o:"target creature gets" (o:investigate or o:draw or o:amass))`);
      } else if (features.empowerJaceCount >= 6) {
        queries.push(`${baseFilter} ${excludeSelf} (t:instant or t:sorcery) ${exactColorQuery} cmc>=${minCmc} cmc<=${maxCmc} (o:"draw three" or o:"draw two")`);
      } else if (features.createsTokens) {
        queries.push(`${baseFilter} ${excludeSelf} (t:instant or t:sorcery) (o:"create" o:"tokens" (o:scry or o:surveil or o:draw))`);
      }
    }
  }

  // Sweepers / Board Wipes
  if (features.actionSubtypes.has('sweeper') || features.detectedCategories.has('sweeper')) {
    queries.push(`${baseFilter} ${excludeSelf} (t:instant or t:sorcery) ${exactColorQuery} (o:"destroy all creatures" or o:"damage to each creature" or o:"exile all creatures" or o:"each creature gets -")`);
    queries.push(`${baseFilter} ${excludeSelf} (t:instant or t:sorcery) (o:"destroy all creatures" or o:"damage to each creature" or o:"exile all creatures")`);
  }

  // Creature Token Army Spells
  if (features.actionSubtypes.has('creature_token_army')) {
    queries.push(`${baseFilter} ${excludeSelf} (t:instant or t:sorcery) ${exactColorQuery} cmc>=${minCmc} cmc<=${maxCmc} (o:"create" (o:"creature token" or o:"creature tokens" or o:"tokens"))`);
    queries.push(`${baseFilter} ${excludeSelf} (t:instant or t:sorcery) ${exactColorQuery} (o:"create" (o:"creature token" or o:"creature tokens"))`);
    queries.push(`${baseFilter} ${excludeSelf} (t:instant or t:sorcery) cmc>=${minCmc} cmc<=${maxCmc} (o:"create" (o:"creature token" or o:"creature tokens"))`);
  }

  // Lifegain Payoffs
  if (features.actionSubtypes.has('lifegain_payoff')) {
    queries.push(`${baseFilter} ${excludeSelf} ${typeFilter} ${exactColorQuery} (o:"life you gained" or o:"gained life" or o:"gain life")`);
    queries.push(`${baseFilter} ${excludeSelf} ${typeFilter} (o:"life you gained" or o:"gained life")`);
  }

  if (features.actionSubtypes.has('second_card_drawn')) {
    queries.push(`${baseFilter} ${excludeSelf} (o:"second card each turn" or o:"second card")`);
  }
  if (features.actionSubtypes.has('etb_self_bounce')) {
    queries.push(`${baseFilter} ${excludeSelf} t:creature (o:"when" o:"enters" o:"return" o:"permanent you control to its owner's hand")`);
    queries.push(`${baseFilter} ${excludeSelf} t:creature (o:"when" o:"enters" o:"return another target permanent")`);
  }
  if (features.actionSubtypes.has('death_amass_token')) {
    queries.push(`${baseFilter} ${excludeSelf} t:creature (o:"when" o:"dies" (o:"amass" or o:"create" or o:"token"))`);
  }
  if (features.actionSubtypes.has('etb_sac_removal')) {
    queries.push(`${baseFilter} ${excludeSelf} t:creature (o:"enters" o:"sacrifice another" (o:"destroy" or o:"deals damage" or o:"excess damage"))`);
  }
  if (features.actionSubtypes.has('power_4_plus_synergy')) {
    queries.push(`${baseFilter} ${excludeSelf} (o:"creature with power 4 or greater" or o:"power 4 or greater")`);
  }
  if (features.actionSubtypes.has('landfall_payoff')) {
    queries.push(`${baseFilter} ${excludeSelf} (o:landfall or o:"whenever a land you control enters")`);
  }
  if (features.actionSubtypes.has('unblockable_granter')) {
    queries.push(`${baseFilter} ${excludeSelf} o:"target creature can't be blocked"`);
  }
  if (features.actionSubtypes.has('cultivate_ramp')) {
    queries.push(`${baseFilter} ${excludeSelf} (o:"search your library for up to two" or o:"search your library for two") o:"land"`);
  }
  if (features.actionSubtypes.has('fetch_land')) {
    queries.push(`${baseFilter} ${excludeSelf} t:land o:"search your library for a basic land card"`);
    queries.push(`${baseFilter} ${excludeSelf} t:land (o:"search your library" or o:"cycling")`);
  }
  if (features.actionSubtypes.has('aura_gy_recursion')) {
    queries.push(`${baseFilter} ${excludeSelf} t:enchantment (o:"enchant creature" or o:"aura") (o:"graveyard" or o:"convoke")`);
  }
  if (features.actionSubtypes.has('basic_tutor_artifact')) {
    queries.push(`${baseFilter} ${excludeSelf} t:artifact (o:"search your library for a basic land card" or o:"basic land card, reveal it, put it into your hand")`);
  }
  if (features.actionSubtypes.has('ramp_token_producer')) {
    queries.push(`${baseFilter} ${excludeSelf} (o:"heartwood token" or o:"powerstone token" or o:"treasure token")`);
    queries.push(`${baseFilter} ${excludeSelf} (o:"create" o:"token" (o:"{t}: add" or o:"powerstone" or o:"heartwood"))`);
    queries.push(`${baseFilter} ${excludeSelf} t:creature (o:"{t}: add" or o:"powerstone" or o:"heartwood")`);
    queries.push(`${baseFilter} ${excludeSelf} o:"heartwood token"`);
  }
  if (features.actionSubtypes.has('artifact_animator_aura')) {
    queries.push(`${baseFilter} ${excludeSelf} t:enchantment (o:"enchant artifact" or o:"enchanted artifact") (o:"base power and toughness" or o:"creature")`);
    queries.push(`${baseFilter} ${excludeSelf} (o:"enchant artifact" or o:"enchant permanent") (o:"5/5" or o:"5/4" or o:"4/4" or o:"construct" or o:"golem")`);
  }
  if (features.actionSubtypes.has('artifact_sacrifice_payoff')) {
    queries.push(`${baseFilter} ${excludeSelf} (o:"sacrifice an artifact" or o:"sacrifice another artifact")`);
    queries.push(`${baseFilter} ${excludeSelf} t:creature (o:"sacrifice an artifact" or o:"sacrifice another artifact")`);
  }
  if (features.actionSubtypes.has('artifact_tap_payoff')) {
    queries.push(`${baseFilter} ${excludeSelf} (o:"tap an untapped artifact" or o:"tap two untapped artifacts" or o:"untapped artifacts you control")`);
  }
  if (features.actionSubtypes.has('two_drop_mana_dork')) {
    queries.push(`${baseFilter} ${excludeSelf} t:creature ${exactColorQuery} cmc=2 o:"{t}: add"`);
    queries.push(`${baseFilter} ${excludeSelf} t:creature cmc=2 o:"{t}: add"`);
    queries.push(`${baseFilter} ${excludeSelf} t:creature ${exactColorQuery} cmc<=2 (o:"{t}: add" or o:"add one mana")`);
  } else if (features.actionSubtypes.has('three_drop_mana_dork')) {
    queries.push(`${baseFilter} ${excludeSelf} t:creature ${exactColorQuery} cmc=3 o:"{t}: add"`);
    queries.push(`${baseFilter} ${excludeSelf} t:creature cmc=3 o:"{t}: add"`);
  }
  if (features.actionSubtypes.has('mana_rock')) {
    queries.push(`${baseFilter} ${excludeSelf} t:artifact -t:creature cmc>=2 cmc<=3 o:"{t}: add"`);
    queries.push(`${baseFilter} ${excludeSelf} t:artifact -t:creature cmc=3 o:"{t}: add"`);
  }
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
  if (features.actionSubtypes.has('land_tutor_top')) {
    queries.push(`${baseFilter} ${excludeSelf} t:creature cmc>=${minCmc} cmc<=${maxCmc} (o:"search your library" o:"land" o:"on top")`);
    queries.push(`${baseFilter} ${excludeSelf} t:creature (o:"search your library" o:"land" o:"on top")`);
  }
  if (features.actionSubtypes.has('flying_lifegain_evasion')) {
    queries.push(`${baseFilter} ${excludeSelf} t:creature cmc=${features.cmc} pow=${features.power} tou=${features.toughness} o:flying (o:"gain" or o:lifelink)`);
    queries.push(`${baseFilter} ${excludeSelf} t:creature cmc>=${minCmc} cmc<=${maxCmc} o:flying (o:"gain" or o:lifelink)`);
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
  } else if (
    features.actionSubtypes.has('toughness_4_plus_removal') ||
    /toughness [456] or greater/i.test(card.oracle_text || '')
  ) {
    queries.push(`${baseFilter} ${excludeSelf} (t:instant or t:sorcery) ${exactColorQuery} cmc>=${minCmc} cmc<=${maxCmc} (o:"toughness" or o:"power") (o:"greater" or o:"less")`);
    queries.push(`${baseFilter} ${excludeSelf} (t:instant or t:sorcery) ${exactColorQuery} o:"toughness" o:"greater"`);
    queries.push(`${baseFilter} ${excludeSelf} (t:instant or t:sorcery) ${exactColorQuery} o:"choose one"`);
    queries.push(`${baseFilter} ${excludeSelf} (t:instant or t:sorcery) ${exactColorQuery} cmc=${features.cmc} (o:"destroy target" or o:"exile target")`);
    queries.push(`${baseFilter} ${excludeSelf} (t:instant or t:sorcery) ${exactColorQuery} cmc>=${minCmc} cmc<=${maxCmc} (o:"destroy target" or o:"exile target")`);
  } else if (
    features.actionSubtypes.has('unconditional_removal') ||
    features.actionSubtypes.has('removal_with_compensation') ||
    features.actionSubtypes.has('combat_removal') ||
    features.actionSubtypes.has('conditional_removal') ||
    features.actionSubtypes.has('power_toughness_removal')
  ) {
    queries.push(`${baseFilter} ${excludeSelf} (t:instant or t:sorcery) ${exactColorQuery} cmc=${features.cmc} (o:"destroy target" or o:"exile target")`);
    queries.push(`${baseFilter} ${excludeSelf} (t:instant or t:sorcery) ${exactColorQuery} cmc>=${minCmc} cmc<=${maxCmc} (o:"destroy target" or o:"exile target")`);
    if (features.actionSubtypes.has('removal_with_compensation')) {
      queries.push(`${baseFilter} ${excludeSelf} (t:instant or t:sorcery) ${exactColorQuery} (o:"draws a card" or o:"investigates" or o:"creates" or o:"gift")`);
    }
  }

  if (features.isAuraRemoval) {
    if (features.actionSubtypes.has('ability_loss_aura')) {
      queries.push(`${baseFilter} ${excludeSelf} t:enchantment ${exactColorQuery} cmc=${features.cmc} (o:"loses all abilities" or o:"lose all abilities" or o:"has no abilities" or o:"base power and toughness")`);
      queries.push(`${baseFilter} ${excludeSelf} t:enchantment ${exactColorQuery} (o:"loses all abilities" or o:"lose all abilities" or o:"has no abilities" or o:"base power and toughness")`);
      queries.push(`${baseFilter} ${excludeSelf} t:enchantment (o:"loses all abilities" or o:"lose all abilities" or o:"has no abilities" or o:"base power and toughness")`);
    }
    if (features.actionSubtypes.has('freeze_aura')) {
      queries.push(`${baseFilter} ${excludeSelf} t:enchantment ${exactColorQuery} cmc=${features.cmc} (o:"doesn't untap" or o:"tap enchanted" or o:"stun counter")`);
      queries.push(`${baseFilter} ${excludeSelf} t:enchantment ${exactColorQuery} cmc>=${minCmc} cmc<=${maxCmc} (o:"doesn't untap" or o:"tap enchanted" or o:"stun counter")`);
      queries.push(`${baseFilter} ${excludeSelf} t:enchantment ${exactColorQuery} (o:"doesn't untap" or o:"tap enchanted" or o:"stun counter")`);
    }
    if (features.actionSubtypes.has('pacifism_aura')) {
      queries.push(`${baseFilter} ${excludeSelf} t:enchantment ${exactColorQuery} cmc>=${minCmc} cmc<=${maxCmc} (o:"can't attack" or o:"can't block" or o:"doesn't untap")`);
      queries.push(`${baseFilter} ${excludeSelf} t:enchantment (o:"can't attack" or o:"can't block" or o:"doesn't untap")`);
    }
    queries.push(`${baseFilter} ${excludeSelf} t:enchantment ${exactColorQuery} cmc=${features.cmc} (o:"enchant creature" or o:"enchanted creature")`);
    queries.push(`${baseFilter} ${excludeSelf} t:enchantment ${exactColorQuery} cmc>=${minCmc} cmc<=${maxCmc} (o:"enchant creature" or o:"enchanted creature")`);
    queries.push(`${baseFilter} ${excludeSelf} t:enchantment ${exactColorQuery} (o:"enchant creature" or o:"enchanted creature")`);
    queries.push(`${baseFilter} ${excludeSelf} (t:instant or t:sorcery) ${exactColorQuery} cmc>=${minCmc} cmc<=${maxCmc} (o:"destroy target" or o:"exile target" or o:"tap target")`);
  }

  if (features.actionSubtypes.has('burn_damage')) {
    queries.push(`${baseFilter} ${excludeSelf} (t:instant or t:sorcery) ${exactColorQuery} cmc>=${minCmc} cmc<=${maxCmc} o:"deals" o:"damage to"`);
  }


  if (features.actionSubtypes.has('death_counter_transfer')) {
    queries.push(`${baseFilter} ${excludeSelf} t:creature ${exactColorQuery} (o:"dies" (o:"counters on" or o:"distribute its counters"))`);
    queries.push(`${baseFilter} ${excludeSelf} t:creature (o:"dies" (o:"counters on" or o:"distribute its counters") or o:modular)`);
    queries.push(`${baseFilter} ${excludeSelf} t:creature ${exactColorQuery} cmc=${features.cmc} (o:"dies" or o:"+1/+1 counter")`);
  }

  if (features.hasXCost || features.actionSubtypes.has('enters_with_x_counters')) {
    queries.push(`${baseFilter} ${excludeSelf} m:{X} t:creature ${exactColorQuery}`);
    queries.push(`${baseFilter} ${excludeSelf} m:{X} t:creature (o:"enters with" o:"counter")`);
    queries.push(`${baseFilter} ${excludeSelf} t:creature ${exactColorQuery} (o:"put a +1/+1 counter on each other creature you control" or o:"put a +1/+1 counter on each creature you control")`);
    queries.push(`${baseFilter} ${excludeSelf} t:creature ${exactColorQuery} (o:"at the beginning of combat on your turn" o:"counter")`);
    queries.push(`${baseFilter} ${excludeSelf} (t:hydra or o:"enters with x +1/+1 counters")`);
    queries.push(`${baseFilter} ${excludeSelf} m:{X} t:creature`);
    queries.push(`${baseFilter} ${excludeSelf} m:{X} ${exactColorQuery}`);
  } else if (features.actionSubtypes.has('team_counter_distributor')) {
    queries.push(`${baseFilter} ${excludeSelf} t:creature ${exactColorQuery} (o:"put a +1/+1 counter on each other creature you control" or o:"put a +1/+1 counter on each creature you control")`);
  }

  if (features.actionSubtypes.has('enters_with_counters') && !features.hasXCost) {
    queries.push(`${baseFilter} ${excludeSelf} t:creature ${exactColorQuery} cmc=${features.cmc} (o:"enters with" o:"+1/+1 counter")`);
    queries.push(`${baseFilter} ${excludeSelf} t:creature ${exactColorQuery} (o:"enters with" o:"+1/+1 counter")`);
  }

  if (features.actionSubtypes.has('triggered_growth_other_enters')) {
    queries.push(`${baseFilter} ${excludeSelf} t:creature ${exactColorQuery} cmc=${features.cmc} (o:"whenever another" o:"enters" o:"+1/+1 counter")`);
    queries.push(`${baseFilter} ${excludeSelf} t:creature (o:"whenever another" o:"enters" o:"+1/+1 counter")`);
  }

  if (features.actionSubtypes.has('etb_counter_distributor') || features.actionSubtypes.has('etb_counter_self')) {
    queries.push(`${baseFilter} ${excludeSelf} t:creature ${exactColorQuery} cmc=${features.cmc} (o:"when" o:"enters" o:"+1/+1 counter" or o:"explores")`);
    queries.push(`${baseFilter} ${excludeSelf} t:creature ${exactColorQuery} cmc>=${minCmc} cmc<=${maxCmc} (o:"when" o:"enters" o:"+1/+1 counter" or o:"explores")`);
  }

  // Multicolor Scaling & Domain / Converge / Sunburst / Vivid Queries
  if (features.isMultiColorScaling || features.actionSubtypes.has('converge_sunburst') || features.actionSubtypes.has('domain_vivid_scaling')) {
    queries.push(`${baseFilter} ${excludeSelf} t:creature (o:converge or o:sunburst or kw:vivid or o:domain)`);
    queries.push(`${baseFilter} ${excludeSelf} t:creature (o:"color of mana spent" or o:"colors of mana spent" or o:"colors among permanents" or o:"number of colors")`);
    if (features.colors.length === 0) {
      queries.push(`${baseFilter} ${excludeSelf} t:creature (o:converge or o:sunburst or o:counter)`);
      queries.push(`${baseFilter} ${excludeSelf} t:creature c=c (o:reach or o:trample or o:counter)`);
    }
    const hasReach = (card.keywords || []).some(k => /reach/i.test(k)) || /reach/i.test(card.oracle_text || '');
    const hasTrample = (card.keywords || []).some(k => /trample/i.test(k)) || /trample/i.test(card.oracle_text || '');
    if (hasReach || hasTrample) {
      queries.push(`${baseFilter} ${excludeSelf} t:creature (o:reach or o:trample) (o:converge or o:sunburst or kw:vivid or o:domain)`);
    }
  }

  if (features.actionSubtypes.has('activated_team_pump')) {
    queries.push(`${baseFilter} ${excludeSelf} t:creature ${exactColorQuery} (o:"creatures you control get +1/+1" or o:"creatures you control get")`);
    queries.push(`${baseFilter} ${excludeSelf} t:creature ${exactColorQuery} cmc>=${minCmc} cmc<=${maxCmc} (o:":" o:"creatures you control get")`);
    if (features.hasFlying) {
      queries.push(`${baseFilter} ${excludeSelf} t:creature ${exactColorQuery} o:"flying" (o:"creatures you control get" or o:":" o:"+1/+1")`);
    }
    queries.push(`${baseFilter} ${excludeSelf} t:creature ${exactColorQuery} cmc>=${minCmc} cmc<=${maxCmc} o:"creatures you control get +1/+1"`);
  } else if (features.actionSubtypes.has('team_pump')) {
    queries.push(`${baseFilter} ${excludeSelf} t:creature ${exactColorQuery} (o:"creatures you control get +1/+1" or o:"other creatures you control get")`);
    queries.push(`${baseFilter} ${excludeSelf} t:creature ${exactColorQuery} cmc>=${minCmc} cmc<=${maxCmc} o:"creatures you control get"`);
  }

  // Signature creature subtypes: ONLY query if card explicitly has tribal mechanics/synergies referencing that subtype!
  // In MTG Limited, creature subtype is purely cosmetic unless the card is a tribal payoff/lord.
  const isTribalPayoff = features.creatureSubtypes.some(s =>
    !['human', 'soldier', 'warrior', 'druid', 'wizard', 'cleric', 'rogue', 'citizen', 'scout'].includes(s) &&
    features.cleanOracle.includes(s)
  );
  if (isTribalPayoff) {
    const signatureSubtypes = features.creatureSubtypes.filter(s =>
      !['human', 'soldier', 'warrior', 'druid', 'wizard', 'cleric', 'rogue', 'citizen', 'scout'].includes(s) &&
      features.cleanOracle.includes(s)
    );
    if (signatureSubtypes.length > 0) {
      queries.push(`${baseFilter} ${excludeSelf} t:creature ${exactColorQuery} t:${signatureSubtypes[0]} cmc>=${minCmc} cmc<=${maxCmc}`);
    }
  }

  // METHOD 1 LEXICAL QUERY TIERS (Clauses, Keywords, Statlines)
  if (features.detectedClauses.length > 0) {
    for (const clause of features.detectedClauses.slice(0, 2)) {
      if (clause.category === 'token' || clause.category === 'token_creature' || clause.category === 'token_resource' || clause.category === 'token_army') {
        // Skip quoting literal hyper-specific token clauses (e.g. "create x 2/2 colorless wizard soldier creature tokens")
        continue;
      }
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

  // Matching Statline for creatures (only for fixed-stat/fixed-cost creatures)
  if (!features.hasXCost && features.isCreature && features.power !== undefined && features.toughness !== undefined) {
    queries.push(
      `${baseFilter} ${excludeSelf} ${typeFilter} ${exactColorQuery} cmc=${features.cmc} pow=${features.power} tou=${features.toughness}`
    );
    queries.push(
      `${baseFilter} ${excludeSelf} ${typeFilter} ${exactColorQuery} cmc=${features.cmc} pow=${features.power}`
    );
  }

  // Exact CMC & CMC ±1 (only for fixed-cost cards)
  if (!features.hasXCost) {
    queries.push(
      `${baseFilter} ${excludeSelf} ${typeFilter} ${exactColorQuery} cmc=${features.cmc}`
    );
    queries.push(
      `${baseFilter} ${excludeSelf} ${typeFilter} ${exactColorQuery} cmc>=${minCmc} cmc<=${maxCmc}`
    );
  }

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
 * Normalizes oracle text for checking exact functional reprints.
 * Removes reminder text (in parentheses), replaces card's own name with '~',
 * normalizes whitespace, and lowercases.
 */
export function normalizeOracleForReprintCheck(text: string, cardName: string): string {
  if (!text) return '';
  // Remove reminder text
  let cleaned = text.replace(/\([^)]*\)/g, '');
  // Normalize self-referential card name
  if (cardName) {
    const escaped = cardName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    cleaned = cleaned.replace(new RegExp(escaped, 'gi'), '~');
  }
  // Normalize whitespace and punctuation
  return cleaned
    .toLowerCase()
    .replace(/[.,:;!'"\u2019\u2018]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if candidate is an actual direct reprint of target (same card name across sets).
 */
export function isActualReprint(target: Card, candidate: Card): boolean {
  const targetName = (target.name || '').trim().toLowerCase();
  const candName = (candidate.name || '').trim().toLowerCase();
  return Boolean(targetName && candName && targetName === candName);
}

/**
 * Checks if candidate is an exact functional reprint of target (different name,
 * but identical cost, stats, types, keywords, and oracle text).
 */
export function isExactFunctionalReprint(target: Card, candidate: Card): boolean {
  if (isActualReprint(target, candidate)) return false;

  // Must match CMC, mana cost, and color identity
  if (target.cmc !== candidate.cmc) return false;
  if ((target.mana_cost || '') !== (candidate.mana_cost || '')) return false;

  const tColorId = [...(target.color_identity || [])].sort().join('');
  const cColorId = [...(candidate.color_identity || [])].sort().join('');
  if (tColorId !== cColorId) return false;

  // Core type matching: creature, instant, sorcery, artifact, enchantment, planeswalker, battle, land
  const coreTypes = ['creature', 'instant', 'sorcery', 'artifact', 'enchantment', 'planeswalker', 'battle', 'land'];
  const tTypeLine = (target.type_line || '').toLowerCase();
  const cTypeLine = (candidate.type_line || '').toLowerCase();
  for (const t of coreTypes) {
    if (tTypeLine.includes(t) !== cTypeLine.includes(t)) {
      return false;
    }
  }

  // Legendary status must match
  if (tTypeLine.includes('legendary') !== cTypeLine.includes('legendary')) {
    return false;
  }

  // Creature stats matching
  if (tTypeLine.includes('creature')) {
    if (target.power !== candidate.power || target.toughness !== candidate.toughness) {
      return false;
    }
  }

  // Keyword matching
  const tKeywords = [...(target.keywords || [])].map(k => k.toLowerCase().trim()).sort();
  const cKeywords = [...(candidate.keywords || [])].map(k => k.toLowerCase().trim()).sort();
  if (tKeywords.length !== cKeywords.length) return false;
  for (let i = 0; i < tKeywords.length; i++) {
    if (tKeywords[i] !== cKeywords[i]) return false;
  }

  // Normalized oracle text matching
  const tNorm = normalizeOracleForReprintCheck(target.oracle_text || '', target.name);
  const cNorm = normalizeOracleForReprintCheck(candidate.oracle_text || '', candidate.name);
  return tNorm === cNorm;
}

/**
 * Normalizes oracle text specifically for exact clause and rules matching:
 * - Strips reminder text in parentheses
 * - Normalizes self-referential card names (and 1-word first names for legends) to '~'
 * - Normalizes 'this creature', 'this spell', 'this artifact', 'this permanent' to '~'
 * - Normalizes BLB / modern wording variations: 'enters the battlefield' -> 'enters'
 * - Standardizes apostrophes: didn't -> didnt, doesn't -> doesnt, can't -> cant
 * - Strips punctuation and normalizes spacing
 */
export function normalizeOracleClause(clause: string, cardName: string): string {
  if (!clause) return '';
  let cleaned = clause.replace(/\([^)]*\)/g, '');
  if (cardName) {
    const escaped = cardName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    cleaned = cleaned.replace(new RegExp(escaped, 'gi'), '~');
    // Also strip first name for legendary creatures (e.g. 'Ghalta', 'Doran', 'Mikaeus')
    const firstName = cardName.trim().split(/[\s,]+/)[0];
    if (firstName && firstName.length >= 4) {
      const escFirst = firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      cleaned = cleaned.replace(new RegExp(`\\b${escFirst}\\b`, 'gi'), '~');
    }
  }
  cleaned = cleaned.replace(/\bthis (creature|spell|artifact|permanent|enchantment|planeswalker)\b/gi, '~');
  cleaned = cleaned.replace(/\benters the battlefield\b/gi, 'enters');
  cleaned = cleaned.replace(/didn['’]t/gi, 'didnt');
  cleaned = cleaned.replace(/doesn['’]t/gi, 'doesnt');
  cleaned = cleaned.replace(/can['’]t/gi, 'cant');
  return cleaned
    .toLowerCase()
    .replace(/[.,:;!'"\u2019\u2018]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts substantive rules clauses from a card's oracle text.
 * Ignores standalone 1-2 word keywords (flying, reach, etc.), isolating substantive mechanics.
 */
export function extractSubstantiveOracleClauses(oracleText: string, cardName: string): string[] {
  if (!oracleText) return [];
  const lines = oracleText.split(/\n+/);
  const rawClauses: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // If the line is just a list of keywords like "Reach, trample" or "Flying", skip it
    const keywordOnly = trimmed.split(/,\s*/).every(word => {
      const w = word.trim().toLowerCase();
      return ['flying', 'reach', 'trample', 'vigilance', 'haste', 'hexproof', 'indestructible', 'lifelink', 'deathtouch', 'first strike', 'double strike', 'menace', 'defender', 'flash'].includes(w);
    });
    if (keywordOnly) continue;

    // Do not split activated abilities or lines containing riders/restrictions into disjoint sentences
    const hasRestriction = /spend this mana only|activate only|if this mana|as a sorcery|activate this ability only/i.test(trimmed);
    if (hasRestriction || /^[^{]*\{[^}]+\}.*:/i.test(trimmed)) {
      rawClauses.push(trimmed);
    } else {
      // Split line into sentences
      const sentences = trimmed.split(/\.\s+/);
      for (const sent of sentences) {
        const cleanSent = sent.trim();
        if (!cleanSent) continue;
        rawClauses.push(cleanSent);
      }
    }
  }

  const normalizedClauses: string[] = [];
  for (const rc of rawClauses) {
    const norm = normalizeOracleClause(rc, cardName);
    if (!norm) continue;

    // Generic boilerplate mana rock / dork text (e.g. "{t}: add one mana of any color" or "{t}: add {c}")
    // is a standard utility mechanic evaluated under Pillar 4, NOT a unique substantive rules clause for Directive 2
    const isGenericMana = /^\{?t\}?\s*add\s*(one mana of any color|[wubrgc0-9]+|c)$/i.test(norm) ||
      norm === 't add one mana of any color' ||
      norm === 't add c';
    if (isGenericMana) continue;

    const words = norm.split(' ');
    // A substantive clause must be at least 5 words, OR contain a signature mechanic phrase
    const isSignature = /assigns combat damage equal to|toughness greater than|can attack as though|for each color of mana spent|converge|sunburst|vivid|greatest toughness among|difference between.*power and toughness|tokens you control get|creatures you control get|deals \d+ damage to target attacking or blocking|puts it on (?:their choice of )?the top or bottom|top or bottom of (?:their|its owner's) library|puts target .* on top of its owner's library/i.test(norm);
    if (words.length >= 5 || isSignature) {
      normalizedClauses.push(norm);
    }
  }

  return normalizedClauses;
}

export interface OracleClauseMatchResult {
  matchType: 'exact' | 'template' | 'subject_relaxed' | 'channel_discard' | 'tuck_exact' | 'tuck_relaxed';
  matchingClause: string;
  statBuffDelta?: number;
  description: string;
}

export function normalizeClauseTemplate(clause: string): { template: string; pBuff?: number; tBuff?: number } {
  let pBuff: number | undefined = undefined;
  let tBuff: number | undefined = undefined;
  const match = clause.match(/\+([0-9x]+)\/\+([0-9x]+)/i);
  if (match) {
    pBuff = match[1].toLowerCase() === 'x' ? 0 : parseInt(match[1], 10);
    tBuff = match[2].toLowerCase() === 'x' ? 0 : parseInt(match[2], 10);
  }
  const template = clause.replace(/\+[0-9x]+\/\+[0-9x]+/gi, '+P/+T');
  return { template, pBuff, tBuff };
}

export function extractCoreEffect(clause: string): string {
  let res = clause.replace(/^(?:\{[^}]+\}|\d+|[wubrgc]|\s|,)+discard (?:this card|~):\s*/i, '');
  res = res.replace(/^(?:channel\s*—\s*)?(?:\{[^}]+\}|\d+|[wubrgc]|\s|,)*discard (?:this card|~):\s*/i, '');
  res = res.replace(/^(?:it|~) deals/i, 'deals');
  return res.trim();
}

export function normalizeTuckClause(clause: string): { normalized: string; isTuck: boolean; targetsNonland: boolean } {
  let res = clause.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const isTuck = /puts it on (?:their choice of )?the (?:top or bottom|top|bottom) of (?:their|its owner s|its owners)\s+library|puts? target .* (?:on|into) (?:the )?(?:top or bottom|top|bottom) of (?:its owner s|its owners|their)\s+library/i.test(res);
  if (!isTuck) return { normalized: res, isTuck: false, targetsNonland: false };

  const targetsNonland = /nonland permanent/i.test(res);

  // Strip ETB prefix if permanent
  res = res.replace(/^when (?:this (?:enchantment|artifact|creature)|~)?\s*enters\s*/i, '');
  // Normalize subject prefix
  res = res.replace(/^(?:the owner of )?.*?\btarget (nonland permanent|artifact or creature|creature|permanent)s?(?: owner)? puts it on/i, 'target $1 owner puts it on');
  res = res.replace(/^target (nonland permanent|artifact or creature|creature|permanent)s? owner puts it on/i, 'target $1 owner puts it on');
  res = res.replace(/^put target (nonland permanent|artifact or creature|creature|permanent) on/i, 'target $1 owner puts it on');
  // Normalize library destination
  res = res.replace(/\btheir choice of the top or bottom\b/g, 'the top or bottom');
  res = res.replace(/\b(?:the )?top of\b/g, 'the top or bottom of');
  res = res.replace(/\b(?:their|its owners?|its owner s?)\s+library\b/g, 'library');
  return { normalized: res.trim(), isTuck: true, targetsNonland };
}

/**
 * Checks whether target and candidate share an exact oracle clause / core rules text,
 * or a structural template (e.g. creature tokens you control get +P/+T and have vigilance),
 * or a relaxed subject anthem, or a channel/discard activated effect, or a library-tuck removal effect.
 * Returns match details if found, or null otherwise.
 */
export function findExactOracleClauseMatch(
  target: Card,
  candidate: Card,
  tFeatures: ReturnType<typeof extractCardFeatures>,
  cFeatures: ReturnType<typeof extractCardFeatures>
): OracleClauseMatchResult | null {
  const tClauses = extractSubstantiveOracleClauses(target.oracle_text || '', target.name);
  const cClauses = extractSubstantiveOracleClauses(candidate.oracle_text || '', candidate.name);

  // 1. Literal Verbatim Match (Anchor 95%)
  for (const tc of tClauses) {
    for (const cc of cClauses) {
      if (tc === cc) {
        return {
          matchType: 'exact',
          matchingClause: tc,
          description: 'Exact matching rules text',
        };
      }
    }
  }

  // 2. Parameterized Template Match (Anchor 94%, deduct for buff delta)
  for (const tc of tClauses) {
    const tTpl = normalizeClauseTemplate(tc);
    for (const cc of cClauses) {
      const cTpl = normalizeClauseTemplate(cc);
      if (tTpl.template === cTpl.template && (tTpl.pBuff !== undefined || cTpl.pBuff !== undefined)) {
        const statBuffDelta = (Math.abs((tTpl.pBuff ?? 0) - (cTpl.pBuff ?? 0))) +
                              (Math.abs((tTpl.tBuff ?? 0) - (cTpl.tBuff ?? 0)));
        return {
          matchType: 'template',
          matchingClause: tc,
          statBuffDelta,
          description: 'Matching rules text template',
        };
      }
    }
  }

  // 3. Subject-Decomposed Anthem Match (Anchor 87%)
  for (const tc of tClauses) {
    const tTpl = normalizeClauseTemplate(tc);
    const tRelaxed = tTpl.template
      .replace(/\bcreature tokens you control get\b/g, 'creatures you control get')
      .replace(/\btokens you control get\b/g, 'creatures you control get');

    for (const cc of cClauses) {
      const cTpl = normalizeClauseTemplate(cc);
      const cRelaxed = cTpl.template
        .replace(/\bcreature tokens you control get\b/g, 'creatures you control get')
        .replace(/\btokens you control get\b/g, 'creatures you control get');

      if (tRelaxed === cRelaxed && tRelaxed.includes('creatures you control get')) {
        const statBuffDelta = (Math.abs((tTpl.pBuff ?? 0) - (cTpl.pBuff ?? 0))) +
                              (Math.abs((tTpl.tBuff ?? 0) - (cTpl.tBuff ?? 0)));
        return {
          matchType: 'subject_relaxed',
          matchingClause: tc,
          statBuffDelta,
          description: 'Matching anthem / team buff rules text',
        };
      }
    }
  }

  // 4. Channel / Discard Ability Core Effect Match (Anchor 88%)
  for (const tc of tClauses) {
    const tEffect = extractCoreEffect(tc);
    if (tEffect.length >= 15 && tEffect.split(' ').length >= 4) {
      for (const cc of cClauses) {
        const cEffect = extractCoreEffect(cc);
        if (tEffect === cEffect) {
          return {
            matchType: 'channel_discard',
            matchingClause: tc,
            description: 'Matching activated / channel effect',
          };
        }
      }
    }
  }

  // 5. Tuck / Library-Bounce Removal Match (Anchor 90% for exact nonland, 86% for relaxed target)
  for (const tc of tClauses) {
    const tTuck = normalizeTuckClause(tc);
    if (!tTuck.isTuck) continue;

    for (const cc of cClauses) {
      const cTuck = normalizeTuckClause(cc);
      if (!cTuck.isTuck) continue;

      if (tTuck.normalized === cTuck.normalized) {
        return {
          matchType: 'tuck_exact',
          matchingClause: tc,
          description: 'Matching library-tuck removal effect',
        };
      }

      // Relaxed target subject (nonland permanent vs creature vs artifact or creature)
      const tRelaxed = tTuck.normalized.replace(/target (?:nonland permanent|artifact or creature|creature|permanent)/g, 'target permanent');
      const cRelaxed = cTuck.normalized.replace(/target (?:nonland permanent|artifact or creature|creature|permanent)/g, 'target permanent');
      if (tRelaxed === cRelaxed) {
        return {
          matchType: 'tuck_relaxed',
          matchingClause: tc,
          description: 'Matching library-tuck tempo effect',
        };
      }
    }
  }

  return null;
}

/**
 * Computes the similarity score for two cards sharing an exact oracle text clause
 * or structural template under Directive 2 (Exact Oracle Text Matching is First Priority).
 * - Anchors at 95% (or 94% for template, 87% for subject relaxed, 88% for channel/discard)
 * - Deducts for effective CMC difference
 * - Deducts for power/toughness difference
 * - Deducts for combat keyword discrepancies
 * - Deducts for color, rarity, and supertype differences
 */
export function computeExactOracleMatchScore(
  target: Card,
  candidate: Card,
  tFeatures: ReturnType<typeof extractCardFeatures>,
  cFeatures: ReturnType<typeof extractCardFeatures>,
  matchResult: OracleClauseMatchResult | string
): { score: number; reasons: string[] } {
  const matchObj: OracleClauseMatchResult = typeof matchResult === 'string'
    ? { matchType: 'exact', matchingClause: matchResult, description: 'Exact matching rules text' }
    : matchResult;

  let score = 95;
  const reasons: string[] = [];

  if (matchObj.matchType === 'exact') {
    score = 95;
    reasons.push('Exact matching rules text');
  } else if (matchObj.matchType === 'template') {
    score = 94;
    reasons.push('Matching rules text template');
    if (matchObj.statBuffDelta && matchObj.statBuffDelta > 0) {
      score -= Math.min(4, matchObj.statBuffDelta * 2);
    }
  } else if (matchObj.matchType === 'subject_relaxed') {
    score = 87;
    reasons.push('Matching anthem / team buff rules text');
    if (matchObj.statBuffDelta && matchObj.statBuffDelta > 0) {
      score -= Math.min(4, matchObj.statBuffDelta * 2);
    }
  } else if (matchObj.matchType === 'channel_discard') {
    score = 88;
    reasons.push('Matching activated / channel effect');
    if (tFeatures.primaryType !== cFeatures.primaryType) {
      score -= 3;
    }
  } else if (matchObj.matchType === 'tuck_exact') {
    score = 90;
    reasons.push('Matching library-tuck removal effect');
  } else if (matchObj.matchType === 'tuck_relaxed') {
    score = 86;
    reasons.push('Matching library-tuck tempo effect');
  }

  if (matchObj.matchType === 'tuck_exact' || matchObj.matchType === 'tuck_relaxed') {
    const bothHaveCardSelection = (tFeatures.actionSubtypes.has('empower_jace_surveil') || tFeatures.detectedCategories.has('selection')) &&
                                  (cFeatures.actionSubtypes.has('scry') || cFeatures.actionSubtypes.has('surveil') || cFeatures.detectedCategories.has('selection'));
    if (bothHaveCardSelection) {
      score += 2;
      reasons.push('Both pair library-tuck removal with card selection (scry/surveil)');
    }
  }

  // 1. Deduct for Mana Cost / Effective CMC Difference
  const cmcDiff = Math.abs(tFeatures.effectiveCmc - cFeatures.effectiveCmc);
  if (cmcDiff === 0) {
    reasons.push(`Identical effective mana cost (${tFeatures.effectiveCmc} CMC)`);
  } else if (cmcDiff <= 0.6) {
    score -= 2;
    reasons.push(`Matching effective mana curve (effective ${tFeatures.effectiveCmc} vs ${cFeatures.effectiveCmc} CMC)`);
  } else if (cmcDiff <= 1.15) {
    score -= 3;
    reasons.push(`Close mana curve (±1 CMC)`);
  } else if (cmcDiff <= 2.2) {
    score -= 7;
  } else {
    score -= Math.min(15, Math.round(cmcDiff * 4));
  }

  // 2. Deduct for Power / Toughness Difference (for creatures)
  if (tFeatures.isCreature && cFeatures.isCreature) {
    const tEffP = tFeatures.effectivePower ?? 0;
    const tEffT = tFeatures.effectiveToughness ?? 0;
    const cEffP = cFeatures.effectivePower ?? 0;
    const cEffT = cFeatures.effectiveToughness ?? 0;
    const totalStatDiff = Math.abs((tEffP + tEffT) - (cEffP + cEffT));

    if (tEffP === cEffP && tEffT === cEffT) {
      reasons.push(`Identical effective combat stats (${tEffP}/${tEffT})`);
    } else if (totalStatDiff <= 2) {
      score -= 3;
      reasons.push(`Matching combat body scale (effective ${tEffP}/${tEffT} vs ${cEffP}/${cEffT})`);
    } else if (totalStatDiff <= 4) {
      score -= 5;
    } else {
      score -= Math.min(10, Math.round(totalStatDiff * 1.5));
    }
  } else if (tFeatures.isCreature !== cFeatures.isCreature) {
    score -= 10;
  }

  // 3. Deduct for Combat Keywords Discrepancies
  let keywordMismatch = 0;
  for (const kw of ['flying', 'reach', 'trample', 'vigilance', 'haste', 'hexproof', 'lifelink', 'deathtouch']) {
    const tHas = (target.keywords || []).some(k => k.toLowerCase() === kw) || new RegExp(`\\b${kw}\\b`, 'i').test(target.oracle_text || '');
    const cHas = (candidate.keywords || []).some(k => k.toLowerCase() === kw) || new RegExp(`\\b${kw}\\b`, 'i').test(candidate.oracle_text || '');
    if (tHas !== cHas) {
      keywordMismatch++;
    }
  }
  score -= Math.min(4, keywordMismatch);

  // 4. Deduct for Rest of Metrics (Color, Rarity, Legendary)
  const tColors = new Set(tFeatures.colors);
  const cColors = new Set(cFeatures.colors);
  const isExactColor = tColors.size === cColors.size && [...tColors].every(c => cColors.has(c));
  const sharesColor = [...tColors].some(c => cColors.has(c));

  if (isExactColor) {
    reasons.push('Same color alignment');
  } else if (sharesColor || tColors.size === 0 || cColors.size === 0) {
    score -= 1;
    reasons.push('Shared / colorless color alignment');
  } else {
    score -= 2;
  }

  // Rarity difference
  const rarityGap = Math.abs(
    (tFeatures.rarity === 'common' ? 1 : (tFeatures.rarity === 'uncommon' ? 2 : 3)) -
    (cFeatures.rarity === 'common' ? 1 : (cFeatures.rarity === 'uncommon' ? 2 : 3))
  );
  score -= Math.min(1, rarityGap);

  // Legendary mismatch
  const tLeg = (target.type_line || '').includes('Legendary');
  const cLeg = (candidate.type_line || '').includes('Legendary');
  if (tLeg !== cLeg) {
    score -= 1;
  }

  return {
    score: Math.max(35, Math.min(95, score)),
    reasons: reasons.slice(0, 4),
  };
}

/**
 * Determines if two cards are an exact reprint (same name across expansions)
 * or an exact functional reprint (identical cost, stats, types, keywords, and oracle text).
 */
export function isFunctionalOrExactReprint(target: Card, candidate: Card): { isReprint: boolean; isActual: boolean; reason?: string } {
  if (isActualReprint(target, candidate)) {
    return { isReprint: true, isActual: true, reason: 'Exact reprint from another expansion' };
  }
  if (isExactFunctionalReprint(target, candidate)) {
    return { isReprint: true, isActual: false, reason: 'Exact functional equivalent (identical stats & text)' };
  }
  return { isReprint: false, isActual: false };
}

/**
 * Compute functional similarity score between 0 and 100%
 *
 * Hybrid MTG Limited Architecture (Method 1 Lexical + Method 2 Structural):
 * - Compatibility Gatekeeper: Strict prerequisite. Incompatible types receive 0 score.
 * - Actual Reprint Gatekeeper: 100% is strictly and exclusively reserved for actual reprints.
 * - Functional Reprint: Identical stats/text with distinct card names receive 95% ceiling.
 * - Pillar 1: Color Alignment (20 pts)
 * - Pillar 2: Speed-Adjusted Effective Mana Cost (20 pts)
 * - Pillar 3 (Method 1): Lexical, Regex Pattern & Word Token Overlap (25 pts)
 * - Pillar 4 (Method 2): Structural Mechanics, Action Subtypes & Cost Hoops (25 pts)
 * - Pillar 5: Statline & Output Scale (10 pts)
 * - Functional Discrepancy Deductions: Combat keywords (flying), value riders, card types
 * - Non-reprint ceiling: <= 95% (100% impossible unless actual reprint)
 */
export function calculateCardSimilarity(target: Card, candidate: Card, userId?: string): { score: number; reasons: string[] } {
  // 0. Precedent Gatekeeper: Never compare a set to itself.
  // Precedents must strictly originate from different/historical sets.
  if (
    target.set &&
    candidate.set &&
    target.set.trim().toUpperCase() === candidate.set.trim().toUpperCase()
  ) {
    return { score: 0, reasons: ['Cards from the same set cannot be compared as historical precedents'] };
  }

  // 0.1 Compatibility Gatekeeper (Prerequisite — 0 points)
  if (!areCardTypesCompatible(target, candidate)) {
    return { score: 0, reasons: [] };
  }

  // 0.1 Actual Reprint Gatekeeper: 100% is strictly and exclusively reserved for actual direct reprints
  if (isActualReprint(target, candidate)) {
    return {
      score: 100,
      reasons: ['Exact reprint from another expansion'],
    };
  }

  // 0.2 Functional Reprint: Distinct names with identical stats & text receive the 95% non-reprint ceiling
  if (isExactFunctionalReprint(target, candidate)) {
    return {
      score: 95,
      reasons: ['Exact functional equivalent (identical stats & text)'],
    };
  }

  const tFeatures = extractCardFeatures(target);
  const cFeatures = extractCardFeatures(candidate);

  // 0.3 Flicker / Self-Protection Gatekeeper:
  // Non-flicker cards must never be paired with flicker/protection spells, and vice versa.
  if (tFeatures.actionSubtypes.has('flicker_protection') !== cFeatures.actionSubtypes.has('flicker_protection')) {
    return { score: 0, reasons: [] };
  }

  // 0.4 Exact Oracle Text / Core Rules Clause Priority Match (Rule 2)
  const exactClauseMatch = findExactOracleClauseMatch(target, candidate, tFeatures, cFeatures);
  if (exactClauseMatch) {
    return computeExactOracleMatchScore(target, candidate, tFeatures, cFeatures, exactClauseMatch);
  }

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
  const bothShareSecondCardDrawn = (
    tFeatures.actionSubtypes.has('second_card_drawn') && cFeatures.actionSubtypes.has('second_card_drawn')
  );
  const bothShareSecondCardTargetBuff = (
    tFeatures.actionSubtypes.has('second_card_target_buff') && cFeatures.actionSubtypes.has('second_card_target_buff')
  );
  const bothShareEtbSelfBounce = (
    tFeatures.actionSubtypes.has('etb_self_bounce') && cFeatures.actionSubtypes.has('etb_self_bounce')
  );
  const bothShareDeathAmassToken = (
    tFeatures.actionSubtypes.has('death_amass_token') && cFeatures.actionSubtypes.has('death_amass_token')
  );
  const bothShareEtbSacRemoval = (
    tFeatures.actionSubtypes.has('etb_sac_removal') && cFeatures.actionSubtypes.has('etb_sac_removal')
  );
  const bothSharePower4PlusSynergy = (
    tFeatures.actionSubtypes.has('power_4_plus_synergy') && cFeatures.actionSubtypes.has('power_4_plus_synergy')
  );
  const bothShareLandfallPayoff = (
    tFeatures.actionSubtypes.has('landfall_payoff') && cFeatures.actionSubtypes.has('landfall_payoff')
  );
  const bothShareUnblockableGranter = (
    tFeatures.actionSubtypes.has('unblockable_granter') && cFeatures.actionSubtypes.has('unblockable_granter')
  );
  const bothShareCultivateRamp = (
    tFeatures.actionSubtypes.has('cultivate_ramp') && cFeatures.actionSubtypes.has('cultivate_ramp')
  );
  const bothShareFetchLand = (
    tFeatures.actionSubtypes.has('fetch_land') && cFeatures.actionSubtypes.has('fetch_land')
  );
  const bothShareAuraGyRecursion = (
    tFeatures.actionSubtypes.has('aura_gy_recursion') && cFeatures.actionSubtypes.has('aura_gy_recursion')
  );
  const bothShareBasicTutorArtifact = (
    tFeatures.actionSubtypes.has('basic_tutor_artifact') && cFeatures.actionSubtypes.has('basic_tutor_artifact')
  );
  const bothShareRampArtifactToken = (
    tFeatures.actionSubtypes.has('ramp_token_producer') && cFeatures.actionSubtypes.has('ramp_token_producer')
  );
  const isRampTokenCrossDorkBridge = (
    (tFeatures.actionSubtypes.has('ramp_token_producer') && (cFeatures.actionSubtypes.has('two_drop_mana_dork') || cFeatures.actionSubtypes.has('three_drop_mana_dork') || cFeatures.actionSubtypes.has('mana_rock') || cFeatures.actionSubtypes.has('cultivate_ramp'))) ||
    (cFeatures.actionSubtypes.has('ramp_token_producer') && (tFeatures.actionSubtypes.has('two_drop_mana_dork') || tFeatures.actionSubtypes.has('three_drop_mana_dork') || tFeatures.actionSubtypes.has('mana_rock') || tFeatures.actionSubtypes.has('cultivate_ramp')))
  );
  const bothShareArtifactAnimatorAura = (
    tFeatures.actionSubtypes.has('artifact_animator_aura') && cFeatures.actionSubtypes.has('artifact_animator_aura')
  );
  const bothShareArtifactSacPayoff = (
    tFeatures.actionSubtypes.has('artifact_sacrifice_payoff') && cFeatures.actionSubtypes.has('artifact_sacrifice_payoff')
  );
  const bothShareArtifactTapPayoff = (
    tFeatures.actionSubtypes.has('artifact_tap_payoff') && cFeatures.actionSubtypes.has('artifact_tap_payoff')
  );
  const bothShareTwoDropManaDork = (
    tFeatures.actionSubtypes.has('two_drop_mana_dork') && cFeatures.actionSubtypes.has('two_drop_mana_dork')
  );
  const bothShareThreeDropManaDork = (
    tFeatures.actionSubtypes.has('three_drop_mana_dork') && cFeatures.actionSubtypes.has('three_drop_mana_dork')
  );
  const bothShareManaRock = (
    tFeatures.actionSubtypes.has('mana_rock') && cFeatures.actionSubtypes.has('mana_rock')
  );
  const bothShareEntersWithXCounters = (
    tFeatures.actionSubtypes.has('enters_with_x_counters') && cFeatures.actionSubtypes.has('enters_with_x_counters')
  );
  const bothShareTeamCounterDistributor = (
    tFeatures.actionSubtypes.has('team_counter_distributor') && cFeatures.actionSubtypes.has('team_counter_distributor')
  );
  const bothShareCombatCounterDistributor = (
    tFeatures.actionSubtypes.has('combat_counter_distributor') && cFeatures.actionSubtypes.has('combat_counter_distributor')
  );
  const bothShareCounterTransferDistributor = (
    tFeatures.actionSubtypes.has('counter_transfer_distributor') && cFeatures.actionSubtypes.has('counter_transfer_distributor')
  );
  const bothShareScalableX = (
    tFeatures.hasXCost && cFeatures.hasXCost
  );
  const bothShareHydra = (
    tFeatures.isHydra && cFeatures.isHydra
  );
  const bothShareExactConverge = (
    tFeatures.isConverge && cFeatures.isConverge
  );
  const bothShareExactSunburst = (
    tFeatures.isSunburst && cFeatures.isSunburst
  );
  const bothShareConvergeSunburst = (
    tFeatures.actionSubtypes.has('converge_sunburst') && cFeatures.actionSubtypes.has('converge_sunburst')
  );
  const bothShareDomainVivid = (
    tFeatures.actionSubtypes.has('domain_vivid_scaling') && cFeatures.actionSubtypes.has('domain_vivid_scaling')
  );
  const bothShareMultiColorScaling = (
    (tFeatures.isMultiColorScaling || tFeatures.actionSubtypes.has('color_scaling_payoff')) &&
    (cFeatures.isMultiColorScaling || cFeatures.actionSubtypes.has('color_scaling_payoff'))
  );
  const bothShareColorsSpent = (
    tFeatures.actionSubtypes.has('colors_spent_mechanic') && cFeatures.actionSubtypes.has('colors_spent_mechanic')
  );
  const bothShareToughnessCombatDamage = (
    tFeatures.actionSubtypes.has('toughness_combat_damage') && cFeatures.actionSubtypes.has('toughness_combat_damage')
  );
  const bothShareToughnessMatters = (
    tFeatures.actionSubtypes.has('toughness_matters_archetype') && cFeatures.actionSubtypes.has('toughness_matters_archetype')
  );
  const bothShareDefenderAttackEnabler = (
    tFeatures.actionSubtypes.has('defender_attack_enabler') && cFeatures.actionSubtypes.has('defender_attack_enabler')
  );
  const bothShareToughnessCostReduction = (
    tFeatures.actionSubtypes.has('toughness_cost_reduction') && cFeatures.actionSubtypes.has('toughness_cost_reduction')
  );
  const bothShareTokenAnthem = (
    tFeatures.actionSubtypes.has('token_anthem') && cFeatures.actionSubtypes.has('token_anthem')
  );
  const bothShareTeamAnthem = (
    tFeatures.actionSubtypes.has('team_anthem') && cFeatures.actionSubtypes.has('team_anthem')
  );
  const bothShareDiscardRemoval = (
    tFeatures.actionSubtypes.has('discard_removal') && cFeatures.actionSubtypes.has('discard_removal')
  );
  const bothShareTuckRemoval = (
    tFeatures.actionSubtypes.has('tuck_removal') && cFeatures.actionSubtypes.has('tuck_removal')
  );
  const bothShareNoncreatureSurveilEngine = (
    (tFeatures.actionSubtypes.has('noncreature_surveil_engine') || (tFeatures.actionSubtypes.has('noncreature_spell_trigger') && tFeatures.actionSubtypes.has('empower_jace'))) &&
    (cFeatures.actionSubtypes.has('noncreature_surveil_engine') || (cFeatures.actionSubtypes.has('noncreature_spell_trigger') && (cFeatures.actionSubtypes.has('surveil') || cFeatures.detectedCategories.has('selection'))))
  );
  const bothShareSignatureEngine = (
    (tFeatures.actionSubtypes.has('connive_recruit') && cFeatures.actionSubtypes.has('connive_recruit')) ||
    bothShareAttackGranter ||
    bothShareSecondCardDrawn ||
    bothShareEtbSelfBounce ||
    bothShareDeathAmassToken ||
    bothShareEtbSacRemoval ||
    bothSharePower4PlusSynergy ||
    bothShareLandfallPayoff ||
    bothShareFetchLand ||
    bothShareCultivateRamp ||
    bothShareAuraGyRecursion ||
    bothShareBasicTutorArtifact ||
    bothShareRampArtifactToken ||
    isRampTokenCrossDorkBridge ||
    bothShareArtifactAnimatorAura ||
    bothShareArtifactSacPayoff ||
    bothShareArtifactTapPayoff ||
    bothShareTwoDropManaDork ||
    bothShareThreeDropManaDork ||
    bothShareManaRock ||
    bothShareEntersWithXCounters ||
    bothShareTeamCounterDistributor ||
    bothShareCombatCounterDistributor ||
    bothShareCounterTransferDistributor ||
    bothShareScalableX ||
    bothShareHydra ||
    bothShareExactConverge ||
    bothShareExactSunburst ||
    bothShareConvergeSunburst ||
    bothShareDomainVivid ||
    bothShareMultiColorScaling ||
    bothShareColorsSpent ||
    bothShareToughnessCombatDamage ||
    bothShareToughnessMatters ||
    bothShareDefenderAttackEnabler ||
    bothShareToughnessCostReduction ||
    bothShareTokenAnthem ||
    bothShareTeamAnthem ||
    bothShareDiscardRemoval ||
    bothShareTuckRemoval ||
    bothShareNoncreatureSurveilEngine ||
    (tFeatures.actionSubtypes.has('death_counter_transfer') && cFeatures.actionSubtypes.has('death_counter_transfer'))
  );
  const bothShareDeathCounterTransfer = (
    tFeatures.actionSubtypes.has('death_counter_transfer') && cFeatures.actionSubtypes.has('death_counter_transfer')
  );
  const bothShareEntersWithCountersAndDeathTransfer = (
    bothShareDeathCounterTransfer &&
    (tFeatures.actionSubtypes.has('enters_with_counters') || tFeatures.actionSubtypes.has('etb_counter_self')) &&
    (cFeatures.actionSubtypes.has('enters_with_counters') || cFeatures.actionSubtypes.has('etb_counter_self'))
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
  const bothShareLandTutorTop = (
    tFeatures.actionSubtypes.has('land_tutor_top') && cFeatures.actionSubtypes.has('land_tutor_top')
  );
  const bothSharePureBasicLandTutorTop = (
    bothShareLandTutorTop &&
    /search your library for a basic land card, reveal it, then shuffle and put that card on top/i.test(target.oracle_text || '') &&
    /search your library for a basic land card, reveal it, then shuffle and put that card on top/i.test(candidate.oracle_text || '')
  );
  const bothShareFlyingLifegain = (
    tFeatures.actionSubtypes.has('flying_lifegain_evasion') && cFeatures.actionSubtypes.has('flying_lifegain_evasion')
  );
  const bothShareRemovalWithCompensation = (
    tFeatures.actionSubtypes.has('removal_with_compensation') && cFeatures.actionSubtypes.has('removal_with_compensation')
  );
  const bothShareCombatRemoval = (
    tFeatures.actionSubtypes.has('combat_removal') && cFeatures.actionSubtypes.has('combat_removal')
  );
  const bothSharePowerToughnessRemoval = (
    tFeatures.actionSubtypes.has('power_toughness_removal') && cFeatures.actionSubtypes.has('power_toughness_removal')
  );
  const bothShareToughness4PlusRemoval = (
    tFeatures.actionSubtypes.has('toughness_4_plus_removal') && cFeatures.actionSubtypes.has('toughness_4_plus_removal')
  );
  const bothSharePower4PlusRemoval = (
    tFeatures.actionSubtypes.has('power_4_plus_removal') && cFeatures.actionSubtypes.has('power_4_plus_removal')
  );
  const bothShareModalRemoval = (
    tFeatures.actionSubtypes.has('modal_removal') && cFeatures.actionSubtypes.has('modal_removal')
  );
  const bothShareAbilityLossAura = (
    tFeatures.actionSubtypes.has('ability_loss_aura') && cFeatures.actionSubtypes.has('ability_loss_aura')
  );
  const bothShareFreezeAura = (
    tFeatures.actionSubtypes.has('freeze_aura') && cFeatures.actionSubtypes.has('freeze_aura')
  );
  const bothSharePacifismAura = (
    tFeatures.actionSubtypes.has('pacifism_aura') && cFeatures.actionSubtypes.has('pacifism_aura')
  );
  const bothShareAuraRemoval = (
    tFeatures.isAuraRemoval && cFeatures.isAuraRemoval
  );
  const bothShareActivatedTeamPump = (
    tFeatures.actionSubtypes.has('activated_team_pump') && cFeatures.actionSubtypes.has('activated_team_pump')
  );
  const bothShareTeamPump = (
    tFeatures.actionSubtypes.has('team_pump') && cFeatures.actionSubtypes.has('team_pump')
  );
  const bothShareLibraryTutor = (
    tFeatures.actionSubtypes.has('library_tutor') && cFeatures.actionSubtypes.has('library_tutor')
  );
  const bothShareTutorToTop = (
    tFeatures.actionSubtypes.has('tutor_to_top') && cFeatures.actionSubtypes.has('tutor_to_top')
  );
  const bothShareTutorToHand = (
    tFeatures.actionSubtypes.has('tutor_to_hand') && cFeatures.actionSubtypes.has('tutor_to_hand')
  );
  const bothShareTutorPlaneswalkerOrLegendary = (
    (tFeatures.actionSubtypes.has('planeswalker_tutor') || tFeatures.actionSubtypes.has('legendary_tutor')) &&
    (cFeatures.actionSubtypes.has('planeswalker_tutor') || cFeatures.actionSubtypes.has('legendary_tutor'))
  );
  const bothShareEmpowerJace = (
    tFeatures.hasEmpowerJace && cFeatures.hasEmpowerJace
  );

  // Cross-Mechanic Bridges for Empower Jace (Rectangle Theory, Surveil, Cantrip, Amass):
  // 1. Empower Jace <= 2 <-> Surveil / Scry
  const isTargetEmpowerSurveil = tFeatures.hasEmpowerJace && tFeatures.empowerJaceCount <= 2;
  const isCandSurveilOrScry = cFeatures.valueRiders.has('surveil_scry') || /surveil|scry/i.test(candidate.oracle_text || '');
  const isCandEmpowerSurveil = cFeatures.hasEmpowerJace && cFeatures.empowerJaceCount <= 2;
  const isTargetSurveilOrScry = tFeatures.valueRiders.has('surveil_scry') || /surveil|scry/i.test(target.oracle_text || '');

  const isEmpowerSurveilBridge = (isTargetEmpowerSurveil && isCandSurveilOrScry) || (isCandEmpowerSurveil && isTargetSurveilOrScry);

  // 2. Empower Jace >= 3 <-> ETB Draw / Cantrip
  const isTargetEmpowerDraw = tFeatures.hasEmpowerJace && tFeatures.empowerJaceCount >= 3;
  const isCandCantripOrDraw = cFeatures.actionSubtypes.has('cantrip') || cFeatures.actionSubtypes.has('raw_draw') || /draw a card|draws a card/i.test(candidate.oracle_text || '');
  const isCandEmpowerDraw = cFeatures.hasEmpowerJace && cFeatures.empowerJaceCount >= 3;
  const isTargetCantripOrDraw = tFeatures.actionSubtypes.has('cantrip') || tFeatures.actionSubtypes.has('raw_draw') || /draw a card|draws a card/i.test(target.oracle_text || '');

  const isEmpowerDrawBridge = (isTargetEmpowerDraw && isCandCantripOrDraw) || (isCandEmpowerDraw && isTargetCantripOrDraw);

  // 3. Counterspell + Empower Jace <-> Counterspell + Amass / Token (Rectangle Theory)
  const isTargetCounterEmpower = tFeatures.hasEmpowerJace && (tFeatures.actionSubtypes.has('hard_counter') || tFeatures.detectedCategories.has('counter'));
  const isCandCounterToken = (cFeatures.actionSubtypes.has('hard_counter') || cFeatures.detectedCategories.has('counter')) && (cFeatures.actionSubtypes.has('death_amass_token') || /amass|token/i.test(candidate.oracle_text || ''));
  const isCandCounterEmpower = cFeatures.hasEmpowerJace && (cFeatures.actionSubtypes.has('hard_counter') || cFeatures.detectedCategories.has('counter'));
  const isTargetCounterToken = (tFeatures.actionSubtypes.has('hard_counter') || tFeatures.detectedCategories.has('counter')) && (tFeatures.actionSubtypes.has('death_amass_token') || /amass|token/i.test(target.oracle_text || ''));

  const isCounterAmassBridge = (isTargetCounterEmpower && isCandCounterToken) || (isCandCounterEmpower && isTargetCounterToken);

  // 4. Combat Trick + Empower Jace <-> Combat Trick + Investigate / Token / Draw
  const isTargetTrickEmpower = tFeatures.hasEmpowerJace && tFeatures.isCombatTrick;
  const isCandTrickToken = cFeatures.isCombatTrick && /investigate|clue|draw a card|amass|token/i.test(candidate.oracle_text || '');
  const isCandTrickEmpower = cFeatures.hasEmpowerJace && cFeatures.isCombatTrick;
  const isTargetTrickToken = tFeatures.isCombatTrick && /investigate|clue|draw a card|amass|token/i.test(target.oracle_text || '');

  const isTrickTokenBridge = (isTargetTrickEmpower && isCandTrickToken) || (isCandTrickEmpower && isTargetTrickToken);

  // 5. Multi-Token Spell + Empower Jace <-> Multi-Token Spell + Scry / Filtering
  const isTargetMultiTokenEmpower = tFeatures.hasEmpowerJace && tFeatures.createsTokens;
  const isCandMultiTokenFilter = cFeatures.createsTokens && /scry|surveil|draw/i.test(candidate.oracle_text || '');
  const isCandMultiTokenEmpower = cFeatures.hasEmpowerJace && cFeatures.createsTokens;
  const isTargetMultiTokenFilter = tFeatures.createsTokens && /scry|surveil|draw/i.test(target.oracle_text || '');

  const isMultiTokenFilterBridge = (isTargetMultiTokenEmpower && isCandMultiTokenFilter) || (isCandMultiTokenEmpower && isTargetMultiTokenFilter);

  // 6. Big Draw Sorcery + Empower Jace 6 <-> Draw 3 Sorcery
  const isTargetDraw6Empower = tFeatures.hasEmpowerJace && tFeatures.empowerJaceCount >= 6 && tFeatures.isSorcery;
  const isCandDraw3 = cFeatures.isSorcery && /draw three cards|draw 3 cards/i.test(candidate.oracle_text || '');
  const isCandDraw6Empower = cFeatures.hasEmpowerJace && cFeatures.empowerJaceCount >= 6 && cFeatures.isSorcery;
  const isTargetDraw3 = tFeatures.isSorcery && /draw three cards|draw 3 cards/i.test(target.oracle_text || '');

  const isDraw3Bridge = (isTargetDraw6Empower && isCandDraw3) || (isCandDraw6Empower && isTargetDraw3);

  const isEmpowerCrossMechanicBridge = (
    isEmpowerSurveilBridge ||
    isEmpowerDrawBridge ||
    isCounterAmassBridge ||
    isTrickTokenBridge ||
    isMultiTokenFilterBridge ||
    isDraw3Bridge
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
    if (bothShareExactConverge || bothShareExactSunburst) {
      colorScore = 18;
      baselineReasons.push('Exact Converge mechanic peer across mana configurations');
    } else if (bothShareConvergeSunburst || bothShareMultiColorScaling) {
      colorScore = (tColors.size === 0) ? 20 : 18;
      baselineReasons.push((tColors.size === 0) ? 'Both colorless multicolor-scaling archetype payoffs' : 'Colorless multicolor-scaling archetype payoff');
    } else {
      colorScore = (tFeatures.isEquipment || cFeatures.isEquipment) ? 16 : ((tColors.size > 0) ? 10 : 14);
      baselineReasons.push((tFeatures.isEquipment || cFeatures.isEquipment) ? 'Colorless equipment (playable in any deck)' : 'Colorless baseline comparison');
    }
  } else if (tColors.size === 0 && (cColors.size >= 1)) {
    if (bothShareExactConverge || bothShareExactSunburst) {
      colorScore = 18;
      baselineReasons.push('Exact Converge mechanic peer across mana configurations');
    } else if (bothShareConvergeSunburst || bothShareMultiColorScaling) {
      colorScore = 16;
      baselineReasons.push('Colorless parallel to colored multicolor-scaling archetype payoff (Converge, Sunburst, Vivid, Domain)');
    } else if (cColors.size === 1) {
      colorScore = (bothShareEtbScry2 || bothShareSignatureEngine || bothShareEtbTreasure || bothShareFlashReach || bothShareLandTutorTop || bothShareFlyingLifegain || bothShareEmpowerJace || isEmpowerCrossMechanicBridge)
        ? 16
        : ((tFeatures.isEquipment || cFeatures.isEquipment) ? 14 : 10);
      baselineReasons.push(bothShareFlyingLifegain
        ? 'Colorless parallel to colored evasive lifegain synergy'
        : (bothShareLandTutorTop
          ? 'Colorless parallel to colored land tutor'
          : (bothShareEtbTreasure
            ? 'Colorless parallel to colored Treasure producer'
            : (bothShareFlashReach
              ? 'Colorless parallel to colored Flash & Reach blocker'
              : (bothShareEtbScry2
                ? `Cross-color artifact cycle peer (${[...cColors][0]})`
                : (bothShareEmpowerJace || isEmpowerCrossMechanicBridge
                  ? 'Colorless parallel to colored Empower Jace precedent'
                  : (bothShareSignatureEngine ? 'Cross-color engine mechanic peer' : `Mono-color archetype comp (${[...cColors][0]})`)))))));
    } else {
      colorScore = bothShareSignatureEngine ? 14 : 8;
      baselineReasons.push(bothShareSignatureEngine ? 'Cross-color engine mechanic peer' : 'Multicolor card comparison');
    }
  } else if (tFeatures.isHybrid && cColors.size === 1 && tColors.has([...cColors][0])) {
    colorScore = 18;
    baselineReasons.push(`Component hybrid color (${[...cColors][0]})`);
  } else if (tColors.size > 1 && cColors.size === 1 && tColors.has([...cColors][0])) {
    colorScore = 14;
    baselineReasons.push(`Component color (${[...cColors][0]})`);
  } else if (bothShareSignatureEngine) {
    colorScore = (bothShareExactConverge || bothShareExactSunburst) ? 18 : 14;
    let engineReason = 'Cross-color engine mechanic peer (Recruit & Connive)';
    if (bothShareExactConverge) engineReason = 'Cross-color engine peer (Exact Converge colors-spent scaling)';
    else if (bothShareExactSunburst) engineReason = 'Cross-color engine peer (Exact Sunburst colors-spent scaling)';
    else if (bothShareConvergeSunburst) engineReason = 'Cross-color engine peer (Converge / Sunburst colors-spent scaling)';
    else if (bothShareMultiColorScaling) engineReason = 'Cross-color engine peer (Multicolor-scaling payoff: Converge, Sunburst, Vivid, Domain)';
    else if (bothShareRampArtifactToken) engineReason = 'Cross-color engine mechanic peer (Ramp token generator: Heartwood/Powerstone)';
    else if (isRampTokenCrossDorkBridge) engineReason = 'Cross-color mana ramp engine peer (Ramp token generator <-> Mana dork/rock)';
    else if (bothShareArtifactAnimatorAura) engineReason = 'Cross-color archetype peer (Artifact-animating Aura)';
    else if (bothShareArtifactSacPayoff) engineReason = 'Cross-color engine peer (Artifact sacrifice payoff)';
    else if (bothShareArtifactTapPayoff) engineReason = 'Cross-color engine peer (Artifact tap payoff)';
    else if (bothShareTwoDropManaDork) engineReason = 'Cross-color 2-drop mana ramp peer';
    else if (bothShareThreeDropManaDork) engineReason = 'Cross-color 3-drop mana ramp peer';
    else if (bothShareManaRock) engineReason = 'Cross-color mana rock / fixing artifact peer';
    else if (bothShareSecondCardDrawn) engineReason = 'Cross-color engine mechanic peer (Draw second card)';
    else if (bothShareEtbSelfBounce) engineReason = 'Cross-color engine mechanic peer (ETB self-bounce permanent)';
    else if (bothShareDeathAmassToken) engineReason = 'Cross-color engine mechanic peer (Dies into token / Amass)';
    else if (bothShareEtbSacRemoval) engineReason = 'Cross-color engine mechanic peer (ETB sacrifice removal)';
    else if (bothSharePower4PlusSynergy) engineReason = 'Cross-color engine mechanic peer (Power 4+ synergy)';
    else if (bothShareLandfallPayoff) engineReason = 'Cross-color engine mechanic peer (Landfall trigger)';
    else if (bothShareFetchLand) engineReason = 'Cross-color mana fixer peer (Fetchland)';
    else if (bothShareCultivateRamp) engineReason = 'Cross-color ramp peer (Cultivate)';
    else if (bothShareAttackGranter) engineReason = 'Cross-color engine mechanic peer (Attack trigger keyword mentor)';
    baselineReasons.push(engineReason);
  } else if (bothShareLivingWeapon) {
    colorScore = 14;
    baselineReasons.push('Cross-color engine mechanic peer (Living Weapon / Token Equipment)');
  } else if (bothShareEmpowerJace || isEmpowerCrossMechanicBridge) {
    colorScore = 14;
    baselineReasons.push(bothShareEmpowerJace
      ? 'Cross-color Empower Jace engine peer'
      : 'Cross-color mechanic peer (Empower Jace / Cantrip / Token parallel)');
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

  if (tFeatures.hasXCost && cFeatures.hasXCost) {
    cmcScore = 20;
    baselineReasons.push('Both scalable X-cost spells (variable mana sinks)');
  } else if (tFeatures.hasXCost !== cFeatures.hasXCost) {
    cmcScore = 0;
  } else if (effectiveDiff <= 0.15) {
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
      if (bothShareSignatureEngine || bothShareEtbTreasure || bothShareActivatedTeamPump) {
        cmcScore = 17;
        baselineReasons.push(
          bothShareActivatedTeamPump
            ? 'Curve-adjacent activated team pump peer'
            : (bothShareDeathCounterTransfer
              ? `Adjacent curve slot (${candidate.cmc}M vs ${target.cmc}M counter bequeath)`
              : `Adjacent curve slot (${candidate.cmc}M vs ${target.cmc}M)`)
        );
      } else {
        cmcScore = 11;
        baselineReasons.push(`Lower curve tier (${candidate.cmc}M vs ${target.cmc}M)`);
      }
    } else {
      const shareCoreRemoval = (bothShareToughness4PlusRemoval || bothSharePowerToughnessRemoval || bothShareModalRemoval || (tFeatures.isRemoval && cFeatures.isRemoval));
      cmcScore = (bothShareSignatureEngine || bothShareEtbTreasure || bothShareActivatedTeamPump) ? 18 : (shareCoreRemoval && tFeatures.cmc === cFeatures.cmc ? 18 : 14);
      if (targetIsInstant !== candIsInstant) {
        baselineReasons.push(targetIsInstant ? 'Instant speed tax (+0.75 mana)' : 'Sorcery speed discount');
      } else {
        baselineReasons.push(bothShareActivatedTeamPump ? 'Adjacent curve slot (team pump peer)' : (bothShareEtbTreasure ? 'Adjacent curve slot (Treasure ramp peer)' : 'Adjacent curve slot (±1 mana)'));
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
    sweeper: { pts: 14, label: 'Matching board wipe effect' },
    damage: { pts: 11, label: 'Matching direct damage / burn' },
    counter: { pts: 11, label: 'Matching counterspell effect' },
    draw: { pts: 10, label: 'Matching card advantage effect' },
    graveyard: { pts: 10, label: 'Graveyard value / recursive mechanic' },
    trick: { pts: 10, label: 'Matching combat trick effect' },
    pacifism: { pts: 10, label: 'Matching pacifism / lockdown' },
    bounce: { pts: 9, label: 'Matching bounce tempo effect' },
    selection: { pts: 9, label: 'Matching card selection effect' },
    token_army: { pts: 14, label: 'Matching creature token army effect' },
    token_creature: { pts: 10, label: 'Matching creature token creation' },
    token_resource: { pts: 8, label: 'Matching resource token creation' },
    token: { pts: 8, label: 'Matching token creation' },
    lifegain_payoff: { pts: 12, label: 'Matching lifegain payoff synergy' },
    counters: { pts: 8, label: 'Matching counter synergy' },
    synergy: { pts: 7, label: 'Matching ETB / synergy trigger' },
    token_anthem: { pts: 14, label: 'Matching token anthem / lord effect' },
    team_anthem: { pts: 12, label: 'Matching team anthem effect' },
    equipment: { pts: 11, label: 'Matching equipment subtype' },
    tutor: { pts: 14, label: 'Matching library search / tutor effect' },
  };

  let bestCategoryMatch = 0;
  let matchedCategoryLabel = '';

  tFeatures.detectedCategories.forEach((cat) => {
    if (cFeatures.detectedCategories.has(cat)) {
      if (cat === 'token') {
        const tCreature = tFeatures.createsCreatureTokens;
        const cCreature = cFeatures.createsCreatureTokens;
        const tResource = tFeatures.createsResourceTokens;
        const cResource = cFeatures.createsResourceTokens;
        if ((tCreature && !tResource && !cCreature && cResource) ||
            (cCreature && !cResource && !tCreature && tResource)) {
          return;
        }
      }
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
  // In MTG Limited, creature subtypes are flavor/cosmetic unless the card explicitly has tribal mechanics/payoffs!
  if (tFeatures.isCreature && cFeatures.isCreature) {
    const sharedSubtypes = tFeatures.creatureSubtypes.filter(s =>
      !['human', 'soldier', 'warrior', 'druid', 'wizard', 'cleric', 'rogue', 'citizen', 'scout'].includes(s) && cFeatures.creatureSubtypes.includes(s)
    );
    if (sharedSubtypes.length > 0) {
      const isTribalRelevant = sharedSubtypes.some(s =>
        tFeatures.cleanOracle.includes(s) || cFeatures.cleanOracle.includes(s)
      );
      if (isTribalRelevant) {
        method1LexicalScore += 5;
        lexicalReasons.push(`Shared tribal type: ${sharedSubtypes.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')}`);
      } else {
        // Incidental non-tribal creature subtype: subtle 1 pt tie-breaker, no noisy reason
        method1LexicalScore += 1;
      }
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
  const targetTokens = tokenizeOracleText(tFeatures.cleanOracle, target.name);
  const candTokens = tokenizeOracleText(cFeatures.cleanOracle, candidate.name);
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

  if (bothShareExactConverge) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 8);
    lexicalReasons.push('Identical Converge mechanic (scaled by colors of mana spent)');
  } else if (bothShareExactSunburst) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 8);
    lexicalReasons.push('Identical Sunburst mechanic (scaled by colors of mana spent)');
  } else if (bothShareMultiColorScaling) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 6);
    lexicalReasons.push('Both multicolor-scaling mechanics (Converge, Sunburst, Vivid, Domain)');
  } else if (bothShareSignatureEngine) {
    method1LexicalScore = Math.min(25, method1LexicalScore + (bothShareAttackGranter ? 6 : 8));
    if (bothShareAttackGranter) {
      lexicalReasons.push('Shared attack-trigger combat mentor mechanic');
    } else if (tFeatures.actionSubtypes.has('connive_recruit') && cFeatures.actionSubtypes.has('connive_recruit')) {
      lexicalReasons.push('Shared signature engine: Recruit & Connive (ETB loot + discard payoff)');
    }
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

  if (bothShareLandTutorTop) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 12);
    lexicalReasons.push('Shared basic land search to top of library');
  }

  if (bothSharePureBasicLandTutorTop) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 3);
    lexicalReasons.push('Pure basic land tutor to top of library');
  }

  if (bothShareFlyingLifegain) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 15);
    lexicalReasons.push('Shared flying evasion with creature lifegain trigger');
  }

  if (bothShareRemovalWithCompensation) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 10);
    lexicalReasons.push('Shared signature compensation downside removal');
  }

  if (bothShareCombatRemoval) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 8);
    lexicalReasons.push('Shared combat-conditioned creature removal');
  }

  if (bothShareToughness4PlusRemoval) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 14);
    lexicalReasons.push('Shared exact restriction: "Destroy target creature with toughness 4 or greater"');
  } else if (bothSharePower4PlusRemoval) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 12);
    lexicalReasons.push('Shared restriction: "Destroy target creature with power 4 or greater"');
  } else if (bothSharePowerToughnessRemoval) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 8);
    lexicalReasons.push('Shared power/toughness-restricted removal');
  }

  if (bothShareModalRemoval) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 8);
    lexicalReasons.push('Shared modal removal design ("Choose one —")');
  }

  if (bothShareAbilityLossAura) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 12);
    lexicalReasons.push('Shared signature ability-stripping Aura ("loses all abilities")');
  }

  if (bothShareFreezeAura) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 10);
    lexicalReasons.push('Shared freeze / tap-lockdown Aura ("doesn\'t untap")');
  }

  if (bothSharePacifismAura) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 8);
    lexicalReasons.push('Shared pacifism lockdown Aura');
  }

  if (bothShareActivatedTeamPump) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 14);
    lexicalReasons.push('Shared activated team-pump mana sink ("creatures you control get +1/+1")');
  } else if (bothShareTeamPump) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 10);
    lexicalReasons.push('Shared team-wide stat buff ("creatures you control get +1/+1")');
  }

  if (bothShareTutorToTop) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 16);
    lexicalReasons.push('Shared top-of-library tutor effect ("put that card on top")');
  } else if (bothShareLibraryTutor) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 12);
    lexicalReasons.push('Shared library search / tutor mechanic ("search your library")');
  }

  if (bothShareTutorPlaneswalkerOrLegendary) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 8);
    lexicalReasons.push('Shared planeswalker / legendary tutor target');
  }

  if (bothShareEntersWithCountersAndDeathTransfer) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 16);
    lexicalReasons.push('Shared modular counter bequeath engine (enters with +1/+1 counters, transfers upon death)');
  } else if (bothShareDeathCounterTransfer) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 12);
    lexicalReasons.push('Shared death counter transfer trigger');
  }

  if (bothShareTeamCounterDistributor) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 16);
    lexicalReasons.push('Shared team-wide +1/+1 counter distribution anthem');
  } else if (bothShareCombatCounterDistributor) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 12);
    lexicalReasons.push('Shared combat-phase +1/+1 counter distribution');
  }

  if (bothShareEntersWithXCounters) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 15);
    lexicalReasons.push('Shared scalable entry with X +1/+1 counters');
  } else if (bothShareScalableX) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 12);
    lexicalReasons.push('Shared scalable X mana cost');
  }

  if (bothShareEmpowerJace) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 14);
    lexicalReasons.push('Both feature Empower Jace planeswalker engine');
  } else if (isDraw3Bridge) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 15);
    lexicalReasons.push('Both 4-mana blue draw spells (delayed 3-card advantage)');
  } else if (isCounterAmassBridge) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 15);
    lexicalReasons.push('Both counterspells generating permanent token presence (Rectangle Theory / Amass)');
  } else if (isTrickTokenBridge) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 14);
    lexicalReasons.push('Both combat tricks providing permanent card advantage / token');
  } else if (isMultiTokenFilterBridge) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 15);
    lexicalReasons.push('Both multi-token creators with card selection');
  } else if (isEmpowerDrawBridge) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 12);
    lexicalReasons.push('Empower Jace 3+ acts as card draw engine');
  } else if (isEmpowerSurveilBridge) {
    method1LexicalScore = Math.min(25, method1LexicalScore + 12);
    lexicalReasons.push('Matching card selection effect (Surveil / Empower Jace)');
  }

  method1LexicalScore = Math.min(25, method1LexicalScore);

  // =========================================================================
  // PILLAR 4: METHOD 2 (Structural Mechanics, Action Subtypes & Cost Hoops - up to 25 pts)
  // =========================================================================
  let structuralActionPoints = 0;
  const ACTION_SUBTYPE_VALUES: Record<string, { pts: number; label: string }> = {
    activated_team_pump: { pts: 20, label: 'Both creatures with activated team-pump mana sink' },
    team_pump: { pts: 16, label: 'Both creatures with team-wide stat buff' },
    mana_sink: { pts: 14, label: 'Both creatures with late-game mana sink' },
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
    ability_loss_aura: { pts: 20, label: 'Both creature ability-stripping Auras ("loses all abilities")' },
    freeze_aura: { pts: 18, label: 'Both freeze / tap-lockdown Auras' },
    pacifism_aura: { pts: 16, label: 'Both pacifism / lockdown Auras' },
    aura_removal: { pts: 15, label: 'Both Aura-based creature removal' },
    permanent_removal: { pts: 17, label: 'Both flexible permanent removal' },
    removal_with_compensation: { pts: 20, label: 'Both unconditional removal with opponent compensation' },
    combat_removal: { pts: 18, label: 'Both combat-conditioned creature removal' },
    toughness_4_plus_removal: { pts: 20, label: 'Both creature removal targeting toughness 4 or greater' },
    power_4_plus_removal: { pts: 18, label: 'Both creature removal targeting power 4 or greater' },
    modal_removal: { pts: 19, label: 'Both modal removal spells ("Choose one —")' },
    power_toughness_removal: { pts: 17, label: 'Both power/toughness-restricted creature removal' },
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
    death_counter_transfer: { pts: 22, label: 'Both transfer +1/+1 counters upon death (Modular / counter bequeath)' },
    enters_with_x_counters: { pts: 22, label: 'Both scalable creatures entering with X +1/+1 counters (Hydra scaling)' },
    team_counter_distributor: { pts: 22, label: 'Both distribute +1/+1 counters across your entire board (go-wide counter anthem)' },
    combat_counter_distributor: { pts: 18, label: 'Both trigger counter distribution at the beginning of combat' },
    counter_transfer_distributor: { pts: 20, label: 'Both convert own counters into team-wide board growth' },
    scalable_x_spell: { pts: 15, label: 'Both scalable X-cost spells' },
    hydra: { pts: 16, label: 'Both Hydra scaling creatures' },
    enters_with_counters: { pts: 18, label: 'Both enter the battlefield with +1/+1 counters' },
    triggered_growth_other_enters: { pts: 20, label: 'Both triggered growth when other creatures enter (Alliance / creature-fall)' },
    etb_counter_distributor: { pts: 16, label: 'Both distribute +1/+1 counters on enters' },
    etb_counter_self: { pts: 16, label: 'Both enter with / ETB self +1/+1 counters' },
    attack_keyword_granter: { pts: 17, label: 'Both attack-triggered keyword mentors' },
    etb_treasure: { pts: 20, label: 'Both ETB Treasure ramp / fixing creatures' },
    flash_reach_ambush: { pts: 20, label: 'Both Flash & Reach ambush creatures' },
    land_tutor_top: { pts: 20, label: 'Both creature ETB land search to top of library' },
    tutor_to_top: { pts: 22, label: 'Both top-of-library tutor spells' },
    planeswalker_tutor: { pts: 20, label: 'Both planeswalker tutor spells' },
    legendary_tutor: { pts: 18, label: 'Both legendary tutor spells' },
    library_tutor: { pts: 18, label: 'Both library search / tutor spells' },
    tutor_to_hand: { pts: 16, label: 'Both search library to hand spells' },
    flying_lifegain_evasion: { pts: 20, label: 'Both 2-drop evasive flying lifegain creatures' },
    second_card_target_buff: { pts: 22, label: 'Both put +1/+1 counters on target creature upon drawing second card' },
    second_card_drawn: { pts: 20, label: 'Both "draw second card each turn" engine payoffs' },
    etb_self_bounce: { pts: 20, label: 'Both ETB self-bounce permanents for reset / value engine' },
    death_amass_token: { pts: 20, label: 'Both dies-into-token / Amass army replacements' },
    etb_sac_removal: { pts: 22, label: 'Both ETB sacrifice creature to remove / damage target' },
    power_4_plus_synergy: { pts: 20, label: 'Both power 4 or greater combat / card-draw payoffs' },
    landfall_payoff: { pts: 18, label: 'Both Landfall board-impact / value triggers' },
    landfall_token: { pts: 20, label: 'Both Landfall creature token generators' },
    landfall_recursion: { pts: 18, label: 'Both Landfall graveyard recursion triggers' },
    unblockable_granter: { pts: 20, label: 'Both activated unblockable ability granters' },
    cultivate_ramp: { pts: 22, label: 'Both double basic land ramp effects (Cultivate on a stick / spell)' },
    fetch_land: { pts: 22, label: 'Both sacrifice-to-fetch basic land mana fixers' },
    aura_gy_recursion: { pts: 18, label: 'Both auras with recursive / replacement card advantage' },
    basic_tutor_artifact: { pts: 20, label: 'Both artifacts fetching basic land with late-game utility' },
    ramp_token_producer: { pts: 22, label: 'Both ramp artifact token producers (Heartwood/Powerstone)' },
    heartwood_token_producer: { pts: 22, label: 'Both Heartwood token ramp generators' },
    powerstone_token_producer: { pts: 22, label: 'Both Powerstone token ramp generators' },
    two_drop_mana_dork: { pts: 22, label: 'Both early 2-drop mana ramp creatures' },
    three_drop_mana_dork: { pts: 20, label: 'Both 3-drop mana ramp creatures' },
    artifact_animator_aura: { pts: 22, label: 'Both artifact-animating Auras (turning artifacts into big creatures)' },
    artifact_sacrifice_payoff: { pts: 20, label: 'Both sacrifice artifact for counters / combat abilities' },
    artifact_tap_payoff: { pts: 20, label: 'Both tap untapped artifacts for counters / value' },
    empower_jace: { pts: 18, label: 'Both feature Empower Jace planeswalker engine' },
    empower_jace_surveil: { pts: 16, label: 'Both provide repeatable card selection / surveil' },
    empower_jace_draw: { pts: 18, label: 'Both provide card draw advantage' },
    amass_parallel: { pts: 16, label: 'Both provide spell interaction with permanent token presence (Rectangle Theory)' },
    converge_sunburst: { pts: 22, label: 'Both Converge / Sunburst creatures (scaled by colors of mana spent)' },
    domain_vivid_scaling: { pts: 20, label: 'Both multicolor-scaling payoffs (Vivid / Domain permanents scaling)' },
    color_scaling_payoff: { pts: 18, label: 'Both multicolor-scaling payoffs (rewarding 3+ color decks)' },
    colors_spent_mechanic: { pts: 18, label: 'Both mechanics scaling with colors of mana spent' },
    token_anthem: { pts: 22, label: 'Both anthem effects buffing creature tokens' },
    team_anthem: { pts: 20, label: 'Both team-wide anthem effects' },
    discard_removal: { pts: 20, label: 'Both activated / discard removal tricks' },
    tuck_removal: { pts: 22, label: 'Both library-tuck removal / bounce effects' },
    noncreature_surveil_engine: { pts: 20, label: 'Both noncreature spell trigger -> repeatable surveil engines' },
    noncreature_spell_trigger: { pts: 16, label: 'Both noncreature spell trigger payoffs (spellslinger engine)' },
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

  // Cross-counter synergy matching (enters with counters or self ETB counters)
  const bothEnterWithOrSelfCounters = (
    (tFeatures.actionSubtypes.has('enters_with_counters') || tFeatures.actionSubtypes.has('etb_counter_self')) &&
    (cFeatures.actionSubtypes.has('enters_with_counters') || cFeatures.actionSubtypes.has('etb_counter_self'))
  );
  if (bothEnterWithOrSelfCounters && structuralActionPoints < 17) {
    structuralActionPoints = 17;
    structuralReasons.push('Both enter with self +1/+1 counters');
  }

  const bothEtbCounter = (
    (tFeatures.actionSubtypes.has('etb_counter_distributor') || tFeatures.actionSubtypes.has('etb_counter_self') || tFeatures.actionSubtypes.has('enters_with_counters')) &&
    (cFeatures.actionSubtypes.has('etb_counter_distributor') || cFeatures.actionSubtypes.has('etb_counter_self') || cFeatures.actionSubtypes.has('enters_with_counters'))
  );
  if (bothEtbCounter && structuralActionPoints < 15) {
    structuralActionPoints = 15;
    structuralReasons.push('Both creature with +1/+1 counter entry value');
  }

  // Cross-ramp matching: Permanent ramp artifact token generator <-> Mana dork or mana rock
  if (isRampTokenCrossDorkBridge && structuralActionPoints < 16) {
    structuralActionPoints = 16;
    structuralReasons.push('Both permanent mana ramp providers (Ramp token generator / Mana dork / Mana rock)');
  }

  // Cross-removal matching: Both are targeted creature removal spells
  const bothTargetedCreatureRemoval = (
    (tFeatures.isInstant || tFeatures.isSorcery) &&
    (cFeatures.isInstant || cFeatures.isSorcery) &&
    tFeatures.detectedCategories.has('removal') &&
    cFeatures.detectedCategories.has('removal')
  );
  if (bothTargetedCreatureRemoval && structuralActionPoints < 14) {
    structuralActionPoints = 14;
    structuralReasons.push('Both targeted creature removal spells');
  }

  // Multi-Action Subtype Bonus (e.g. both ETB and Cantrip)
  if (sharedSubtypesCount > 1) {
    structuralActionPoints = Math.min(20, structuralActionPoints + (sharedSubtypesCount - 1) * 3);
  }

  // Shared signature creature subtype synergy (e.g. Wolf, Elf - ONLY when tribal relevant)
  const sharedSignatureSubtypes = tFeatures.creatureSubtypes.filter(s =>
    !['human', 'soldier', 'warrior', 'druid', 'wizard', 'cleric', 'rogue', 'citizen', 'scout'].includes(s) && cFeatures.creatureSubtypes.includes(s)
  );
  if (sharedSignatureSubtypes.length > 0) {
    const isTribalRelevant = sharedSignatureSubtypes.some(s =>
      tFeatures.cleanOracle.includes(s) || cFeatures.cleanOracle.includes(s)
    );
    if (isTribalRelevant) {
      structuralActionPoints = Math.min(20, structuralActionPoints + 3);
      structuralReasons.push(`Shared tribal archetype: ${sharedSignatureSubtypes.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')}`);
    }
  }

  // Highlight signature Limited roles
  if (tFeatures.actionSubtypes.has('activated_team_pump') && cFeatures.actionSubtypes.has('activated_team_pump')) {
    structuralReasons.unshift('Both creatures with activated team-pump mana sink');
  } else if (tFeatures.actionSubtypes.has('team_pump') && cFeatures.actionSubtypes.has('team_pump')) {
    structuralReasons.unshift('Both creatures with team-wide stat buff');
  }

  // Highlight signature Limited roles
  const isBothEtbCantrip = tFeatures.isCreature && cFeatures.isCreature &&
    tFeatures.actionSubtypes.has('cantrip') && cFeatures.actionSubtypes.has('cantrip') &&
    tFeatures.actionSubtypes.has('etb_value') && cFeatures.actionSubtypes.has('etb_value');
  if (isBothEtbCantrip) {
    structuralReasons.unshift('Both ETB cantrips (draws card on enters)');
  }

  if (bothShareEntersWithCountersAndDeathTransfer) {
    structuralActionPoints = Math.max(structuralActionPoints, 22);
    structuralReasons.unshift('Both modular counter bequeath creatures (enters with +1/+1 counters, transfers upon death)');
  } else if (tFeatures.actionSubtypes.has('death_counter_transfer') && cFeatures.actionSubtypes.has('death_counter_transfer')) {
    structuralReasons.unshift('Both transfer +1/+1 counters upon death (Modular / counter bequeath)');
  }

  if (tFeatures.actionSubtypes.has('triggered_growth_other_enters') && cFeatures.actionSubtypes.has('triggered_growth_other_enters')) {
    structuralReasons.unshift('Both triggered growth when other creatures enter (Alliance / creature-fall)');
  }

  if (bothShareTeamCounterDistributor) {
    structuralActionPoints = Math.max(structuralActionPoints, 22);
    structuralReasons.unshift('Both distribute +1/+1 counters across your entire board (go-wide counter anthem)');
  }

  if (bothShareCombatCounterDistributor) {
    structuralActionPoints = Math.max(structuralActionPoints, 18);
    structuralReasons.unshift('Both trigger counter distribution at the beginning of combat');
  }

  if (bothShareCounterTransferDistributor) {
    structuralActionPoints = Math.max(structuralActionPoints, 20);
    structuralReasons.unshift('Both convert own counters into team-wide board growth');
  }

  if (bothShareEntersWithXCounters) {
    structuralActionPoints = Math.max(structuralActionPoints, 22);
    structuralReasons.unshift('Both scalable creatures entering with X +1/+1 counters (Hydra scaling)');
  } else if (bothShareScalableX) {
    structuralActionPoints = Math.max(structuralActionPoints, 16);
    structuralReasons.unshift('Both scalable X-cost spells');
  }

  if (bothShareHydra) {
    structuralActionPoints = Math.max(structuralActionPoints, 18);
    structuralReasons.unshift('Both Hydra scaling creatures');
  }

  if (bothShareExactConverge) {
    structuralActionPoints = Math.max(structuralActionPoints, 24);
    structuralReasons.unshift('Both Converge creatures (scaled by colors of mana spent to cast)');
  } else if (bothShareExactSunburst) {
    structuralActionPoints = Math.max(structuralActionPoints, 23);
    structuralReasons.unshift('Both Sunburst creatures (scaled by colors of mana spent to pay cost)');
  } else if (bothShareConvergeSunburst) {
    structuralActionPoints = Math.max(structuralActionPoints, 22);
    structuralReasons.unshift('Both Converge / Sunburst creatures (scaled by colors of mana spent)');
  } else if (bothShareMultiColorScaling) {
    structuralActionPoints = Math.max(structuralActionPoints, 20);
    structuralReasons.unshift('Both multicolor-scaling payoffs (Converge, Sunburst, Vivid, Domain)');
  }

  // Reach & Trample combat keyword parity
  const tHasReach = (target.keywords || []).some(k => /reach/i.test(k)) || /reach/i.test(target.oracle_text || '');
  const cHasReach = (candidate.keywords || []).some(k => /reach/i.test(k)) || /reach/i.test(candidate.oracle_text || '');
  const tHasTrample = (target.keywords || []).some(k => /trample/i.test(k)) || /trample/i.test(target.oracle_text || '');
  const cHasTrample = (candidate.keywords || []).some(k => /trample/i.test(k)) || /trample/i.test(candidate.oracle_text || '');

  if (tHasReach && cHasReach && tHasTrample && cHasTrample) {
    structuralActionPoints = Math.min(25, structuralActionPoints + 4);
    structuralReasons.push('Both share Reach and Trample combat keywords');
  } else if ((tHasReach && cHasReach) || (tHasTrample && cHasTrample)) {
    structuralActionPoints = Math.min(25, structuralActionPoints + 2);
    structuralReasons.push(tHasReach && cHasReach ? 'Both have Reach' : 'Both have Trample');
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

  if (bothShareSecondCardTargetBuff) {
    structuralReasons.unshift('Both put +1/+1 counters on target creature upon drawing second card');
  } else if (bothShareSecondCardDrawn) {
    structuralReasons.unshift('Both "draw second card each turn" engine payoffs');
  }

  if (bothShareEtbSelfBounce) {
    structuralReasons.unshift('Both ETB self-bounce permanents for reset / value engine');
  }

  if (bothShareDeathAmassToken) {
    structuralReasons.unshift('Both dies-into-token / Amass army replacements');
  }

  if (bothShareEtbSacRemoval) {
    structuralReasons.unshift('Both ETB sacrifice creature to remove / damage target');
  }

  if (bothSharePower4PlusSynergy) {
    structuralReasons.unshift('Both power 4 or greater combat / card-draw payoffs');
  }

  if (bothShareLandfallPayoff) {
    structuralReasons.unshift('Both Landfall board-impact / value triggers');
  }

  if (bothShareUnblockableGranter) {
    structuralReasons.unshift('Both activated unblockable ability granters');
  }

  if (bothShareCultivateRamp) {
    structuralReasons.unshift('Both double basic land ramp effects (Cultivate on a stick / spell)');
  }

  if (bothShareFetchLand) {
    structuralReasons.unshift('Both sacrifice-to-fetch basic land mana fixers');
  }

  if (bothShareAuraGyRecursion) {
    structuralReasons.unshift('Both auras with recursive / replacement card advantage');
  }

  if (bothShareBasicTutorArtifact) {
    structuralReasons.unshift('Both artifacts fetching basic land with late-game utility');
  }

  if (bothShareRampArtifactToken) {
    structuralReasons.unshift('Both ramp artifact token producers (Heartwood/Powerstone)');
  }

  if (bothShareArtifactAnimatorAura) {
    structuralReasons.unshift('Both artifact-animating Auras (turning artifacts into big creatures)');
  }

  if (bothShareArtifactSacPayoff) {
    structuralReasons.unshift('Both sacrifice artifact for counters / combat abilities');
  }

  if (bothShareArtifactTapPayoff) {
    structuralReasons.unshift('Both tap untapped artifacts for counters / value');
  }

  if (bothShareTwoDropManaDork) {
    structuralReasons.unshift('Both early 2-drop mana ramp creatures');
  } else if (bothShareThreeDropManaDork) {
    structuralReasons.unshift('Both 3-drop mana ramp creatures');
  } else if (bothShareManaRock) {
    structuralReasons.unshift('Both mana rock / fixing artifacts');
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

  if (bothShareLandTutorTop) {
    structuralActionPoints = Math.max(structuralActionPoints, 20);
    if (!structuralReasons.includes('Both creature ETB land search to top of library')) {
      structuralReasons.unshift('Both creature ETB land search to top of library');
    }
  }

  if (bothShareFlyingLifegain) {
    structuralActionPoints = Math.max(structuralActionPoints, 20);
    if (!structuralReasons.includes('Both 2-drop evasive flying lifegain creatures')) {
      structuralReasons.unshift('Both 2-drop evasive flying lifegain creatures');
    }
  }

  if (bothShareAbilityLossAura) {
    structuralActionPoints = Math.max(structuralActionPoints, 20);
    if (!structuralReasons.includes('Both creature ability-stripping Auras ("loses all abilities")')) {
      structuralReasons.unshift('Both creature ability-stripping Auras ("loses all abilities")');
    }
  }

  if (bothShareFreezeAura) {
    structuralActionPoints = Math.max(structuralActionPoints, 18);
    if (!structuralReasons.includes('Both freeze / tap-lockdown Auras')) {
      structuralReasons.unshift('Both freeze / tap-lockdown Auras');
    }
  }

  if (bothShareToughness4PlusRemoval) {
    structuralActionPoints = Math.max(structuralActionPoints, 20);
    if (!structuralReasons.includes('Both destroy target creature with toughness 4 or greater')) {
      structuralReasons.unshift('Both destroy target creature with toughness 4 or greater');
    }
  } else if (bothSharePower4PlusRemoval) {
    structuralActionPoints = Math.max(structuralActionPoints, 18);
    if (!structuralReasons.includes('Both destroy target creature with power 4 or greater')) {
      structuralReasons.unshift('Both destroy target creature with power 4 or greater');
    }
  }

  if (bothShareModalRemoval) {
    structuralActionPoints = Math.max(structuralActionPoints, 19);
    if (!structuralReasons.includes('Both modal removal spells with situational flexibility ("Choose one —")')) {
      structuralReasons.unshift('Both modal removal spells with situational flexibility ("Choose one —")');
    }
  }

  if (bothShareTutorToTop) {
    structuralActionPoints = Math.max(structuralActionPoints, 22);
    if (!structuralReasons.includes('Both top-of-library tutor spells')) {
      structuralReasons.unshift('Both top-of-library tutor spells');
    }
  } else if (bothShareLibraryTutor) {
    structuralActionPoints = Math.max(structuralActionPoints, 18);
    if (!structuralReasons.includes('Both library search / tutor spells')) {
      structuralReasons.unshift('Both library search / tutor spells');
    }
  }

  if (bothShareEmpowerJace) {
    structuralActionPoints = Math.max(structuralActionPoints, 18);
    if (tFeatures.empowerJaceCount === cFeatures.empowerJaceCount) {
      structuralReasons.unshift(`Identical Empower Jace ${tFeatures.empowerJaceCount}`);
    } else {
      structuralReasons.unshift('Both feature Empower Jace mechanic');
    }
  } else if (isDraw3Bridge) {
    structuralActionPoints = Math.max(structuralActionPoints, 22);
    structuralReasons.unshift('Both 4-mana blue draw spells (delayed 3-card advantage)');
  } else if (isCounterAmassBridge) {
    structuralActionPoints = Math.max(structuralActionPoints, 20);
    structuralReasons.unshift('Counterspell with incidental token creation (Amass parallel)');
  } else if (isTrickTokenBridge) {
    structuralActionPoints = Math.max(structuralActionPoints, 20);
    structuralReasons.unshift('Combat trick with incidental card advantage (Investigate / Empower)');
  } else if (isMultiTokenFilterBridge) {
    structuralActionPoints = Math.max(structuralActionPoints, 20);
    structuralReasons.unshift('Multi-token creation with card filtering');
  } else if (isEmpowerDrawBridge) {
    const empowerCard = tFeatures.hasEmpowerJace ? tFeatures : cFeatures;
    structuralActionPoints = Math.max(structuralActionPoints, 18);
    structuralReasons.unshift(`Empower Jace ${empowerCard.empowerJaceCount} enables immediate card draw [-3] (functional cantrip)`);
  } else if (isEmpowerSurveilBridge) {
    const empowerCard = tFeatures.hasEmpowerJace ? tFeatures : cFeatures;
    const otherCardObj = tFeatures.hasEmpowerJace ? candidate : target;
    const hasSurveil2 = /surveil 2|scry 2/i.test(otherCardObj.oracle_text || '');

    if (empowerCard.empowerJaceCount === 2 && hasSurveil2) {
      structuralActionPoints = Math.max(structuralActionPoints, 18);
      structuralReasons.unshift('Empower Jace 2 yields 2 surveils across consecutive turns (near-equivalent to Surveil 2, though slower upfront)');
      cmcScore = Math.max(0, cmcScore - 2);
    } else if (empowerCard.empowerJaceCount === 1) {
      structuralActionPoints = Math.max(structuralActionPoints, 16);
      structuralReasons.unshift('Empower Jace 1 yields 1 surveil via Jace loyalty');
    } else {
      structuralActionPoints = Math.max(structuralActionPoints, 16);
      structuralReasons.unshift('Empower Jace card selection parallel (surveil/scry engine)');
    }
  }

  const bothShareSweeper = (
    (tFeatures.actionSubtypes.has('sweeper') || tFeatures.detectedCategories.has('sweeper')) &&
    (cFeatures.actionSubtypes.has('sweeper') || cFeatures.detectedCategories.has('sweeper'))
  );
  if (bothShareSweeper) {
    structuralActionPoints = Math.max(structuralActionPoints, 22);
    if (!structuralReasons.includes('Both board wipe / sweeper spells')) {
      structuralReasons.unshift('Both board wipe / sweeper spells');
    }
  }

  const bothShareCreatureTokenArmy = (
    tFeatures.actionSubtypes.has('creature_token_army') && cFeatures.actionSubtypes.has('creature_token_army')
  );
  if (bothShareCreatureTokenArmy) {
    structuralActionPoints = Math.max(structuralActionPoints, 20);
    if (!structuralReasons.includes('Both creature token army spells')) {
      structuralReasons.unshift('Both creature token army spells');
    }
  }

  const bothShareLifegainPayoff = (
    tFeatures.actionSubtypes.has('lifegain_payoff') && cFeatures.actionSubtypes.has('lifegain_payoff')
  );
  if (bothShareLifegainPayoff) {
    structuralActionPoints = Math.max(structuralActionPoints, 18);
    if (!structuralReasons.includes('Both life gain payoff spells')) {
      structuralReasons.unshift('Both life gain payoff spells');
    }
  }

  if (bothShareToughnessCombatDamage) {
    structuralActionPoints = Math.max(structuralActionPoints, 22);
    if (!structuralReasons.includes('Both assign combat damage based on toughness ("butt-strike")')) {
      structuralReasons.unshift('Both assign combat damage based on toughness ("butt-strike")');
    }
  } else if (bothShareToughnessMatters) {
    structuralActionPoints = Math.max(structuralActionPoints, 18);
    if (!structuralReasons.includes('Both high-toughness scaling archetype engines')) {
      structuralReasons.unshift('Both high-toughness scaling archetype engines');
    }
  }

  if (bothShareDefenderAttackEnabler) {
    structuralActionPoints = Math.max(structuralActionPoints, 16);
    if (!structuralReasons.includes('Both enable defender creatures to attack')) {
      structuralReasons.push('Both enable defender creatures to attack');
    }
  }

  if (bothShareToughnessCostReduction) {
    structuralActionPoints = Math.max(structuralActionPoints, 16);
    if (!structuralReasons.includes('Both feature toughness-based cost reduction')) {
      structuralReasons.push('Both feature toughness-based cost reduction');
    }
  }

  // Action Subtype Mismatch Penalties
  let actionMismatchPenalty = 0;

  // Target is tutor, but candidate is NOT tutor (or vice-versa)
  if (tFeatures.actionSubtypes.has('library_tutor') && !cFeatures.actionSubtypes.has('library_tutor')) {
    actionMismatchPenalty = Math.max(actionMismatchPenalty, 25);
  } else if (!tFeatures.actionSubtypes.has('library_tutor') && cFeatures.actionSubtypes.has('library_tutor')) {
    actionMismatchPenalty = Math.max(actionMismatchPenalty, 25);
  }

  // Target is creature removal, but candidate is NOT creature removal (or vice-versa)
  const tIsCreatureRemoval = tFeatures.isRemoval || tFeatures.actionSubtypes.has('power_toughness_removal') || tFeatures.actionSubtypes.has('conditional_removal') || tFeatures.actionSubtypes.has('unconditional_removal');
  const cIsCreatureRemoval = cFeatures.isRemoval || cFeatures.actionSubtypes.has('power_toughness_removal') || cFeatures.actionSubtypes.has('conditional_removal') || cFeatures.actionSubtypes.has('unconditional_removal') || cFeatures.actionSubtypes.has('damage_removal') || cFeatures.isAuraRemoval;

  if (tIsCreatureRemoval && !cIsCreatureRemoval) {
    actionMismatchPenalty = Math.max(actionMismatchPenalty, isExactColorMatch ? 10 : 18);
  } else if (!tIsCreatureRemoval && cIsCreatureRemoval) {
    actionMismatchPenalty = Math.max(actionMismatchPenalty, isExactColorMatch ? 10 : 18);
  }

  // Pure combat trick mismatch penalty (combat trick vs non-combat trick)
  if (tFeatures.isCombatTrick && !cFeatures.isCombatTrick) {
    actionMismatchPenalty = Math.max(actionMismatchPenalty, 15);
  } else if (!tFeatures.isCombatTrick && cFeatures.isCombatTrick) {
    actionMismatchPenalty = Math.max(actionMismatchPenalty, 15);
  }

  // Counterspell mismatch penalty (counterspell vs non-counterspell)
  const tIsCounter = tFeatures.detectedCategories.has('counter') || /counter target/i.test(target.oracle_text || '');
  const cIsCounter = cFeatures.detectedCategories.has('counter') || /counter target/i.test(candidate.oracle_text || '');
  if (tIsCounter && !cIsCounter) {
    actionMismatchPenalty = Math.max(actionMismatchPenalty, 18);
  } else if (!tIsCounter && cIsCounter) {
    actionMismatchPenalty = Math.max(actionMismatchPenalty, 18);
  }

  if (tFeatures.actionSubtypes.has('hard_counter') && cFeatures.actionSubtypes.has('soft_tax_counter')) {
    actionMismatchPenalty = 10;
  } else if (tFeatures.actionSubtypes.has('soft_tax_counter') && cFeatures.actionSubtypes.has('hard_counter')) {
    actionMismatchPenalty = 10;
  } else if (tFeatures.actionSubtypes.has('unconditional_removal') && cFeatures.actionSubtypes.has('conditional_removal')) {
    actionMismatchPenalty = (tFeatures.actionSubtypes.has('removal_with_compensation') || tFeatures.actionSubtypes.has('combat_removal')) ? 2 : 8;
  } else if (tFeatures.actionSubtypes.has('etb_looter') && cFeatures.actionSubtypes.has('tap_looter')) {
    actionMismatchPenalty = 10;
  } else if (tFeatures.actionSubtypes.has('tap_looter') && cFeatures.actionSubtypes.has('etb_looter')) {
    actionMismatchPenalty = 10;
  } else if (tFeatures.actionSubtypes.has('etb_looter') && !cFeatures.actionSubtypes.has('etb_looter')) {
    actionMismatchPenalty = 12;
  } else if (!tFeatures.actionSubtypes.has('etb_looter') && cFeatures.actionSubtypes.has('etb_looter') && tFeatures.actionSubtypes.has('loot_rummage')) {
    actionMismatchPenalty = 12;
  }

  if (tFeatures.actionSubtypes.has('activated_team_pump') && !cFeatures.actionSubtypes.has('activated_team_pump')) {
    actionMismatchPenalty = Math.max(actionMismatchPenalty, 10);
  }

  // Tuck / Library Bounce Removal vs Non-interactive Permanent mismatch penalty
  if (tFeatures.actionSubtypes.has('tuck_removal') && !cFeatures.isRemoval && !cFeatures.detectedCategories.has('bounce')) {
    actionMismatchPenalty = Math.max(actionMismatchPenalty, 28);
  } else if (!tFeatures.isRemoval && !tFeatures.detectedCategories.has('bounce') && cFeatures.actionSubtypes.has('tuck_removal')) {
    actionMismatchPenalty = Math.max(actionMismatchPenalty, 28);
  }

  // Alliance / Creature-fall Triggered Growth Mismatch Penalty:
  // A conditional triggered-growth creature (undersized body requiring other creatures to enter to grow)
  // must never be scored as equivalent to a static enters-with / modular creature or baseline body!
  if (tFeatures.actionSubtypes.has('triggered_growth_other_enters') !== cFeatures.actionSubtypes.has('triggered_growth_other_enters')) {
    actionMismatchPenalty = Math.max(actionMismatchPenalty, 18);
  }

  // Scalable X-Cost vs Fixed-Cost Mismatch Penalty
  if (tFeatures.hasXCost !== cFeatures.hasXCost) {
    const hasCombatCounterDist = tFeatures.actionSubtypes.has('combat_counter_distributor') || cFeatures.actionSubtypes.has('combat_counter_distributor');
    if ((tFeatures.hasXCost && cFeatures.cmc <= 2 && !hasCombatCounterDist) ||
        (cFeatures.hasXCost && tFeatures.cmc <= 2 && !hasCombatCounterDist)) {
      actionMismatchPenalty += 22;
      baselineReasons.push('Cost scaling mismatch: scalable X-spell vs fixed low-curve card');
    } else {
      actionMismatchPenalty += 12;
    }
  }

  // Team Counter Distributor Scope Mismatch Penalty:
  // Distributing counters across your entire board (go-wide anthem) is fundamentally different from
  // single-target growth or self-growth.
  if (tFeatures.actionSubtypes.has('team_counter_distributor') &&
      !cFeatures.actionSubtypes.has('team_counter_distributor') &&
      !cFeatures.actionSubtypes.has('team_pump') &&
      !cFeatures.actionSubtypes.has('combat_counter_distributor')) {
    actionMismatchPenalty += 16;
  }

  // Modal / Conditional treasure penalty: target has unconditional ETB treasure, but candidate is conditional or modal
  const targetIsUnconditionalTreasure = tFeatures.actionSubtypes.has('etb_treasure') && !/choose one|if /i.test(target.oracle_text || '');
  const candIsModalOrConditionalTreasure = cFeatures.actionSubtypes.has('etb_treasure') && (/choose one/i.test(candidate.oracle_text || '') || /if [\s\S]*create [\s\S]*treasure/i.test(candidate.oracle_text || ''));
  if (targetIsUnconditionalTreasure && candIsModalOrConditionalTreasure) {
    actionMismatchPenalty = Math.max(actionMismatchPenalty, 6);
  }

  // Parasitic poison / toxic mechanic mismatch penalty
  const targetHasToxic = /toxic|infect|poison counter/i.test(target.oracle_text || '') || (target.keywords || []).some(k => /toxic|infect/i.test(k));
  const candHasToxic = /toxic|infect|poison counter/i.test(candidate.oracle_text || '') || (candidate.keywords || []).some(k => /toxic|infect/i.test(k));
  if (targetHasToxic !== candHasToxic) {
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

  // Toughness-Matters / Butt-Strike vs Unrelated Go-Wide Overrun Finisher Mismatch:
  // An archetype engine revolving around toughness and high-toughness defenders
  // must never be matched with pure go-wide army overrun cards (e.g. Moonshaker Cavalry, Warren Warleader, Head of the Homestead)
  if ((tFeatures.actionSubtypes.has('toughness_combat_damage') || tFeatures.actionSubtypes.has('toughness_matters_archetype')) &&
      !cFeatures.actionSubtypes.has('toughness_combat_damage') && !cFeatures.actionSubtypes.has('toughness_matters_archetype')) {
    if (cFeatures.createsCreatureTokens || cFeatures.actionSubtypes.has('creature_token_army') || cFeatures.actionSubtypes.has('team_pump') || (cFeatures.cmc >= 7 && !cFeatures.actionSubtypes.has('toughness_cost_reduction'))) {
      actionMismatchPenalty = Math.max(actionMismatchPenalty, 28);
    }
  }

  // Token Anthem / Team Anthem vs Unrelated Artifact Reanimator / Graveyard Engine Mismatch:
  // A token anthem or team buff must never pair with a graveyard artifact reanimator or pure mana rock
  if ((tFeatures.actionSubtypes.has('token_anthem') || tFeatures.actionSubtypes.has('team_anthem')) &&
      !cFeatures.actionSubtypes.has('token_anthem') && !cFeatures.actionSubtypes.has('team_anthem')) {
    if (cFeatures.actionSubtypes.has('reanimation') || cFeatures.detectedCategories.has('graveyard') || cFeatures.actionSubtypes.has('artifact_sac_sink') || cFeatures.actionSubtypes.has('mana_rock')) {
      actionMismatchPenalty = Math.max(actionMismatchPenalty, 28);
    }
  }

  // Cost Structure Match (up to 5 pts)
  let costStructurePoints = 0;
  if (tFeatures.costProfile === 'x_cost' && cFeatures.costProfile === 'x_cost') {
    costStructurePoints = 6;
    structuralReasons.push('Both scalable X-cost spells');
  } else if (tFeatures.costProfile === 'additional_cost' && cFeatures.costProfile === 'additional_cost') {
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
    creature_token: { pts: 5, label: 'Creature token generation' },
    resource_token: { pts: 4, label: 'Resource token generation' },
    token: { pts: 4, label: 'Token generation' },
    surveil_scry: { pts: 3, label: 'Scry / Surveil' },
    counters: { pts: 3, label: '+1/+1 counters' },
    discard_payoff: { pts: 4, label: 'Discard payoff' },
    lifegain_payoff: { pts: 5, label: 'Life gain payoff' },
    life_gain: { pts: 3, label: 'Life gain' },
    cantrip: { pts: 3, label: 'Cantrip replacement' },
    ramp: { pts: 3, label: 'Mana ramp / land fetch' },
  };

  tFeatures.valueRiders.forEach((vr) => {
    if (cFeatures.valueRiders.has(vr)) {
      if (vr === 'token') {
        const tCreature = tFeatures.createsCreatureTokens;
        const cCreature = cFeatures.createsCreatureTokens;
        const tResource = tFeatures.createsResourceTokens;
        const cResource = cFeatures.createsResourceTokens;
        if ((tCreature && !tResource && !cCreature && cResource) ||
            (cCreature && !cResource && !tCreature && tResource)) {
          return;
        }
      }
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
  const structuralGross = structuralActionPoints + costStructurePoints + valueRiderPoints + flashReachBonus;
  method2StructuralScore = Math.max(0, Math.min(25, structuralGross - actionMismatchPenalty));
  const excessActionMismatch = Math.max(0, actionMismatchPenalty - structuralGross);

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
      const isTargetBoosted = (tFeatures.entersWithCountersCount ?? 0) > 0 || (tFeatures.etbSelfCounterCount ?? 0) > 0;
      const isCandBoosted = (cFeatures.entersWithCountersCount ?? 0) > 0 || (cFeatures.etbSelfCounterCount ?? 0) > 0;
      if (bothShareExactConverge) {
        baselineReasons.push(`Identical base ${target.power}/${target.toughness} body with matching Converge color-scaling growth`);
      } else if (bothShareExactSunburst) {
        baselineReasons.push(`Identical base ${target.power}/${target.toughness} body with matching Sunburst color-scaling growth`);
      } else if (isTargetBoosted && isCandBoosted) {
        baselineReasons.push(`Exact effective P/T (${tFeatures.power}/${tFeatures.toughness} via counters)`);
      } else if (isTargetBoosted || isCandBoosted) {
        baselineReasons.push(`Exact effective P/T (${tFeatures.power}/${tFeatures.toughness})`);
      } else {
        baselineReasons.push(`Exact P/T (${target.power}/${target.toughness})`);
      }
    } else if (pDiff === 0) {
      statlineScore = 8;
      baselineReasons.push(`Matching effective power (${tFeatures.power} power)`);
    } else if (tDiff === 0) {
      statlineScore = 8;
      baselineReasons.push(`Matching effective toughness (${tFeatures.toughness} toughness)`);
    } else if (totalStatDiff === 0) {
      if (pDiff > 0 && tDiff > 0) {
        statlineScore = 4;
        baselineReasons.push(`Swapped stat distribution (${tFeatures.power}/${tFeatures.toughness} vs ${cFeatures.power}/${cFeatures.toughness})`);
      } else {
        statlineScore = 8;
        baselineReasons.push(`Equivalent stats (${tFeatures.power + tFeatures.toughness} total)`);
      }
    } else if (totalStatDiff <= 1) {
      statlineScore = 6;
    } else if (totalStatDiff <= 3) {
      if (Math.abs(cFeatures.cmc - tFeatures.cmc) === 1 && (
        (cFeatures.cmc > tFeatures.cmc && (cFeatures.power ?? 0) > (tFeatures.power ?? 0) && (cFeatures.toughness ?? 0) > (tFeatures.toughness ?? 0)) ||
        (cFeatures.cmc < tFeatures.cmc && (cFeatures.power ?? 0) < (tFeatures.power ?? 0) && (cFeatures.toughness ?? 0) < (tFeatures.toughness ?? 0))
      )) {
        statlineScore = 8;
        baselineReasons.push(`Curve-scaled stats (${cFeatures.power}/${cFeatures.toughness} for ${candidate.cmc}M)`);
      } else {
        statlineScore = 5;
      }
    } else if (totalStatDiff <= 4) {
      statlineScore = (bothShareToughnessCombatDamage || bothShareToughnessMatters) ? 7 : 4;
      if (bothShareToughnessCombatDamage || bothShareToughnessMatters) {
        baselineReasons.push(`Comparable high-toughness combat scaling (effective ${tFeatures.effectivePower}/${tFeatures.effectiveToughness} vs ${cFeatures.effectivePower}/${cFeatures.effectiveToughness})`);
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
    } else if (tFeatures.actionSubtypes.has('toughness_4_plus_removal') && cFeatures.actionSubtypes.has('toughness_4_plus_removal')) {
      statlineScore = 10;
      baselineReasons.push('Exact toughness threshold removal (toughness 4+)');
    } else if (tFeatures.actionSubtypes.has('power_toughness_removal') && cFeatures.actionSubtypes.has('power_toughness_removal')) {
      statlineScore = 9;
      baselineReasons.push('Matching power/toughness threshold removal');
    } else if (tFeatures.actionSubtypes.has('permanent_removal') && cFeatures.actionSubtypes.has('permanent_removal')) {
      statlineScore = 9;
      baselineReasons.push('Unrestricted target permanent removal');
    } else if (tFeatures.actionSubtypes.has('unconditional_removal') && cFeatures.actionSubtypes.has('unconditional_removal')) {
      statlineScore = 9;
      baselineReasons.push('Unrestricted target removal');
    } else if (tFeatures.isAuraRemoval && cFeatures.isAuraRemoval) {
      statlineScore = 9;
      baselineReasons.push('Aura-based permanent neutralization');
    } else if (bothShareTutorToTop) {
      statlineScore = 10;
      baselineReasons.push('Exact top-of-library tutor mechanic');
    } else if (bothShareLibraryTutor) {
      statlineScore = 9;
      baselineReasons.push('Matching library tutor effect');
    } else {
      statlineScore = 7;
    }
  } else {
    statlineScore = 5;
  }

  // Rarity Role Affinity: Prioritize same limited drafting tier (Common vs Rare)
  let rarityAdjustment = 0;
  const sharesCounterDistributor = tFeatures.actionSubtypes.has('etb_counter_distributor') && cFeatures.actionSubtypes.has('etb_counter_distributor');
  const sharesExactMechanicArchetype = bothShareExactConverge || bothShareExactSunburst || bothShareLivingWeapon;

  if (tFeatures.rarity === 'common') {
    if (cFeatures.rarity === 'common') {
      rarityAdjustment = 3; // Both are common draft staples
      baselineReasons.push('Common draft staple comp');
    } else if (cFeatures.rarity === 'uncommon') {
      rarityAdjustment = (sharesExactMechanicArchetype || sharesCounterDistributor || bothShareLateGameSacDestruction || bothShareFlyingLifegain || bothShareActivatedTeamPump) ? -1 : -3;
    } else {
      rarityAdjustment = sharesExactMechanicArchetype ? 0 : -8; // Rare/Mythic power-level penalty vs Common draft baseline (waived for exact mechanic archetype mirrors)
    }
  } else if (tFeatures.rarity === 'uncommon') {
    if (cFeatures.rarity === 'uncommon' || cFeatures.rarity === 'common') {
      rarityAdjustment = 2;
    } else {
      rarityAdjustment = (sharesExactMechanicArchetype || bothShareRemovalWithCompensation) ? 0 : -4;
    }
  } else if (tFeatures.rarity === 'rare' || tFeatures.rarity === 'mythic') {
    if (cFeatures.rarity === 'rare' || cFeatures.rarity === 'mythic') {
      rarityAdjustment = 3;
    } else {
      rarityAdjustment = sharesExactMechanicArchetype ? 0 : -2;
    }
  }

  let legendaryPenalty = 0;
  if (!target.type_line?.includes('Legendary') && candidate.type_line?.includes('Legendary')) {
    legendaryPenalty = bothShareFlyingLifegain ? 0 : -3;
  }

  statlineScore = Math.max(0, Math.min(10, statlineScore + rarityAdjustment + legendaryPenalty));

  // =========================================================================
  // FUNCTIONAL DISCREPANCY PENALTIES (Evasion/combat keywords, asymmetric riders, creature types)
  // =========================================================================
  const KEY_COMBAT_KEYWORDS = [
    'flying', 'reach', 'menace', 'deathtouch', 'lifelink', 'haste',
    'first strike', 'double strike', 'vigilance', 'trample', 'ward',
    'flash', 'hexproof', 'indestructible', 'defender'
  ];

  let keywordMismatchPenalty = 0;
  for (const kw of KEY_COMBAT_KEYWORDS) {
    const tHasKw = (target.keywords || []).some(k => k.toLowerCase() === kw) || new RegExp(`\\b${kw}\\b`, 'i').test(target.oracle_text || '');
    const cHasKw = (candidate.keywords || []).some(k => k.toLowerCase() === kw) || new RegExp(`\\b${kw}\\b`, 'i').test(candidate.oracle_text || '');

    if (tHasKw !== cHasKw) {
      if (tFeatures.isCreature && cFeatures.isCreature) {
        if (kw === 'flying') {
          const oneHasReach = tHasKw ? ((candidate.keywords || []).some(k => /reach/i.test(k)) || /reach/i.test(candidate.oracle_text || ''))
                                     : ((target.keywords || []).some(k => /reach/i.test(k)) || /reach/i.test(target.oracle_text || ''));
          if (oneHasReach && (bothShareConvergeSunburst || bothShareMultiColorScaling)) {
            keywordMismatchPenalty += 4;
          } else {
            keywordMismatchPenalty += 12;
          }
        } else if (kw === 'reach' || kw === 'defender') {
          if (bothShareToughnessCombatDamage || bothShareToughnessMatters) {
            keywordMismatchPenalty += 0;
          } else {
            const otherHasFlying = tHasKw
              ? ((candidate.keywords || []).some(k => /flying/i.test(k)) || /flying/i.test(candidate.oracle_text || ''))
              : ((target.keywords || []).some(k => /flying/i.test(k)) || /flying/i.test(target.oracle_text || ''));
            if (otherHasFlying && (bothShareConvergeSunburst || bothShareMultiColorScaling)) {
              keywordMismatchPenalty += 0;
            } else {
              keywordMismatchPenalty += (bothShareConvergeSunburst || bothShareMultiColorScaling) ? 3 : 8;
            }
          }
        } else {
          keywordMismatchPenalty += (bothShareConvergeSunburst || bothShareMultiColorScaling || bothShareToughnessCombatDamage || bothShareToughnessMatters) ? 3 : 5;
        }
      } else if (!isEmpowerCrossMechanicBridge) {
        // Non-creature combat tricks / spells granting keywords
        keywordMismatchPenalty += 2;
      }
    }
  }

  if (bothShareExactConverge || bothShareExactSunburst || bothShareToughnessCombatDamage) {
    keywordMismatchPenalty = Math.min(3, keywordMismatchPenalty);
  } else if (bothShareConvergeSunburst || bothShareMultiColorScaling || bothShareToughnessMatters) {
    keywordMismatchPenalty = Math.min(6, keywordMismatchPenalty);
  }

  const ALL_VALUE_RIDERS = [
    'proliferate', 'token', 'surveil_scry', 'counters',
    'discard_payoff', 'life_gain', 'cantrip', 'ramp'
  ] as const;

  let riderMismatchPenalty = 0;
  for (const vr of ALL_VALUE_RIDERS) {
    if (tFeatures.valueRiders.has(vr) !== cFeatures.valueRiders.has(vr)) {
      if ((isEmpowerCrossMechanicBridge || bothShareEmpowerJace) && ['token', 'surveil_scry', 'cantrip', 'life_gain'].includes(vr)) {
        // Empower Jace functionally bridges tokens, surveil, cantrip, and soft lifegain (damage diversion)
        continue;
      }
      if (bothShareToughness4PlusRemoval || bothSharePowerToughnessRemoval || bothShareModalRemoval) {
        riderMismatchPenalty += 1;
      } else {
        riderMismatchPenalty += 4;
      }
    }
  }
  if (bothShareToughness4PlusRemoval || bothSharePowerToughnessRemoval || bothShareModalRemoval) {
    riderMismatchPenalty = Math.min(2, riderMismatchPenalty);
  }

  let cardTypeMismatchPenalty = 0;
  if (tFeatures.isCreature && cFeatures.isCreature) {
    if (tFeatures.isArtifact !== cFeatures.isArtifact && !bothShareDeathCounterTransfer && !bothShareConvergeSunburst && !bothShareMultiColorScaling) {
      cardTypeMismatchPenalty += 4;
    }
    if (tFeatures.isEnchantment !== cFeatures.isEnchantment) {
      cardTypeMismatchPenalty += 4;
    }
  }
  let tuckMismatchPenalty = 0;
  if ((tFeatures.actionSubtypes.has('tuck_removal') && !cFeatures.isRemoval && !cFeatures.detectedCategories.has('bounce')) ||
      (!tFeatures.isRemoval && !tFeatures.detectedCategories.has('bounce') && cFeatures.actionSubtypes.has('tuck_removal'))) {
    tuckMismatchPenalty += 24;
  }

  const discrepancyPenalty = keywordMismatchPenalty + riderMismatchPenalty + cardTypeMismatchPenalty + excessActionMismatch + tuckMismatchPenalty;
  let rawScore = colorScore + cmcScore + method1LexicalScore + method2StructuralScore + statlineScore - discrepancyPenalty;

  // Learned Precedent Boost & Attribution (Touchstone benchmarks & bridged mechanics)
  const learnedBoost = getLearnedPrecedentBoost(target, candidate, userId);
  if (learnedBoost.boostScore > 0) {
    rawScore += learnedBoost.boostScore;
    if (learnedBoost.reason) {
      structuralReasons.unshift(learnedBoost.reason);
    }
  }

  // Non-reprint ceiling: 100% is strictly reserved for true reprints / functional reprints
  const MAX_NON_REPRINT_SCORE = 95;
  const totalScore = Math.min(MAX_NON_REPRINT_SCORE, Math.max(0, rawScore));

  // Deduplicate and prioritize most insightful structural, speed/tempo, and lexical reasons
  const speedOrTempoReasons = baselineReasons.filter(r => r.includes('Speed') || r.includes('speed') || r.includes('tempo'));
  const otherBaselineReasons = baselineReasons.filter(r => !speedOrTempoReasons.includes(r));
  const uniqueReasons = Array.from(new Set([...structuralReasons, ...speedOrTempoReasons, ...lexicalReasons, ...otherBaselineReasons]));

  return {
    score: totalScore,
    reasons: uniqueReasons.slice(0, 3),
  };
}

export function getCuratedBenchmarkCandidates(
  targetCard: Card,
  fallbackPool: Card[] = []
): Card[] {
  const normTargetName = (targetCard.name || '').trim().toLowerCase();
  const targetSet = (targetCard.set || '').trim().toUpperCase();
  const isDifferentSetAndName = (c: Card) => {
    if (!c) return false;
    const name = (c.name || '').trim().toLowerCase();
    if (!name || name === normTargetName) return false;
    if (targetSet && c.set && c.set.trim().toUpperCase() === targetSet) return false;
    return true;
  };
  const pool = [
    ...fallbackPool.filter(isDifferentSetAndName),
    ...HISTORICAL_BENCHMARK_CARDS.filter(isDifferentSetAndName),
  ];

  const seenNames = new Set<string>();
  const uniquePool: Card[] = [];
  for (const c of pool) {
    const n = (c.name || '').trim().toLowerCase();
    if (n && !seenNames.has(n)) {
      seenNames.add(n);
      uniquePool.push(c);
    }
  }

  const targetColors = new Set((targetCard.colors || []).map(c => c.toUpperCase()));
  const targetType = (targetCard.type_line || '').toLowerCase();
  const targetIsCreature = targetType.includes('creature');
  const targetIsInstant = targetType.includes('instant');
  const targetIsSorcery = targetType.includes('sorcery');
  const targetIsEnchantment = targetType.includes('enchantment');
  const targetIsArtifact = targetType.includes('artifact');
  const targetIsPlaneswalker = targetType.includes('planeswalker');
  const targetIsLand = targetType.includes('land');

  const scored = uniquePool.map(c => {
    let relevance = 0;
    const cType = (c.type_line || '').toLowerCase();
    const tFeatures = extractCardFeatures(targetCard);
    const cFeatures = extractCardFeatures(c);

    // Exact Oracle Clause Match Priority (Directive 2)
    const exactMatch = findExactOracleClauseMatch(targetCard, c, tFeatures, cFeatures);
    if (exactMatch) {
      relevance += 120;
    }

    // Toughness Combat Damage & Toughness Matters Archetype Priority
    const targetIsToughness = tFeatures.actionSubtypes.has('toughness_combat_damage') || tFeatures.actionSubtypes.has('toughness_matters_archetype');
    const cIsToughness = cFeatures.actionSubtypes.has('toughness_combat_damage') || cFeatures.actionSubtypes.has('toughness_matters_archetype');

    if (targetIsToughness && cIsToughness) {
      relevance += 70;
      if (tFeatures.actionSubtypes.has('toughness_combat_damage') && cFeatures.actionSubtypes.has('toughness_combat_damage')) {
        relevance += 30;
      }
      if (tFeatures.actionSubtypes.has('defender_attack_enabler') && cFeatures.actionSubtypes.has('defender_attack_enabler')) {
        relevance += 20;
      }
    } else if (targetIsToughness && !cIsToughness) {
      // Disqualify / heavily demote generic go-wide swarm/token wincons when comparing a toughness engine!
      if (cFeatures.actionSubtypes.has('creature_token_army') || cFeatures.actionSubtypes.has('team_pump') || (c.cmc >= 7 && !cFeatures.actionSubtypes.has('toughness_cost_reduction'))) {
        relevance -= 60;
      }
    }

    // Tuck / Library-Bounce Removal Priority
    const targetIsTuck = tFeatures.actionSubtypes.has('tuck_removal');
    const cIsTuck = cFeatures.actionSubtypes.has('tuck_removal');
    if (targetIsTuck && cIsTuck) {
      relevance += 90;
      if (cFeatures.actionSubtypes.has('scry') || cFeatures.actionSubtypes.has('surveil') || cFeatures.actionSubtypes.has('empower_jace_surveil')) {
        relevance += 20;
      }
    } else if (targetIsTuck && !cFeatures.isRemoval && !cFeatures.detectedCategories.has('bounce')) {
      relevance -= 60;
    }

    // Noncreature Spellslinger Surveil Engine Priority
    const targetIsSpellslingerSurveil = tFeatures.actionSubtypes.has('noncreature_surveil_engine');
    const cIsSpellslingerSurveil = cFeatures.actionSubtypes.has('noncreature_surveil_engine') || (cFeatures.actionSubtypes.has('noncreature_spell_trigger') && (cFeatures.actionSubtypes.has('surveil') || cFeatures.detectedCategories.has('selection')));
    if (targetIsSpellslingerSurveil && cIsSpellslingerSurveil) {
      relevance += 70;
    }

    // Type Match
    if (targetIsCreature && cType.includes('creature')) relevance += 30;
    else if (targetIsInstant && cType.includes('instant')) relevance += 30;
    else if (targetIsSorcery && cType.includes('sorcery')) relevance += 30;
    else if (targetIsEnchantment && cType.includes('enchantment')) relevance += 25;
    else if (targetIsArtifact && cType.includes('artifact')) relevance += 25;
    else if (targetIsPlaneswalker && cType.includes('planeswalker')) relevance += 30;
    else if (targetIsLand && cType.includes('land')) relevance += 30;
    else if ((targetIsInstant || targetIsSorcery) && (cType.includes('instant') || cType.includes('sorcery'))) relevance += 20;

    // Color Match
    const cColors = (c.colors || []).map(x => x.toUpperCase());
    if (targetColors.size === 0 && cColors.length === 0) {
      relevance += 20;
    } else {
      let shared = 0;
      for (const col of cColors) {
        if (targetColors.has(col)) shared++;
      }
      if (shared > 0) {
        relevance += shared * 12;
        if (shared === targetColors.size && cColors.length === targetColors.size) {
          relevance += 12;
        }
      }
    }

    // CMC Proximity
    const targetHasXCost = /\{X\}/i.test(targetCard.mana_cost || '') || /enters.*with X/i.test(targetCard.oracle_text || '');
    const cHasXCost = /\{X\}/i.test(c.mana_cost || '') || /enters.*with X/i.test(c.oracle_text || '');
    if (targetHasXCost || cHasXCost) {
      if (targetHasXCost && cHasXCost) {
        relevance += 40;
      } else if (targetHasXCost && !cHasXCost && c.cmc <= 1) {
        // Heavily penalize fixed 1-drops when searching comps for an X-cost card!
        relevance -= 40;
      }
    } else {
      const cmcDiff = Math.abs(cFeatures.effectiveCmc - tFeatures.effectiveCmc);
      if (cmcDiff <= 0.5) relevance += 15;
      else if (cmcDiff <= 1.5) relevance += 10;
      else if (cmcDiff <= 2.5) relevance += 5;
    }

    // Team and combat counter distribution priority
    const targetIsTeamDistributor = /put\s+(?:a|an|\d+|one|two)?\s*(?:\+1\/\+1)?\s+counters?\s+on\s+each\s+(?:other\s+)?creature\s+you\s+control/i.test(targetCard.oracle_text || '');
    const cIsTeamDistributor = /put\s+(?:a|an|\d+|one|two)?\s*(?:\+1\/\+1)?\s+counters?\s+on\s+each\s+(?:other\s+)?creature\s+you\s+control/i.test(c.oracle_text || '');
    if (targetIsTeamDistributor && cIsTeamDistributor) {
      relevance += 45;
    }

    const targetIsCombatCounter = /at\s+the\s+beginning\s+of\s+combat\s+on\s+your\s+turn.*put\s+(?:a|an|\d+|one|two)?\s*(?:\+1\/\+1)?\s+counter/i.test(targetCard.oracle_text || '') ||
      /at\s+the\s+beginning\s+of\s+combat\s+on\s+your\s+turn.*remove\s+a\s+\+1\/\+1\s+counter/i.test(targetCard.oracle_text || '');
    const cIsCombatCounter = /at\s+the\s+beginning\s+of\s+combat\s+on\s+your\s+turn.*put\s+(?:a|an|\d+|one|two)?\s*(?:\+1\/\+1)?\s+counter/i.test(c.oracle_text || '') ||
      /at\s+the\s+beginning\s+of\s+combat\s+on\s+your\s+turn.*remove\s+a\s+\+1\/\+1\s+counter/i.test(c.oracle_text || '');
    if (targetIsCombatCounter && cIsCombatCounter) {
      relevance += 35;
    }

    // Multicolor Scaling (Converge, Sunburst, Vivid, Domain) Priority
    const targetIsMultiColorScaling = /converge|sunburst|vivid|domain|for each color of mana spent|colors among permanents|basic land type/i.test(targetCard.oracle_text || '') ||
      (targetCard.keywords || []).some(k => /converge|sunburst|vivid/i.test(k));
    const cIsMultiColorScaling = /converge|sunburst|vivid|domain|for each color of mana spent|colors among permanents|basic land type/i.test(c.oracle_text || '') ||
      (c.keywords || []).some(k => /converge|sunburst|vivid/i.test(k));

    if (targetIsMultiColorScaling && cIsMultiColorScaling) {
      relevance += 50;

      const targetIsConvergeSunburst = /converge|sunburst|colors? of mana spent/i.test(targetCard.oracle_text || '') ||
        (targetCard.keywords || []).some(k => /converge|sunburst/i.test(k));
      const cIsConvergeSunburst = /converge|sunburst|colors? of mana spent/i.test(c.oracle_text || '') ||
        (c.keywords || []).some(k => /converge|sunburst/i.test(k));
      if (targetIsConvergeSunburst && cIsConvergeSunburst) {
        relevance += 25;
      }

      const targetIsConverge = /converge/i.test(targetCard.oracle_text || '') || (targetCard.keywords || []).some(k => /converge/i.test(k));
      const cIsConverge = /converge/i.test(c.oracle_text || '') || (c.keywords || []).some(k => /converge/i.test(k));
      if (targetIsConverge && cIsConverge) {
        relevance += 40;
      }

      const targetIsSunburst = /sunburst/i.test(targetCard.oracle_text || '') || (targetCard.keywords || []).some(k => /sunburst/i.test(k));
      const cIsSunburst = /sunburst/i.test(c.oracle_text || '') || (c.keywords || []).some(k => /sunburst/i.test(k));
      if (targetIsSunburst && cIsSunburst) {
        relevance += 40;
      }

      // If target is colorless converge/sunburst and candidate is colorless (e.g. Rancorous Archaic vs Skyreach Manta)
      if (targetColors.size === 0 && (c.colors || []).length === 0) {
        relevance += 20;
      }

      // Shared Reach / Trample combat keywords (e.g. Rancorous Archaic vs Wildvine Pummeler)
      const targetHasReach = /reach/i.test(targetCard.oracle_text || '') || (targetCard.keywords || []).some(k => /reach/i.test(k));
      const cHasReach = /reach/i.test(c.oracle_text || '') || (c.keywords || []).some(k => /reach/i.test(k));
      const targetHasTrample = /trample/i.test(targetCard.oracle_text || '') || (targetCard.keywords || []).some(k => /trample/i.test(k));
      const cHasTrample = /trample/i.test(c.oracle_text || '') || (c.keywords || []).some(k => /trample/i.test(k));

      if (targetHasReach && cHasReach && targetHasTrample && cHasTrample) {
        relevance += 30;
      } else if ((targetHasReach && cHasReach) || (targetHasTrample && cHasTrample)) {
        relevance += 15;
      }
    }

    // Tutor Priority: Noncreature tutors must prioritize other library tutors and penalize removal/tricks
    const targetIsTutor = (targetIsInstant || targetIsSorcery) && /search your library/i.test(targetCard.oracle_text || '');
    const cIsTutor = /search your library/i.test(c.oracle_text || '');
    if (targetIsTutor && cIsTutor) {
      relevance += 50;
    } else if (targetIsTutor && !cIsTutor && (c.oracle_text || '').match(/destroy|exile|\+\d+\/\+\d+|counter target/i)) {
      relevance -= 50;
    }

    // Empower Jace Priority: Benchmark cards with matching functional roles
    const targetHasEmpower = /empower jace/i.test(targetCard.oracle_text || '');
    if (targetHasEmpower) {
      const match = (targetCard.oracle_text || '').match(/empower jace\s*(\d+)?/i);
      const count = match ? (match[1] ? parseInt(match[1], 10) : 1) : 1;
      const cOracle = (c.oracle_text || '').toLowerCase();
      const cName = (c.name || '').toLowerCase();

      if (count <= 2 && /surveil|scry/i.test(cOracle)) {
        relevance += 40;
      }
      if (count >= 3 && /draw a card/i.test(cOracle)) {
        relevance += 40;
      }
      if (/amass|investigate|clue token/i.test(cOracle)) {
        relevance += 35;
      }
      if (targetIsCreature && cName === 'sterling hound') {
        relevance += 60;
      }
      if (targetIsInstant && /counter target/i.test(targetCard.oracle_text || '') && cName === "saruman's trickery") {
        relevance += 60;
      }
      if (targetIsInstant && /target creature gets/i.test(targetCard.oracle_text || '') && cName === 'auspicious arrival') {
        relevance += 60;
      }
      if (targetIsSorcery && /create .* token/i.test(targetCard.oracle_text || '') && cName === 'imperial oath') {
        relevance += 60;
      }
      if (targetIsSorcery && count >= 6 && cName === 'ancestral reminiscence') {
        relevance += 60;
      }
    }

    // Token Anthem & Discard / Channel Removal Priority
    const targetIsTokenAnthem = (
      /creature tokens (?:you control )?get \+[0-9x]+\/\+[0-9x]+/i.test(targetCard.oracle_text || '') ||
      /tokens you control get \+[0-9x]+\/\+[0-9x]+/i.test(targetCard.oracle_text || '') ||
      /creature tokens you control (?:get|have)/i.test(targetCard.oracle_text || '')
    );
    const cIsTokenAnthem = (
      /creature tokens (?:you control )?get \+[0-9x]+\/\+[0-9x]+/i.test(c.oracle_text || '') ||
      /tokens you control get \+[0-9x]+\/\+[0-9x]+/i.test(c.oracle_text || '') ||
      /creature tokens you control (?:get|have)/i.test(c.oracle_text || '')
    );
    if (targetIsTokenAnthem && cIsTokenAnthem) {
      relevance += 80;
    } else if (targetIsTokenAnthem) {
      const cIsTeamAnthem = /creatures you control get \+[0-9x]+\/\+[0-9x]+/i.test(c.oracle_text || '');
      if (cIsTeamAnthem) relevance += 40;
      // Demote pure artifact reanimators / combo artifacts
      if (/exile.*artifacts.*from your graveyard|sacrifice an artifact/i.test(c.oracle_text || '')) {
        relevance -= 60;
      }
    }

    const targetIsDiscardRemoval = /discard (?:this card|~):\s*(?:(?:it|~) deals \d+ damage|destroy target|exile target)/i.test(targetCard.oracle_text || '');
    if (targetIsDiscardRemoval) {
      const cIsCombatOrInstantRemoval = /deals \d+ damage to target attacking or blocking creature|target attacking or blocking creature/i.test(c.oracle_text || '');
      if (cIsCombatOrInstantRemoval) {
        relevance += 60;
      }
      const cIsChannelOrDiscard = /channel\s*—|discard (?:this card|~):/i.test(c.oracle_text || '');
      if (cIsChannelOrDiscard) {
        relevance += 50;
      }
    }

    return { card: c, relevance };
  });

  scored.sort((a, b) => b.relevance - a.relevance);
  return scored
    .slice(0, 24)
    .map(s => s.card)
    .filter(c => !targetSet || !c.set || c.set.trim().toUpperCase() !== targetSet);
}

/**
 * Bulletproof fallback engine: Instantly generates 4 authentic comparable cards
 * with 17Lands win rates and tiers from the curated premier benchmark library and local pool.
 * Guaranteed to never return empty.
 */
export function generateGuaranteedFallbackResult(
  targetCard: Card,
  fallbackPool: Card[] = []
): CardSimilarityResult {
  const targetSet = (targetCard.set || '').trim().toUpperCase();
  const candidates = getCuratedBenchmarkCandidates(targetCard, fallbackPool)
    .filter(cand => !targetSet || !cand.set || cand.set.trim().toUpperCase() !== targetSet);
  const scored = candidates.map(cand => {
    const { score, reasons } = calculateCardSimilarity(targetCard, cand);
    const boostedScore = Math.max(38, Math.min(95, score));
    const fallbackReasons = reasons.length > 0 ? reasons : [
      `Matching ${targetCard.cmc}-mana ${targetCard.colors?.length ? targetCard.colors.join('/') : 'colorless'} curve spot`,
      `Premier draft historical archetype staple`
    ];
    return { card: cand, score: boostedScore, reasons: fallbackReasons };
  });

  scored.sort((a, b) => b.score - a.score);
  const top4 = scored
    .filter(s => !targetSet || !s.card.set || s.card.set.trim().toUpperCase() !== targetSet)
    .slice(0, 4);

  const matches: SimilarCardMatch[] = top4.map(({ card, score, reasons }) => {
    const r = getOrEstimate17LandsCardRating(card, null);
    const winRate = r?.win_rate ?? 0.54;
    const alsa = r?.avg_seen ?? 4.5;
    const tierGrade: GradeTier = (r?.tier_grade as GradeTier | undefined) || winRateToGradeTier(winRate);
    return {
      card,
      similarityScore: score,
      matchReasons: reasons,
      winRate,
      alsa,
      tierGrade,
    };
  });

  const consensus = calculateHistoricalConsensus(matches, targetCard);
  return {
    targetCard,
    matches,
    consensus,
  };
}

/**
 * Main engine: Finds similar cards from past sets, pulls their 17Lands & LSV ratings,
 * and synthesizes an empirical consensus projection.
 * Guaranteed to ALWAYS return at least 4 comparable cards.
 */
export async function findSimilarCards(
  targetCard: Card,
  fallbackPool: Card[] = [],
  userId?: string
): Promise<CardSimilarityResult> {
  const cacheKey = `${targetCard.set.toUpperCase()}_${targetCard.name.toUpperCase()}_v68`;
  if (similarityCache.has(cacheKey)) {
    const cached = similarityCache.get(cacheKey)!;
    if (cached && cached.matches && cached.matches.length >= 2) {
      return cached;
    }
  }

  try {
    const features = extractCardFeatures(targetCard);
    const queries = buildScryfallQueries(targetCard, features);

    const targetSet = (targetCard.set || '').trim().toUpperCase();
    const isExcluded = (c: Card) => {
      if (!c || !c.name) return true;
      if (c.name.toLowerCase() === targetCard.name.toLowerCase()) return true;
      if (targetSet && c.set && c.set.trim().toUpperCase() === targetSet) return true;
      return false;
    };

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
            // Filter duplicates and same-set cards
            rawCards.forEach((c: Card) => {
              if (!candidateCards.some(existing => existing.name.toLowerCase() === c.name.toLowerCase()) &&
                  !isExcluded(c)) {
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

    // Universal Fallback Guarantee: If specific queries yielded fewer than 12 candidates,
    // execute a broad curve & archetype query across modern premier sets to guarantee comps
    if (candidateCards.length < 12) {
      try {
        const mainColor = targetCard.colors && targetCard.colors.length > 0 && targetCard.colors[0] !== 'C'
          ? `c:${targetCard.colors[0].toLowerCase()}`
          : 'c:c';
        const typeTerm = features.isCreature
          ? 't:creature'
          : (features.isInstant ? 't:instant' : (features.isSorcery ? 't:sorcery' : (features.isAura ? 't:aura' : (features.isEnchantment ? 't:enchantment' : (features.isArtifact ? 't:artifact' : (features.isPlaneswalker ? 't:planeswalker' : (features.isLand ? 't:land' : '')))))));
        const cmcTerm = features.hasXCost ? 'm:{X}' : `m>=${Math.max(0, targetCard.cmc - 1)} m<=${targetCard.cmc + 1}`;
        const setTerms = COMPARABLE_PREMIER_SETS
          .filter(s => !targetSet || s.toUpperCase() !== targetSet)
          .slice(0, 16)
          .map(s => `s:${s.toLowerCase()}`)
          .join(' or ');
        const fallbackQuery = `(${setTerms}) ${typeTerm} ${mainColor} ${cmcTerm} is:booster${targetCard.set ? ` -s:${targetCard.set.toLowerCase()}` : ''}`;

        const url = `${SCRYFALL_API_BASE}/cards/search?q=${encodeURIComponent(fallbackQuery)}&order=released&dir=desc`;
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
            rawCards.forEach((c: Card) => {
              if (!candidateCards.some(existing => existing.name.toLowerCase() === c.name.toLowerCase()) &&
                  !isExcluded(c)) {
                candidateCards.push(c);
              }
            });
          }
        }
      } catch (err) {
        console.warn('Broad fallback candidate search failed:', err);
      }
    }

    // Curated Benchmark Candidates: Always inject high-relevance curated benchmark cards into candidate pool
    const benchmarkCandidates = getCuratedBenchmarkCandidates(targetCard, fallbackPool);
    benchmarkCandidates.slice(0, 10).forEach((c) => {
      if (!candidateCards.some(existing => existing.name.toLowerCase() === c.name.toLowerCase()) &&
          !isExcluded(c)) {
        candidateCards.push(c);
      }
    });

    // Learned Precedent Touchstones & Benchmarks (dynamically learned from user tuning)
    const learnedCandidates = getLearnedBenchmarkCandidates(targetCard, userId);
    learnedCandidates.forEach(({ card: c }) => {
      if (!candidateCards.some(existing => existing.name.toLowerCase() === c.name.toLowerCase()) &&
          !isExcluded(c)) {
        candidateCards.push(c);
      }
    });

    if (candidateCards.length < 12) {
      benchmarkCandidates.forEach((c) => {
        if (!candidateCards.some(existing => existing.name.toLowerCase() === c.name.toLowerCase()) &&
            !isExcluded(c)) {
          candidateCards.push(c);
        }
      });
    }

    // Score candidates against target card
    let scoredCandidates: { card: Card; score: number; reasons: string[] }[] = [];
    for (const cand of candidateCards) {
      if (isExcluded(cand)) continue;
      const { score, reasons } = calculateCardSimilarity(targetCard, cand, userId);
      if (score >= 58) {
        scoredCandidates.push({ card: cand, score, reasons });
      }
    }

    if (scoredCandidates.length < 4) {
      for (const cand of candidateCards) {
        if (isExcluded(cand)) continue;
        if (!scoredCandidates.some(sc => sc.card.name.toLowerCase() === cand.name.toLowerCase())) {
          const { score, reasons } = calculateCardSimilarity(targetCard, cand, userId);
          if (score >= 45) {
            scoredCandidates.push({ card: cand, score, reasons });
          }
        }
      }
    }

    if (scoredCandidates.length < 4) {
      for (const cand of candidateCards) {
        if (isExcluded(cand)) continue;
        if (!scoredCandidates.some(sc => sc.card.name.toLowerCase() === cand.name.toLowerCase())) {
          const { score, reasons } = calculateCardSimilarity(targetCard, cand, userId);
          if (score >= 35) {
            scoredCandidates.push({ card: cand, score, reasons });
          }
        }
      }
    }

    if (scoredCandidates.length < 4) {
      for (const cand of candidateCards) {
        if (isExcluded(cand)) continue;
        if (!scoredCandidates.some(sc => sc.card.name.toLowerCase() === cand.name.toLowerCase())) {
          const { score, reasons } = calculateCardSimilarity(targetCard, cand, userId);
          if (score >= 20) {
            scoredCandidates.push({ card: cand, score, reasons });
          }
        }
      }
    }

    // Absolute Guarantee: If STILL fewer than 4 candidates, score remaining candidates with baseline clamp
    if (scoredCandidates.length < 4) {
      for (const cand of candidateCards) {
        if (isExcluded(cand)) continue;
        if (!scoredCandidates.some(sc => sc.card.name.toLowerCase() === cand.name.toLowerCase())) {
          const { score, reasons } = calculateCardSimilarity(targetCard, cand, userId);
          const boostedScore = Math.max(35, score);
          const fallbackReasons = reasons.length > 0 ? reasons : [
            `Similar ${targetCard.cmc}-mana ${targetCard.colors?.join('/') || 'colorless'} curve role`,
            `Comparable premier draft archetype benchmark`
          ];
          scoredCandidates.push({ card: cand, score: boostedScore, reasons: fallbackReasons });
        }
      }
    }

    // Ensure all scored candidates strictly exclude target set
    scoredCandidates = scoredCandidates.filter(sc => !isExcluded(sc.card));

    if (scoredCandidates.length < 4) {
      const extraFallbacks = getCuratedBenchmarkCandidates(targetCard, fallbackPool)
        .filter(c => !isExcluded(c));
      for (const cand of extraFallbacks) {
        if (!scoredCandidates.some(sc => sc.card.name.toLowerCase() === cand.name.toLowerCase())) {
          const { score, reasons } = calculateCardSimilarity(targetCard, cand);
          scoredCandidates.push({
            card: cand,
            score: Math.max(35, score),
            reasons: reasons.length > 0 ? reasons : [`Comparable premier draft archetype benchmark`],
          });
        }
        if (scoredCandidates.length >= 4) break;
      }
    }

    // Sort by highest similarity
    function compareSimilarMatches(
      a: { card: Card; score?: number; similarityScore?: number },
      b: { card: Card; score?: number; similarityScore?: number }
    ): number {
      const scoreA = a.score ?? a.similarityScore ?? 0;
      const scoreB = b.score ?? b.similarityScore ?? 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      if (features.isModalSpell) {
        const aModal = /choose (one|two|three)\b/i.test(a.card.oracle_text || '') ? 1 : 0;
        const bModal = /choose (one|two|three)\b/i.test(b.card.oracle_text || '') ? 1 : 0;
        if (aModal !== bModal) return bModal - aModal;
      }
      if (features.hasEmpowerJace) {
        // 1. Exact mechanic affinity
        // For count <= 2, prioritize surveil over scry (Jace loyalty ability is [-1]: Surveil 1)
        const aIsSurveil = /surveil/i.test(a.card.oracle_text || '') ? 1 : 0;
        const bIsSurveil = /surveil/i.test(b.card.oracle_text || '') ? 1 : 0;
        if (features.empowerJaceCount <= 2 && aIsSurveil !== bIsSurveil) return bIsSurveil - aIsSurveil;

        // For count 2 creatures / non-token cards, prioritize Surveil 2 / Scry 2 over Surveil 1 / Scry 1
        if (features.empowerJaceCount === 2 && !features.createsTokens) {
          const aCount2 = /surveil 2|scry 2/i.test(a.card.oracle_text || '') ? 1 : 0;
          const bCount2 = /surveil 2|scry 2/i.test(b.card.oracle_text || '') ? 1 : 0;
          if (aCount2 !== bCount2) return bCount2 - aCount2;
        }

        // For multi-token spells, prioritize 2/2 tokens (Imperial Oath parallel)
        if (features.createsTokens && features.isSorcery) {
          const aTokens22 = /2\/2/i.test(a.card.oracle_text || '') ? 1 : 0;
          const bTokens22 = /2\/2/i.test(b.card.oracle_text || '') ? 1 : 0;
          if (aTokens22 !== bTokens22) return bTokens22 - aTokens22;
        }

        // For counterspells, prioritize amass (Saruman's Trickery parallel)
        if (features.actionSubtypes.has('hard_counter') || features.detectedCategories.has('counter')) {
          const aAmass = /amass/i.test(a.card.oracle_text || '') ? 1 : 0;
          const bAmass = /amass/i.test(b.card.oracle_text || '') ? 1 : 0;
          if (aAmass !== bAmass) return bAmass - aAmass;
        }

        // For combat tricks, prioritize investigate (Auspicious Arrival parallel)
        if (features.isCombatTrick) {
          const aInvestigate = /investigate/i.test(a.card.oracle_text || '') ? 1 : 0;
          const bInvestigate = /investigate/i.test(b.card.oracle_text || '') ? 1 : 0;
          if (aInvestigate !== bInvestigate) return bInvestigate - aInvestigate;
        }

        // For big draw sorceries (Empower Jace >= 6), prioritize 3-card draw (Ancestral Reminiscence parallel)
        if (features.empowerJaceCount >= 6 && features.isSorcery) {
          const aDraw3 = /draw (three|3) cards/i.test(a.card.oracle_text || '') ? 1 : 0;
          const bDraw3 = /draw (three|3) cards/i.test(b.card.oracle_text || '') ? 1 : 0;
          if (aDraw3 !== bDraw3) return bDraw3 - aDraw3;
        }

        // Curated benchmark precedence when scores tie
        const aIsBench = (a.card.id.startsWith('bench_') || HISTORICAL_BENCHMARK_NAMES.has(a.card.name.trim().toLowerCase())) ? 1 : 0;
        const bIsBench = (b.card.id.startsWith('bench_') || HISTORICAL_BENCHMARK_NAMES.has(b.card.name.trim().toLowerCase())) ? 1 : 0;
        if (aIsBench !== bIsBench) return bIsBench - aIsBench;

        const aRoleMatch = (features.empowerJaceCount <= 2 && /surveil|scry/i.test(a.card.oracle_text || '')) ||
                           (features.empowerJaceCount >= 3 && /draw a card/i.test(a.card.oracle_text || '')) ||
                           /amass/i.test(a.card.oracle_text || '');
        const bRoleMatch = (features.empowerJaceCount <= 2 && /surveil|scry/i.test(b.card.oracle_text || '')) ||
                           (features.empowerJaceCount >= 3 && /draw a card/i.test(b.card.oracle_text || '')) ||
                           /amass/i.test(b.card.oracle_text || '');
        if (aRoleMatch !== bRoleMatch) return (bRoleMatch ? 1 : 0) - (aRoleMatch ? 1 : 0);
      }
      const targetIsColorless = (!targetCard.colors || targetCard.colors.filter(c => c !== 'C').length === 0);
      const aIsColorless = (!a.card.colors || a.card.colors.filter(c => c !== 'C').length === 0) ? 1 : 0;
      const bIsColorless = (!b.card.colors || b.card.colors.filter(c => c !== 'C').length === 0) ? 1 : 0;
      if (targetIsColorless) {
        if (aIsColorless !== bIsColorless) return bIsColorless - aIsColorless;
      } else {
        if (aIsColorless !== bIsColorless) return aIsColorless - bIsColorless;
      }
      const aCmcDiff = Math.abs(a.card.cmc - targetCard.cmc);
      const bCmcDiff = Math.abs(b.card.cmc - targetCard.cmc);
      if (aCmcDiff !== bCmcDiff) return aCmcDiff - bCmcDiff;
      return (a.card.oracle_text || '').length - (b.card.oracle_text || '').length;
    }

    scoredCandidates.sort(compareSimilarMatches);

    const topCandidates = scoredCandidates.slice(0, 24);

    // Group by set to batch-fetch 17Lands datasets
    const neededSets = Array.from(new Set(topCandidates.map(c => c.card.set.toUpperCase())))
      .filter(setCode => {
        const known = POPULAR_LIMITED_SETS.find(s => s.code.toUpperCase() === setCode);
        return !known || known.has_17lands_data !== false;
      })
      .slice(0, 14);
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

    // Assemble enriched matches with verified or estimated 17Lands data
    const enrichedMatches: SimilarCardMatch[] = [];
    for (const { card, score, reasons } of topCandidates) {
      const setCode = card.set.toUpperCase();
      const setData = setDatasets[setCode];
      const card17L = getOrEstimate17LandsCardRating(card, setData);

      const winRate = card17L?.win_rate ?? 0.54;
      const alsa = card17L?.avg_seen ?? 4.5;
      const tierGrade: GradeTier = (card17L?.tier_grade as GradeTier | undefined) || winRateToGradeTier(winRate);

      enrichedMatches.push({
        card,
        similarityScore: score,
        matchReasons: reasons,
        winRate,
        alsa,
        tierGrade,
      });
    }

    if (enrichedMatches.length === 0) {
      return generateGuaranteedFallbackResult(targetCard, fallbackPool);
    }

    // Diversity filter for the 4 presented matches:
    const presentedMatches: SimilarCardMatch[] = [];
    const roleCmcCounts: Record<string, number> = {};

    const sortedForPresentation = [...enrichedMatches].sort((a, b) => {
      const scoreDiff = b.similarityScore - a.similarityScore;
      if (Math.abs(scoreDiff) >= 6) {
        return scoreDiff;
      }
      return compareSimilarMatches(a, b);
    });

    for (const match of sortedForPresentation) {
      const cardFeatures = extractCardFeatures(match.card);
      const primarySubtype = cardFeatures.actionSubtypes.has('tutor_to_top')
        ? 'tutor_to_top'
        : (cardFeatures.actionSubtypes.has('library_tutor')
          ? 'library_tutor'
          : (cardFeatures.actionSubtypes.has('activated_team_pump')
            ? 'activated_team_pump'
            : (cardFeatures.actionSubtypes.has('team_pump')
              ? 'team_pump'
              : (cardFeatures.actionSubtypes.has('toughness_4_plus_removal')
                ? 'toughness_4_plus_removal'
                : (cardFeatures.actionSubtypes.has('modal_removal')
                  ? 'modal_removal'
                  : (cardFeatures.actionSubtypes.has('ability_loss_aura')
                    ? 'ability_loss_aura'
                    : (cardFeatures.actionSubtypes.has('freeze_aura')
                      ? 'freeze_aura'
                      : (cardFeatures.actionSubtypes.has('pacifism_aura')
                        ? 'pacifism_aura'
                        : (cardFeatures.actionSubtypes.has('aura_removal')
                          ? 'aura_removal'
                          : (cardFeatures.actionSubtypes.has('flash_reach_ambush')
                            ? 'flash_reach_ambush'
                            : (cardFeatures.actionSubtypes.has('etb_treasure')
                              ? 'etb_treasure'
                              : (cardFeatures.actionSubtypes.has('land_tutor_top')
                                ? 'land_tutor_top'
                                : (cardFeatures.actionSubtypes.has('flying_lifegain_evasion')
                                  ? 'flying_lifegain_evasion'
                                  : (cardFeatures.actionSubtypes.has('combat_removal')
                                    ? 'combat_removal'
                                    : (cardFeatures.actionSubtypes.has('removal_with_compensation')
                                      ? 'removal_with_compensation'
                                      : (cardFeatures.actionSubtypes.has('power_toughness_removal')
                                        ? 'power_toughness_removal'
                                        : [...cardFeatures.actionSubtypes].filter(s => s !== 'aggressive_attacker' && s !== 'defensive_wall' && s !== 'etb_value').sort().join('+')))))))))))))))));
      const roleKey = primarySubtype;

      const isTargetTutor = features.actionSubtypes.has('library_tutor');
      const isTargetConditionalRemoval = features.actionSubtypes.has('toughness_4_plus_removal') || features.actionSubtypes.has('power_toughness_removal') || features.actionSubtypes.has('modal_removal');
      const maxAllowed = (primarySubtype === 'flash_reach_ambush' || primarySubtype === 'combat_removal')
        ? 1
        : ((isTargetTutor && (primarySubtype === 'library_tutor' || primarySubtype === 'tutor_to_top')) || primarySubtype === 'activated_team_pump' || (isTargetConditionalRemoval && (primarySubtype === 'toughness_4_plus_removal' || primarySubtype === 'modal_removal' || primarySubtype === 'power_toughness_removal'))
          ? 4
          : (primarySubtype === 'removal_with_compensation' ? 3 : 2));
      const currentCount = roleCmcCounts[roleKey] || 0;

      if (currentCount < maxAllowed) {
        roleCmcCounts[roleKey] = currentCount + 1;
        presentedMatches.push(match);
        if (presentedMatches.length >= 4) break;
      }
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

    // If still < 4, fill from benchmark cards
    if (presentedMatches.length < 4) {
      const fallbackResult = generateGuaranteedFallbackResult(targetCard, fallbackPool);
      for (const match of fallbackResult.matches) {
        if (!presentedMatches.some(m => m.card.id === match.card.id || m.card.name.toLowerCase() === match.card.name.toLowerCase())) {
          presentedMatches.push(match);
          if (presentedMatches.length >= 4) break;
        }
      }
    }

    // Sort presented matches by similarity score and specific archetype tie-breakers
    presentedMatches.sort(compareSimilarMatches);

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
  } catch (err) {
    console.warn('findSimilarCards encountered unexpected error, using guaranteed fallback:', err);
    return generateGuaranteedFallbackResult(targetCard, fallbackPool);
  }
}

/**
 * Calculates historical consensus projection based purely on 17Lands comps
 */
export function calculateHistoricalConsensus(matches: SimilarCardMatch[], targetCard: Card): HistoricalCompsConsensus {
  if (matches.length === 0) {
    return {
      sampleCount: 0,
      projectedTier: 'C',
      summaryText: 'Historical precedent indicates a Grade Average of C.',
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

/**
 * Builds an enriched SimilarCardMatch for an arbitrary user-selected replacement card
 * against a target card, computing its similarity and fetching 17Lands telemetry.
 */
export async function buildCustomPrecedentMatch(
  targetCard: Card,
  replacementCard: Card
): Promise<SimilarCardMatch> {
  const { score, reasons } = calculateCardSimilarity(targetCard, replacementCard);

  let winRate: number | undefined;
  let alsa: number | undefined;
  let tierGrade: GradeTier | undefined;

  const setCode = (replacementCard.set || '').toUpperCase();
  try {
    const setData = await fetch17LandsSetData(setCode);
    const card17L = getOrEstimate17LandsCardRating(replacementCard, setData);
    winRate = card17L?.win_rate;
    alsa = card17L?.avg_seen;
    tierGrade = (card17L?.tier_grade as GradeTier) || (typeof winRate === 'number' ? winRateToGradeTier(winRate) : undefined);
  } catch {
    const card17L = getOrEstimate17LandsCardRating(replacementCard, null);
    winRate = card17L?.win_rate;
    alsa = card17L?.avg_seen;
    tierGrade = (card17L?.tier_grade as GradeTier) || (typeof winRate === 'number' ? winRateToGradeTier(winRate) : undefined);
  }

  // Fallback estimation if not found in 17lands data
  if (!tierGrade) {
    const estimated = getOrEstimate17LandsCardRating(replacementCard, null);
    tierGrade = (estimated?.tier_grade as GradeTier) || 'C';
    if (typeof winRate !== 'number' && typeof estimated?.win_rate === 'number') {
      winRate = estimated.win_rate;
    }
  }

  return {
    card: replacementCard,
    similarityScore: score,
    matchReasons: reasons,
    winRate,
    alsa,
    tierGrade,
    isCustomOverride: true,
  };
}

/**
 * Formats a target reference card and its comparable precedent cards into
 * a standardized tuning capture string:
 * "<Ref card name> vs <comp1 name>, <comp2 name>, <comp3 name>, <comp4 name>"
 */
export function buildCompTuningString(targetCard: Card, matches: SimilarCardMatch[]): string {
  if (!targetCard) return '';
  const compNames = matches
    .map((m) => m.card?.name)
    .filter(Boolean)
    .join(', ');

  return `${targetCard.name} vs ${compNames}`;
}
