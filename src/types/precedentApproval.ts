export type ProposalStatus = 'pending' | 'approved' | 'rejected';

export interface CardSummarySnapshot {
  id?: string;
  name: string;
  set: string;
  setName?: string;
  manaCost?: string;
  cmc: number;
  typeLine: string;
  oracleText?: string;
  power?: string;
  toughness?: string;
  colors: string[];
  rarity: string;
  winRate?: number;
  alsa?: number;
  tierGrade?: string;
  similarityScore?: number;
  matchReasons?: string[];
}

export interface ProposalSubmitterInfo {
  userId: string;
  userName: string;
  userEmail?: string;
  avatarColor?: string;
  isAdmin: boolean;
}

export interface ProposalReviewerInfo {
  adminId: string;
  adminName: string;
  adminEmail?: string;
  reviewedAt: string;
  notes?: string;
}

export interface PrecedentProposal {
  id: string;
  targetKey: string; // e.g. "SOS_SUNDERING ARCHAIC"
  slotIndex: number; // 0, 1, 2, 3
  targetCard: CardSummarySnapshot;
  originalComp: CardSummarySnapshot | null;
  chosenComp: CardSummarySnapshot;
  inferredInsights: string[];
  mechanicBridge?: string;
  cmcDelta: number;
  speedShift?: 'instant_to_sorcery' | 'sorcery_to_instant' | 'matched';
  submittedBy: ProposalSubmitterInfo;
  submittedAt: string;
  status: ProposalStatus;
  reviewedBy?: ProposalReviewerInfo;
}

export interface CanonicalPrecedentEntry {
  targetCardName: string;
  targetCardSet: string;
  slotIndex: number;
  precedentCardName: string;
  precedentCardSet: string;
  precedentScore: number;
  approvedAt: string;
  approvedByAdmin: string;
  reasons: string[];
}

export type CanonicalCompsMap = Record<string, Record<number, CanonicalPrecedentEntry>>;
