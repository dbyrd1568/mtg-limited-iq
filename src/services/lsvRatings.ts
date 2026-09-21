import { Card, GradeTier } from '../types/mtg';
import { scoreToGradeTier } from './seventeenLands';
import { ECL_LSV_DATA } from './eclLsvData';
import { SOS_LSV_DATA } from './sosLsvData';
import { HOB_LSV_DATA } from './hobLsvData';

export interface LsvCardRating {
  score: number; // 0.0 to 5.0
  grade: GradeTier;
  verdict?: string; // e.g. "Bomb", "High Pick", "Solid Playable", "Filler"
  isEstimated?: boolean;
}

// Convert LSV's traditional 0.0 - 5.0 scale to standard GradeTier
export function lsvScoreToGradeTier(score: number): GradeTier {
  if (score >= 4.8) return 'A+';
  if (score >= 4.5) return 'A';
  if (score >= 4.0) return 'A-';
  if (score >= 3.5) return 'B+';
  if (score >= 3.0) return 'B';
  if (score >= 2.5) return 'B-';
  if (score >= 2.0) return 'C+';
  if (score >= 1.5) return 'C';
  if (score >= 1.0) return 'C-';
  if (score >= 0.5) return 'D';
  return 'F';
}

// Benchmark LSV Pre-Release Set Review ratings
const PRELOADED_LSV_DATA: Record<string, Record<string, number>> = {
  'ECL': ECL_LSV_DATA,
  'SOS': SOS_LSV_DATA,
  'HOB': HOB_LSV_DATA,
  'STX': {
    'Expressive Iteration': 4.0,
    'Rip Apart': 3.5,
    'Killian, Ink Duelist': 4.0,
    'Dina, Soul Steeper': 3.5,
    'Quandrix Apprentice': 3.5,
    'Professor Onyx': 4.5,
    'Mila, Crafty Companion // Lukka, Wayward Bonder': 4.0,
    'Beledros Witherbloom': 4.5,
    'Galazeth Prismari': 4.5,
    'Shadrix Silverquill': 4.5,
    'Tanazir Quandrix': 4.5,
    'Velomachus Lorehold': 4.5,
  },
  'BLB': {
    'Heartfire Hero': 4.0,
    'Fell': 4.0,
    'Might of the Meek': 3.0,
    'Warren Warleader': 4.5,
    'Seedgale Foster': 2.0,
    'Shore Up': 2.5,
    'Gev, Scaled Scorch': 4.0,
    'Agate Blade Assassin': 2.5,
    'Baker\'s Bane Beastie': 2.0,
    'Bonebind Orator': 3.0,
    'Brambleguard Veteran': 3.5,
    'Builder\'s Talent': 3.5,
    'Carrot Cake': 3.0,
    'Crumb and Get It': 2.5,
    'Daggerfang Duo': 2.0,
    'Daring Waverider': 2.5,
    'Early Winter': 1.5,
    'Finneas, Ace Archer': 4.0,
    'Head of the Homestead': 3.0,
    'Huskburster Swarm': 3.5,
    'Into the Flood Maw': 3.5,
    'Kastral, the Windcrested': 4.5,
    'Long River\'s Pull': 3.0,
    'Mindwhisker': 2.5,
    'Osteomancer Adept': 4.0,
    'Patchwork Banner': 3.5,
    'Playful Shove': 2.5,
    'Polliwallop': 3.0,
    'Quirion Beastcaller': 4.0,
    'Rabid Gnaw': 3.5,
    'Sunspine Lynx': 3.0,
    'Take Out the Trash': 3.5,
    'Treeguard Duo': 3.0,
    'Valley Questcaller': 4.0,
    'Vinereap Mentor': 3.5,
    'Wandertale Mentor': 3.5,
    'Wax-Wane Witness': 2.5,
    'Wreaking Havoc': 1.5,
    'Ygra, Eater of All': 4.5,
  },
  'OTJ': {
    'Railway Brawler': 5.0,
    'Vault Plunderer': 3.5,
    'Throwing Knife': 3.5,
    'Mystic Confluence': 4.5,
    'Holy Cow': 3.0,
    'Take the Fall': 2.5,
    'Desert\'s Due': 3.5,
    'Consuming Ashes': 3.5,
    'Geyser Drake': 3.0,
  }
};

/**
 * Get LSV pre-release rating for a card.
 * Sourced from official Limited Resources / ChannelFireball set reviews,
 * with empirical calibration fallback for released sets.
 */
export function getLsvRatingForCard(card: Card, setCode?: string): LsvCardRating | null {
  const setUpper = (setCode || card.set || '').toUpperCase().trim();
  const cardName = card.name.trim();

  // 1. Check exact match in preloaded set
  if (PRELOADED_LSV_DATA[setUpper] && PRELOADED_LSV_DATA[setUpper][cardName] !== undefined) {
    const score = PRELOADED_LSV_DATA[setUpper][cardName];
    return {
      score,
      grade: lsvScoreToGradeTier(score),
      verdict: score >= 4.5 ? 'Bomb' : score >= 3.5 ? 'High Pick' : score >= 2.5 ? 'Solid Playable' : score >= 1.5 ? 'Filler' : 'Unplayable',
      isEstimated: false,
    };
  }

  // 2. Check front face for split/transform cards
  if (cardName.includes(' // ')) {
    const frontFace = cardName.split(' // ')[0].trim();
    if (PRELOADED_LSV_DATA[setUpper] && PRELOADED_LSV_DATA[setUpper][frontFace] !== undefined) {
      const score = PRELOADED_LSV_DATA[setUpper][frontFace];
      return {
        score,
        grade: lsvScoreToGradeTier(score),
        verdict: score >= 4.5 ? 'Bomb' : score >= 3.5 ? 'High Pick' : score >= 2.5 ? 'Solid Playable' : score >= 1.5 ? 'Filler' : 'Unplayable',
        isEstimated: false,
      };
    }
  }

  // 3. Normalized / fuzzy match in preloaded set
  if (PRELOADED_LSV_DATA[setUpper]) {
    const norm = (s: string) => s.toLowerCase().replace(/['’".,\-]/g, '').trim();
    const target = norm(cardName);
    const entry = Object.entries(PRELOADED_LSV_DATA[setUpper]).find(([k]) => norm(k) === target);
    if (entry) {
      const score = entry[1];
      return {
        score,
        grade: lsvScoreToGradeTier(score),
        verdict: score >= 4.5 ? 'Bomb' : score >= 3.5 ? 'High Pick' : score >= 2.5 ? 'Solid Playable' : score >= 1.5 ? 'Filler' : 'Unplayable',
        isEstimated: false,
      };
    }
  }

  // 4. For unreleased spoiler sets, do not fabricate ratings (reviews come out during prerelease week)
  const unreleasedSets = new Set(['TRK', 'FRA', 'SPM']);
  if (unreleasedSets.has(setUpper)) {
    return null;
  }

  // 5. Realistic empirical estimation for released sets where manual transcription is pending
  const rarity = (card.rarity || 'common').toLowerCase();
  let baseScore = 2.5;
  if (rarity === 'mythic') baseScore = 4.0;
  else if (rarity === 'rare') baseScore = 3.5;
  else if (rarity === 'uncommon') baseScore = 3.0;
  else baseScore = 2.5;

  if (card.is_removal) baseScore += 0.5;
  if (card.cmc && card.cmc <= 2 && (card.is_creature || card.is_removal)) baseScore += 0.5;
  if (card.cmc && card.cmc >= 7 && !card.is_removal) baseScore -= 0.5;

  const clamped = Math.max(1.0, Math.min(5.0, Math.round(baseScore * 2) / 2));
  return {
    score: clamped,
    grade: lsvScoreToGradeTier(clamped),
    verdict: clamped >= 4.5 ? 'Bomb' : clamped >= 3.5 ? 'High Pick' : clamped >= 2.5 ? 'Solid Playable' : clamped >= 1.5 ? 'Filler' : 'Unplayable',
    isEstimated: true,
  };
}
