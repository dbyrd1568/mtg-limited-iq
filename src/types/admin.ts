export type AdminTimeRange = 'today' | '7d' | '30d' | 'all';
export type AdminSubTab = 'overview' | 'users' | 'features' | 'grading' | 'access' | 'precedents';

export interface UserSetGradingDetail {
  setCode: string;
  setName: string;
  cardsGraded: number;
  totalCards: number;
  percentComplete: number;
  lastGradedAt?: string;
  averageUserScore?: number;
  calibrationScore?: number;
}

export interface AdminUserSummary {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  avatarColor: string;
  provider: string;
  authMethod?: 'google' | 'discord' | 'apple' | 'email_password' | 'magic_link' | 'local';
  authMethodLabel?: string;
  createdAt: string;
  lastLoginAt: string;
  totalQuizzes: number;
  totalQuestions: number;
  totalCorrect: number;
  quizAccuracy: number;
  xp: number;
  level: number;
  cardsGradedTotal: number;
  setsGradedCount: number;
  gradingAccuracyScore: number;
  gradingGpa: number;
  gradingBias: 'optimistic' | 'critical' | 'neutral';
  isAdmin: boolean;
  status: 'active' | 'recent' | 'dormant';
  setsGraded: UserSetGradingDetail[];
}

export interface FeatureUsageStat {
  featureKey: string;
  name: string;
  category: 'grading' | 'quiz' | 'explorer' | 'utility';
  totalInteractions: number;
  uniqueUsers: number;
  adoptionRate: number; // 0-100%
  lastUsedAt: string;
  description: string;
}

export interface SetGradingAnalytics {
  setCode: string;
  setName: string;
  totalSetCards: number;
  totalCardsGraded: number;
  uniqueGradersCount: number;
  fullyGradedUsersCount: number;
  avgCardsGradedPerUser: number;
  communityAvgTier?: string;
  communityCalibrationScore?: number;
}

export interface CommunityCardInsight {
  cardName: string;
  setCode: string;
  communityGrade: string;
  seventeenLandsGrade: string;
  winRate?: number;
  stepDelta: number; // positive = community overrated (trap), negative = community underrated (sleeper)
  totalEvaluations: number;
  type: 'sleeper' | 'trap' | 'consensus';
}

export interface GradeAccuracyReport {
  totalEvaluationsEvaluated: number;
  systemCalibrationScore: number; // 0-100%
  systemGpa: number; // 0.0-4.0
  exactMatchesCount: number;
  exactMatchesPercentage: number;
  oneStepMatchesCount: number;
  oneStepMatchesPercentage: number;
  twoStepMatchesCount: number;
  twoStepMatchesPercentage: number;
  majorDiscrepanciesCount: number;
  majorDiscrepanciesPercentage: number;
  optimisticBiasPercentage: number;
  criticalBiasPercentage: number;
  biggestSleepers: CommunityCardInsight[];
  biggestTraps: CommunityCardInsight[];
}

export interface AdminAccessRecord {
  id: string;
  userId?: string;
  email: string;
  role: 'owner' | 'admin';
  grantedBy?: string;
  createdAt: string;
}

export interface UserActivityLog {
  id: string;
  userId?: string;
  userName: string;
  eventType: string;
  featureName: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface AdminOverviewKPIs {
  totalUsers: number;
  activeUsers7d: number;
  activeUsers24h: number;
  totalSetsGraded: number;
  totalCardsGraded: number;
  totalQuizzesTaken: number;
  avgGradingAccuracy: number;
  avgQuizAccuracy: number;
  topActiveFeature: string;
  mostGradedSet: string;
}
