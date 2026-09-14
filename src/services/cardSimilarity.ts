import { Card, GradeTier, MTGColor, MTGRarity } from '../types/mtg';
import { normalizeScryfallCard, POPULAR_LIMITED_SETS } from './scryfall';
import { fetch17LandsSetData, winRateToGradeTier, gradeTierToIndex, indexToGradeTier, GRADE_SCORES, scoreToGradeTier, getOrEstimate17LandsCardRating } from './seventeenLands';

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

  // Blue
  createBenchmarkCard('Consider', 'MID', '{U}', 1, 'Instant', 'Surveil 1. Draw a card.', ['U']),
  createBenchmarkCard('Shore Up', 'BLB', '{U}', 1, 'Instant', 'Target creature you control gets +1/+1 and gains hexproof until end of turn. Untap it.', ['U']),
  createBenchmarkCard('Into the Flood Maw', 'BLB', '{U}', 1, 'Instant', "Gift a tapped Fish. Return target nonland permanent an opponent controls to its owner's hand.", ['U'], undefined, undefined, 'uncommon'),
  createBenchmarkCard("Long River's Pull", 'BLB', '{U}{U}', 2, 'Instant', 'Gift a card. Counter target creature spell. If the gift was promised, counter target spell instead.', ['U'], undefined, undefined, 'uncommon'),
  createBenchmarkCard('Falcon Abomination', 'MID', '{2}{U}', 3, 'Creature — Zombie Bird', 'Flying. When Falcon Abomination enters the battlefield, create a 2/2 black Zombie creature token with decayed.', ['U'], '2', '2', 'common', ['Flying']),
  createBenchmarkCard('Waterwind Scout', 'LCI', '{2}{U}', 3, 'Creature — Merfolk Scout', 'Flying. When Waterwind Scout enters the battlefield, create a Map token.', ['U'], '2', '2', 'common', ['Flying']),
  createBenchmarkCard('Organ Hoarder', 'MID', '{3}{U}', 4, 'Creature — Zombie', 'When Organ Hoarder enters the battlefield, look at the top three cards of your library. Put one of them into your hand and the rest into your graveyard.', ['U'], '3', '2'),
  createBenchmarkCard('Daring Waverider', 'BLB', '{4}{U}{U}', 6, 'Creature — Otter Wizard', 'When Daring Waverider enters the battlefield, you may cast target instant or sorcery card from your graveyard without paying its mana cost.', ['U'], '4', '4', 'uncommon'),

  // Black
  createBenchmarkCard('Eaten Alive', 'MID', '{B}', 1, 'Sorcery', 'As an additional cost to cast this spell, sacrifice a creature or pay {2}{B}. Exile target creature or planeswalker.', ['B']),
  createBenchmarkCard('Disfigure', 'BRO', '{B}', 1, 'Instant', 'Target creature gets -2/-2 until end of turn.', ['B']),
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

  // Colorless & Artifacts
  createBenchmarkCard('Candy Trail', 'WOE', '{1}', 1, 'Artifact — Food Clue', 'When Candy Trail enters the battlefield, scry 2. {2}, {T}, Sacrifice Candy Trail: You gain 3 life and draw a card.', []),
  createBenchmarkCard('Witching Well', 'ELD', '{U}', 1, 'Artifact', 'When Witching Well enters the battlefield, scry 2. {3}{U}, Sacrifice Witching Well: Draw two cards.', ['U']),
  createBenchmarkCard('Clockwork Percussionist', 'DSK', '{1}', 1, 'Artifact Creature — Monkey', 'Haste. When Clockwork Percussionist dies, exile the top card of your library. You may play it until the end of your next turn.', [], '1', '1', 'common', ['Haste']),
  createBenchmarkCard('Campus Guide', 'STX', '{2}', 2, 'Artifact Creature — Golem', 'When Campus Guide enters the battlefield, you may search your library for a basic land card, reveal it, then shuffle and put that card on top.', [], '2', '1'),
  createBenchmarkCard('Patchwork Banner', 'BLB', '{3}', 3, 'Artifact', 'As Patchwork Banner enters the battlefield, choose a creature type. Creatures you control of the chosen type get +1/+1. {T}: Add one mana of any color.', [], undefined, undefined, 'uncommon'),
  createBenchmarkCard('Throwing Knife', 'OTJ', '{2}', 2, 'Artifact — Equipment', 'Equipped creature gets +1/+0. Whenever equipped creature attacks, you may sacrifice Throwing Knife. When you do, it deals 2 damage to any target and you draw a card. Equip {1}.', []),

  // Multicolor Archetypes
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
];

// Known Limited functional effect clauses with category classification
export interface EffectPattern {
  pattern: RegExp;
  label: string;
  category: 'removal' | 'damage' | 'counter' | 'draw' | 'selection' | 'trick' | 'bounce' | 'pacifism' | 'token' | 'counters' | 'sweeper' | 'synergy' | 'graveyard' | 'equipment';
}

const EFFECT_PATTERNS: EffectPattern[] = [
  { pattern: /(destroy|exile) (up to one )?target (attacking |tapped |blocking |nontoken |nonartifact |non-outlaw |nonlegendary |nonblack |artifact or |enchantment or )?creature/i, label: 'Creature Removal', category: 'removal' },
  { pattern: /(destroy|exile) (up to one )?target creature/i, label: 'Creature Removal', category: 'removal' },
  { pattern: /destroy target \[(attacking|blocking|tapped)\] creature/i, label: 'Creature Removal', category: 'removal' },
  { pattern: /(destroy|exile) target (permanent|nonland permanent)/i, label: 'Permanent Removal', category: 'removal' },
  { pattern: /deals \d+ damage to (any target|target creature)/i, label: 'Burn / Direct Damage', category: 'damage' },
  { pattern: /deals \d+ damage to each creature/i, label: 'Board Wipe / Sweeper', category: 'sweeper' },
  { pattern: /destroy all creatures/i, label: 'Board Wipe / Wrath', category: 'sweeper' },
  { pattern: /counter target (spell|noncreature spell|creature spell)/i, label: 'Counterspell', category: 'counter' },
  { pattern: /draw (a|\d+) cards?/i, label: 'Card Draw', category: 'draw' },
  { pattern: /target creature gets [+-]\d+\/[+-]\d+/i, label: 'Stat Modifier', category: 'trick' },
  { pattern: /(creatures|attacking creatures|other creatures) you control get [+-]\d+\/[+-]\d+/i, label: 'Team Stat Buff / Anthem', category: 'trick' },
  { pattern: /\{[0-9WUBRG]+\}(, \{t\})?: (creatures|attacking creatures|other creatures) you control get/i, label: 'Activated Team Pump / Mana Sink', category: 'trick' },
  { pattern: /create (a|\d+) .* token/i, label: 'Token Creation', category: 'token' },
  { pattern: /put (a|\d+) \+1\/\+1 counter/i, label: '+1/+1 Counter', category: 'counters' },
  { pattern: /return target .* to its owner's hand/i, label: 'Bounce Effect', category: 'bounce' },
  { pattern: /target creature can't (block|attack)/i, label: 'Pacifism / Lock', category: 'pacifism' },
  { pattern: /enchanted (creature|permanent) (can't attack|can't block|doesn't untap)/i, label: 'Pacifism Aura', category: 'pacifism' },
  { pattern: /enchanted (creature|permanent) loses all abilities|lose all abilities|has no abilities/i, label: 'Ability Loss Aura', category: 'pacifism' },
  { pattern: /base power and toughness/i, label: 'Stat Reduction / Transformation', category: 'pacifism' },
  { pattern: /doesn't untap during (its|their) controller's untap step|doesn't untap/i, label: 'Freeze Lockdown', category: 'pacifism' },
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
  const hasFlying = (card.keywords || []).some(k => k.toLowerCase() === 'flying') || oracle.includes('flying');
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
  } else if (/destroy all creatures|deals \d+ damage to each creature|exile all creatures/i.test(oracle)) {
    actionSubtypes.add('sweeper');
  } else if (/deals \d+ damage to (any target|target creature)/i.test(oracle)) {
    actionSubtypes.add('burn_damage');
  } else if (/deals damage equal to (its|target creature's) power|fights target creature/i.test(oracle)) {
    actionSubtypes.add('bite_fight');
  } else if (/(destroy|exile) target (permanent|nonland permanent)/i.test(oracle)) {
    actionSubtypes.add('permanent_removal');
    actionSubtypes.add('unconditional_removal');
  } else {
    const isCreatureDestructionOrExile = (
      /(destroy|exile) (up to one )?target (attacking |tapped |blocking |nontoken |nonartifact |non-outlaw |nonlegendary |nonblack |artifact or |enchantment or )?creature/i.test(oracle) ||
      /(destroy|exile) (up to one )?target creature/i.test(oracle) ||
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
  if (/proliferate/i.test(oracle)) valueRiders.add('proliferate');
  if (/surveil|scry/i.test(oracle)) valueRiders.add('surveil_scry');
  if (isConnive || /\+1\/\+1 counter/i.test(oracle)) valueRiders.add('counters');
  if ((isRecruit || /create .* token|empower|amass/i.test(oracle)) && !/its controller (creates|draws)/i.test(oracle)) valueRiders.add('token');
  if (/gain \d+ life|lifelink/i.test(oracle)) valueRiders.add('life_gain');
  if (/draw a card/i.test(oracle) && !/its controller draws a card/i.test(oracle)) {
    if (!isModalSpell) {
      valueRiders.add('cantrip');
    }
  }
  if (isConnive || isRecruit || /if you discarded/i.test(oracle)) valueRiders.add('discard_payoff');

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
    hasFlying,
    isCombatTrick,
    isAura,
    isAbilityLossAura,
    isFreezeAura,
    isLockdownAura,
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
    isModalSpell,
    isRemoval: detectedCategories.has('removal') || isAuraRemoval || actionSubtypes.has('sweeper') || actionSubtypes.has('burn_damage') || actionSubtypes.has('bite_fight') || actionSubtypes.has('permanent_removal') || actionSubtypes.has('unconditional_removal') || actionSubtypes.has('conditional_removal') || actionSubtypes.has('power_toughness_removal') || actionSubtypes.has('toughness_4_plus_removal'),
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
export function buildScryfallQueries(card: Card, features: ReturnType<typeof extractCardFeatures>): string[] {
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

  if (features.actionSubtypes.has('mana_dork')) {
    queries.push(`${baseFilter} ${excludeSelf} t:creature ${exactColorQuery} cmc>=1 cmc<=2 o:"{t}: add"`);
  }

  if (features.actionSubtypes.has('etb_counter_distributor')) {
    queries.push(`${baseFilter} ${excludeSelf} t:creature ${exactColorQuery} cmc=${features.cmc} (o:"when" o:"enters" o:"+1/+1 counter" or o:"explores")`);
    queries.push(`${baseFilter} ${excludeSelf} t:creature ${exactColorQuery} cmc>=${minCmc} cmc<=${maxCmc} (o:"when" o:"enters" o:"+1/+1 counter" or o:"explores")`);
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
export function calculateCardSimilarity(target: Card, candidate: Card): { score: number; reasons: string[] } {
  // 0. Compatibility Gatekeeper (Prerequisite — 0 points)
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
    colorScore = (bothShareEtbScry2 || bothShareSignatureEngine || bothShareEtbTreasure || bothShareFlashReach || bothShareLandTutorTop || bothShareFlyingLifegain)
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
              : (bothShareSignatureEngine ? 'Cross-color engine mechanic peer' : `Mono-color archetype comp (${[...cColors][0]})`))))));
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
      if (bothShareSignatureEngine || bothShareEtbTreasure || bothShareActivatedTeamPump) {
        cmcScore = 17;
        baselineReasons.push(bothShareActivatedTeamPump ? 'Curve-adjacent activated team pump peer' : `Adjacent curve slot (${candidate.cmc}M vs ${target.cmc}M)`);
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
    etb_counter_distributor: { pts: 16, label: 'Both distribute +1/+1 counters on enters' },
    etb_counter_self: { pts: 14, label: 'Both enter with / grow with +1/+1 counters' },
    attack_keyword_granter: { pts: 17, label: 'Both attack-triggered keyword mentors' },
    etb_treasure: { pts: 20, label: 'Both ETB Treasure ramp / fixing creatures' },
    flash_reach_ambush: { pts: 20, label: 'Both Flash & Reach ambush creatures' },
    land_tutor_top: { pts: 20, label: 'Both creature ETB land search to top of library' },
    flying_lifegain_evasion: { pts: 20, label: 'Both 2-drop evasive flying lifegain creatures' },
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

  // Action Subtype Mismatch Penalties
  let actionMismatchPenalty = 0;

  // Target is creature removal, but candidate is NOT creature removal
  const tIsCreatureRemoval = tFeatures.isRemoval || tFeatures.actionSubtypes.has('power_toughness_removal') || tFeatures.actionSubtypes.has('conditional_removal') || tFeatures.actionSubtypes.has('unconditional_removal');
  const cIsCreatureRemoval = cFeatures.isRemoval || cFeatures.actionSubtypes.has('power_toughness_removal') || cFeatures.actionSubtypes.has('conditional_removal') || cFeatures.actionSubtypes.has('unconditional_removal') || cFeatures.actionSubtypes.has('damage_removal') || cFeatures.isAuraRemoval;

  if (tIsCreatureRemoval && !cIsCreatureRemoval) {
    actionMismatchPenalty = Math.max(actionMismatchPenalty, isExactColorMatch ? 10 : 18);
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
    ramp: { pts: 3, label: 'Shared rider: Mana ramp / land fetch' },
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
      rarityAdjustment = (bothShareLivingWeapon || sharesCounterDistributor || bothShareLateGameSacDestruction || bothShareFlyingLifegain || bothShareActivatedTeamPump) ? -1 : -3;
    } else {
      rarityAdjustment = -8; // Rare/Mythic power-level penalty vs Common draft baseline
    }
  } else if (tFeatures.rarity === 'uncommon') {
    if (cFeatures.rarity === 'uncommon' || cFeatures.rarity === 'common') {
      rarityAdjustment = 2;
    } else {
      rarityAdjustment = bothShareRemovalWithCompensation ? 0 : -4;
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
      if (kw === 'flying') {
        keywordMismatchPenalty += 12;
      } else if (kw === 'reach' || kw === 'defender') {
        keywordMismatchPenalty += 8;
      } else {
        keywordMismatchPenalty += 5;
      }
    }
  }

  const ALL_VALUE_RIDERS = [
    'proliferate', 'token', 'surveil_scry', 'counters',
    'discard_payoff', 'life_gain', 'cantrip', 'ramp'
  ] as const;

  let riderMismatchPenalty = 0;
  for (const vr of ALL_VALUE_RIDERS) {
    if (tFeatures.valueRiders.has(vr) !== cFeatures.valueRiders.has(vr)) {
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
    if (tFeatures.isArtifact !== cFeatures.isArtifact) {
      cardTypeMismatchPenalty += 4;
    }
    if (tFeatures.isEnchantment !== cFeatures.isEnchantment) {
      cardTypeMismatchPenalty += 4;
    }
  }

  const discrepancyPenalty = keywordMismatchPenalty + riderMismatchPenalty + cardTypeMismatchPenalty;
  const rawScore = colorScore + cmcScore + method1LexicalScore + method2StructuralScore + statlineScore - discrepancyPenalty;

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
  const pool = [
    ...fallbackPool.filter(c => c && (c.name || '').trim().toLowerCase() !== normTargetName),
    ...HISTORICAL_BENCHMARK_CARDS.filter(c => (c.name || '').trim().toLowerCase() !== normTargetName),
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
    const cmcDiff = Math.abs(c.cmc - targetCard.cmc);
    if (cmcDiff === 0) relevance += 15;
    else if (cmcDiff === 1) relevance += 10;
    else if (cmcDiff === 2) relevance += 5;

    return { card: c, relevance };
  });

  scored.sort((a, b) => b.relevance - a.relevance);
  return scored.slice(0, 24).map(s => s.card);
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
  const candidates = getCuratedBenchmarkCandidates(targetCard, fallbackPool);
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
  const top4 = scored.slice(0, 4);

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
  fallbackPool: Card[] = []
): Promise<CardSimilarityResult> {
  const cacheKey = `${targetCard.set.toUpperCase()}_${targetCard.name.toUpperCase()}_v49`;
  if (similarityCache.has(cacheKey)) {
    const cached = similarityCache.get(cacheKey)!;
    if (cached && cached.matches && cached.matches.length >= 2) {
      return cached;
    }
  }

  try {
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
              if (!candidateCards.some(existing => existing.name.toLowerCase() === c.name.toLowerCase()) &&
                  c.name.toLowerCase() !== targetCard.name.toLowerCase()) {
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
        const cmcTerm = `m>=${Math.max(0, targetCard.cmc - 1)} m<=${targetCard.cmc + 1}`;
        const fallbackQuery = `(${COMPARABLE_PREMIER_SETS.slice(0, 16).map(s => `s:${s.toLowerCase()}`).join(' or ')}) ${typeTerm} ${mainColor} ${cmcTerm} is:booster`;

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
                  c.name.toLowerCase() !== targetCard.name.toLowerCase()) {
                candidateCards.push(c);
              }
            });
          }
        }
      } catch (err) {
        console.warn('Broad fallback candidate search failed:', err);
      }
    }

    // Curated Benchmark Safety Net: If fewer than 12 candidates exist, inject from benchmark library and fallbackPool
    if (candidateCards.length < 12) {
      const benchmarkCandidates = getCuratedBenchmarkCandidates(targetCard, fallbackPool);
      benchmarkCandidates.forEach((c) => {
        if (!candidateCards.some(existing => existing.name.toLowerCase() === c.name.toLowerCase()) &&
            c.name.toLowerCase() !== targetCard.name.toLowerCase()) {
          candidateCards.push(c);
        }
      });
    }

    // Score candidates against target card
    let scoredCandidates: { card: Card; score: number; reasons: string[] }[] = [];
    for (const cand of candidateCards) {
      const { score, reasons } = calculateCardSimilarity(targetCard, cand);
      if (score >= 58) {
        scoredCandidates.push({ card: cand, score, reasons });
      }
    }

    if (scoredCandidates.length < 4) {
      for (const cand of candidateCards) {
        if (!scoredCandidates.some(sc => sc.card.name.toLowerCase() === cand.name.toLowerCase())) {
          const { score, reasons } = calculateCardSimilarity(targetCard, cand);
          if (score >= 45) {
            scoredCandidates.push({ card: cand, score, reasons });
          }
        }
      }
    }

    if (scoredCandidates.length < 4) {
      for (const cand of candidateCards) {
        if (!scoredCandidates.some(sc => sc.card.name.toLowerCase() === cand.name.toLowerCase())) {
          const { score, reasons } = calculateCardSimilarity(targetCard, cand);
          if (score >= 35) {
            scoredCandidates.push({ card: cand, score, reasons });
          }
        }
      }
    }

    if (scoredCandidates.length < 4) {
      for (const cand of candidateCards) {
        if (!scoredCandidates.some(sc => sc.card.name.toLowerCase() === cand.name.toLowerCase())) {
          const { score, reasons } = calculateCardSimilarity(targetCard, cand);
          if (score >= 20) {
            scoredCandidates.push({ card: cand, score, reasons });
          }
        }
      }
    }

    // Absolute Guarantee: If STILL fewer than 4 candidates, score remaining candidates with baseline clamp
    if (scoredCandidates.length < 4) {
      for (const cand of candidateCards) {
        if (!scoredCandidates.some(sc => sc.card.name.toLowerCase() === cand.name.toLowerCase()) &&
            cand.name.toLowerCase() !== targetCard.name.toLowerCase()) {
          const { score, reasons } = calculateCardSimilarity(targetCard, cand);
          const boostedScore = Math.max(35, score);
          const fallbackReasons = reasons.length > 0 ? reasons : [
            `Similar ${targetCard.cmc}-mana ${targetCard.colors?.join('/') || 'colorless'} curve role`,
            `Comparable premier draft archetype benchmark`
          ];
          scoredCandidates.push({ card: cand, score: boostedScore, reasons: fallbackReasons });
        }
      }
    }

    // Sort by highest similarity
    scoredCandidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (features.isModalSpell) {
        const aModal = /choose (one|two|three)\b/i.test(a.card.oracle_text || '') ? 1 : 0;
        const bModal = /choose (one|two|three)\b/i.test(b.card.oracle_text || '') ? 1 : 0;
        if (aModal !== bModal) return bModal - aModal;
      }
      const aIsColorless = (!a.card.colors || a.card.colors.filter(c => c !== 'C').length === 0) ? 1 : 0;
      const bIsColorless = (!b.card.colors || b.card.colors.filter(c => c !== 'C').length === 0) ? 1 : 0;
      if (aIsColorless !== bIsColorless) return aIsColorless - bIsColorless;
      const aCmcDiff = Math.abs(a.card.cmc - targetCard.cmc);
      const bCmcDiff = Math.abs(b.card.cmc - targetCard.cmc);
      if (aCmcDiff !== bCmcDiff) return aCmcDiff - bCmcDiff;
      return (a.card.oracle_text || '').length - (b.card.oracle_text || '').length;
    });

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
      if (features.isModalSpell) {
        const aModal = /choose (one|two|three)\b/i.test(a.card.oracle_text || '') ? 1 : 0;
        const bModal = /choose (one|two|three)\b/i.test(b.card.oracle_text || '') ? 1 : 0;
        if (aModal !== bModal) return bModal - aModal;
      }
      const aOnCurve = a.card.cmc === targetCard.cmc ? 1 : 0;
      const bOnCurve = b.card.cmc === targetCard.cmc ? 1 : 0;
      if (aOnCurve !== bOnCurve) return bOnCurve - aOnCurve;
      return scoreDiff;
    });

    for (const match of sortedForPresentation) {
      const cardFeatures = extractCardFeatures(match.card);
      const primarySubtype = cardFeatures.actionSubtypes.has('activated_team_pump')
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
                                    : [...cardFeatures.actionSubtypes].filter(s => s !== 'aggressive_attacker' && s !== 'defensive_wall' && s !== 'etb_value').sort().join('+')))))))))))))));
      const roleKey = primarySubtype;

      const isTargetConditionalRemoval = features.actionSubtypes.has('toughness_4_plus_removal') || features.actionSubtypes.has('power_toughness_removal') || features.actionSubtypes.has('modal_removal');
      const maxAllowed = (primarySubtype === 'flash_reach_ambush' || primarySubtype === 'combat_removal')
        ? 1
        : (primarySubtype === 'activated_team_pump' || (isTargetConditionalRemoval && (primarySubtype === 'toughness_4_plus_removal' || primarySubtype === 'modal_removal' || primarySubtype === 'power_toughness_removal'))
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

    // Sort presented matches by similarity score
    presentedMatches.sort((a, b) => {
      if (b.similarityScore !== a.similarityScore) return b.similarityScore - a.similarityScore;
      if (features.isModalSpell) {
        const aModal = /choose (one|two|three)\b/i.test(a.card.oracle_text || '') ? 1 : 0;
        const bModal = /choose (one|two|three)\b/i.test(b.card.oracle_text || '') ? 1 : 0;
        if (aModal !== bModal) return bModal - aModal;
      }
      return (a.card.oracle_text || '').length - (b.card.oracle_text || '').length;
    });

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
