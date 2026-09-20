export type MTGColor = 'W' | 'U' | 'B' | 'R' | 'G' | 'C';
export type MTGRarity = 'common' | 'uncommon' | 'rare' | 'mythic' | 'special' | 'bonus';

export interface CardFace {
  name: string;
  mana_cost?: string;
  type_line: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  image_uris?: {
    small?: string;
    normal?: string;
    large?: string;
    art_crop?: string;
    png?: string;
  };
  colors?: MTGColor[];
}

export interface Card {
  id: string;
  arena_id?: number;
  name: string;
  set: string;
  set_name: string;
  collector_number: string;
  mana_cost?: string;
  cmc: number;
  type_line: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  colors: MTGColor[];
  color_identity: MTGColor[];
  rarity: MTGRarity;
  keywords: string[];
  image_uris?: {
    small?: string;
    normal?: string;
    large?: string;
    art_crop?: string;
    png?: string;
  };
  card_faces?: CardFace[];
  layout?: string;
  scryfall_uri?: string;
  booster?: boolean;
  promo?: boolean;
  finishes?: string[];
  frame_effects?: string[];

  // Derived Limited-focused tags
  is_instant_speed?: boolean;
  is_combat_trick?: boolean;
  is_removal?: boolean;
  is_interaction?: boolean;
  is_counterspell?: boolean;
  is_card_draw?: boolean;
  is_creature?: boolean;
  is_land?: boolean;
  archetype_tag?: string;
}

export type SetDraftStatus = 'active' | 'flashback' | 'historical' | 'upcoming';

export interface SetInfo {
  code: string;
  name: string;
  card_count: number;
  released_at?: string;
  icon_svg_uri?: string;
  set_type?: string;
  has_17lands_data?: boolean;
  is_active_draft?: boolean; // Currently running as active primary draft or ongoing format (e.g. HOB, MBC)
  is_flashback?: boolean;    // Currently running on Arena for a Flashback draft
}

// 17Lands dataset structure
export interface SeventeenLandsCardRating {
  name: string;
  color: string;
  rarity: string;
  seen_count: number;
  avg_seen: number; // ALSA (Average Last Seen At)
  pick_rate: number;
  game_count: number;
  win_rate: number; // GIH WR (Games in Hand Win Rate) e.g. 0.572 (57.2%)
  iwd: number; // Improvement when drawn e.g. 0.034 (+3.4%)
  tier_grade?: string; // e.g. "A+", "B", "C+"
  ever_drawn_win_rate?: number;
  opening_hand_win_rate?: number;
  card_id?: number | string;
  mtga_id?: number;
}

export interface SeventeenLandsSetData {
  setCode: string;
  setName: string;
  format: string;
  sampleSize: number;
  cards: Record<string, SeventeenLandsCardRating>;
  updatedAt: string;
}

// Card Evaluation Types
export type GradeTier = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';

export interface UserCardEvaluation {
  cardId: string;
  cardName: string;
  setCode: string;
  userGrade: GradeTier;
  userScore: number; // 0.0 to 5.0
  pickPriority: '1st Pick Bomb' | 'Early Pick' | 'Mid Pick' | 'Late Filler' | 'Sideboard / Unplayable';
  archetypeRole?: string;
  notes?: string;
  updatedAt: string;
}

export type ArchetypeMetagameRole =
  | 'Premier Deck'
  | 'Solid Contender'
  | 'Synergy Dependent'
  | 'Trap / Underpowered'
  | 'Niche Buildaround';

export interface UserArchetypeEvaluation {
  setCode: string;
  archetypeCode: string; // 'WU', 'UB', etc.
  userGrade: GradeTier;
  userScore: number; // 0.0 to 5.0
  tier?: 'S' | 'A' | 'B' | 'C' | 'D';
  roleInMetagame?: ArchetypeMetagameRole;
  notes?: string;
  updatedAt: string;
}

export interface UserColorEvaluation {
  setCode: string;
  color: MTGColor | 'C';
  userGrade: GradeTier;
  userScore: number; // 0.0 to 5.0
  rank?: number; // 1 to 5 (or 6 for C)
  notes?: string;
  updatedAt: string;
}

export interface CardEvaluationComparison {
  card: Card;
  userEvaluation?: UserCardEvaluation;
  seventeenLandsData?: SeventeenLandsCardRating;
  gradeDelta: number; // positive = user overrated, negative = user underrated
  calibrationScore: number; // 0-100%
  status: 'exact' | 'close' | 'overrated' | 'underrated' | 'unrated';
}

export interface SetCalibrationSummary {
  setCode: string;
  totalRated: number;
  totalCards: number;
  calibrationScore: number; // 0-100% (accuracy based on <= 1 step correct rule)
  weightedScore?: number; // 0-100% (includes 50% partial credit for 2-step misses)
  overallGrade: GradeTier; // Overall Evaluator Report Card Grade (e.g. A+, A, A-, B+, etc.)
  overallTitle: string; // e.g. "Pro Tour Caliber Drafter"
  overallDescription: string;
  gpa: number; // 0.0 to 4.0 GPA scale
  correctCount: number; // Cards with |tierDelta| <= 1 (Exact + 1 step tolerance)
  exactMatches: number; // 0 steps off
  oneStepMatches: number; // 1 step off (e.g. A to A-, B- to C+ - counts as correct)
  twoStepMatches: number; // 2 steps off (minor discrepancy)
  largeDiscrepancies: number; // 3+ steps off (major traps/sleepers)
  averageStepDelta: number; // average step difference (+ over, - under)
  biggestSleepers: CardEvaluationComparison[];
  biggestTraps: CardEvaluationComparison[];
  bias: 'none' | 'overly_optimistic' | 'overly_critical';
}

// Obfuscation Mask Types
export type ObfuscationTarget =
  | 'none'
  | 'mana_cost'
  | 'type_line'
  | 'oracle_text'
  | 'power_toughness'
  | 'name_and_cost'
  | 'art_only';

export type ObfuscationStyle = 'blur' | 'whiteout' | 'blackout' | 'scratch';

export interface CardObfuscationConfig {
  target: ObfuscationTarget;
  style: ObfuscationStyle;
  isRevealed?: boolean;
  customOverlayText?: string;
}

// High-Value Limited & Draft Question Categories
export type QuestionCategory =
  | 'p1p1_pick'               // Pack 1 Pick 1 Draft Priority
  | 'trap_or_sleeper'         // 17Lands Trap vs Sleeper Identification
  | 'quadrant_role'           // Quadrant Theory (Behind / Parity / Ahead)
  | 'combat_tricks'           // Combat Tricks & Open Mana Blowout Anticipation
  | 'instant_speed'           // Instant vs Sorcery Speed & Timing
  | 'mana_cost_and_splash'    // Mana Cost & Splashability (Single vs Double Pips)
  | 'power_toughness'         // Power / Toughness Combat Sizing & Math
  | 'archetype_engine'        // Archetype Synergy Mechanic & Engine
  | 'card_evaluation';        // 17Lands Head-to-Head Win Rate Duel

export type QuizMode = 'quiz' | 'flashcard' | 'spaced_repetition';

export interface QuizOption {
  id: string;
  label: string;
  description?: string;
  manaCost?: string;
  cardImageUri?: string;
  isCorrect: boolean;
}

export interface QuizQuestion {
  id: string;
  category: QuestionCategory;
  type: 'multiple_choice' | 'fill_blank' | 'flashcard' | 'head_to_head' | 'color_picker' | 'p1p1_pack';
  title: string;
  prompt: string;
  tacticalContext: string; // Strategic Limited context (why knowing this wins drafts)
  card: Card;
  comparisonCard?: Card;
  packCards?: Card[]; // For P1P1 simulation
  activeFaceIndex?: number;
  obfuscation: CardObfuscationConfig;
  options: QuizOption[];
  correctAnswer: string;
  explanation: string;
  manaFilterHint?: string;
}

export interface QuizSettings {
  setCode: string;
  setName: string;
  releasedAt?: string;
  questionCount: number; // 5, 10, 15, 20, 0 = all
  categories: QuestionCategory[];
  rarities: MTGRarity[];
  timerSeconds: number; // 0 = untimed
  mode: QuizMode;
  onlyMissedCards?: boolean;
}

export interface AnswerSubmission {
  questionId: string;
  selectedAnswer: string;
  isCorrect: boolean;
  timeSpentMs: number;
  flashcardRating?: 'again' | 'hard' | 'good' | 'easy';
}

export interface QuizResult {
  id: string;
  setCode: string;
  setName: string;
  date: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  timeSpentSeconds: number;
  questions: QuizQuestion[];
  answers: Record<string, AnswerSubmission>;
}

// User Stats & Learning
export interface MissedCardRecord {
  cardId: string;
  cardName: string;
  setCode: string;
  timesMissed: number;
  timesEncountered: number;
  lastMissedAt: string;
  lastQuestionCategory: QuestionCategory;
  masteryScore: number; // 0-100
}

export interface SetMasteryStat {
  setCode: string;
  setName: string;
  quizzesTaken: number;
  questionsAttempted: number;
  questionsCorrect: number;
  accuracy: number;
  masteryRank: 'Novice' | 'Bronze' | 'Silver' | 'Gold' | 'Mythic';
  lastPracticed: string;
}

export interface UserProfileStats {
  totalQuizzes: number;
  totalQuestions: number;
  totalCorrect: number;
  overallAccuracy: number;
  currentStreak: number;
  bestStreak: number;
  xp: number;
  level: number;
  categories: Record<QuestionCategory, { attempted: number; correct: number }>;
  sets: Record<string, SetMasteryStat>;
  missedCards: Record<string, MissedCardRecord>;
  recentQuizzes: QuizResult[];
  lastActive: string;
}

export interface UserAccount {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  avatarColor: string;
  provider: 'local' | 'google' | 'discord' | 'apple' | 'email';
  createdAt: string;
  lastLoginAt: string;
}


