import { Card, UserAccount, GradeTier } from '../types/mtg';
import type { SimilarCardMatch } from './cardSimilarity';
import {
  PrecedentProposal,
  ProposalStatus,
  CardSummarySnapshot,
  CanonicalPrecedentEntry,
  CanonicalCompsMap,
} from '../types/precedentApproval';
import { getOrEstimate17LandsCardRating } from './seventeenLands';
import { supabase, isSupabaseConfigured } from './supabase';
import { getActiveUser } from './storage';
import baseCanonicalComps from '../data/canonicalComps.json';

const PROPOSALS_STORAGE_KEY = 'mtg_precedent_proposals_store_v1';
const CANONICAL_STORAGE_KEY = 'mtg_canonical_precedents_store_v1';

/**
 * Builds a standardized snapshot of a card and its associated ratings & similarity score.
 */
export function buildCardSnapshot(
  card: Card,
  match?: SimilarCardMatch | null
): CardSummarySnapshot {
  const rating = getOrEstimate17LandsCardRating(card);
  const winRate = match?.winRate ?? rating?.win_rate;
  const alsa = match?.alsa ?? rating?.avg_seen;
  const tierGrade = match?.tierGrade ?? (rating?.tier_grade as GradeTier);

  return {
    id: card.id,
    name: card.name,
    set: (card.set || '').toUpperCase(),
    setName: card.set_name,
    manaCost: card.mana_cost,
    cmc: card.cmc ?? 0,
    typeLine: card.type_line || '',
    oracleText: card.oracle_text,
    power: card.power,
    toughness: card.toughness,
    colors: card.colors || [],
    rarity: card.rarity || 'common',
    winRate: typeof winRate === 'number' ? winRate : undefined,
    alsa: typeof alsa === 'number' ? alsa : undefined,
    tierGrade: tierGrade ? String(tierGrade) : undefined,
    similarityScore: match?.similarityScore,
    matchReasons: match?.matchReasons || [],
  };
}

/**
 * Generates a consistent lookup key for target cards: e.g. "SOS_SUNDERING ARCHAIC"
 */
export function getTargetCardKey(set: string, name: string): string {
  return `${(set || '').trim().toUpperCase()}_${(name || '').trim().toUpperCase()}`;
}

/**
 * Reads local precedent proposals from browser storage.
 */
export function getStoredLocalProposals(): PrecedentProposal[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(PROPOSALS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('Failed to load local precedent proposals:', err);
    return [];
  }
}

/**
 * Saves local precedent proposals to browser storage.
 */
export function saveStoredLocalProposals(proposals: PrecedentProposal[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(PROPOSALS_STORAGE_KEY, JSON.stringify(proposals));
  } catch (err) {
    console.error('Failed to save local precedent proposals:', err);
  }
}

/**
 * Submits a new precedent swap proposal when any user or admin replaces a comp card.
 */
export async function submitPrecedentProposal(
  targetCard: Card,
  slotIndex: number,
  originalMatch: SimilarCardMatch | null,
  replacementMatch: SimilarCardMatch,
  inferredInsights: string[] = [],
  mechanicBridge?: string,
  user?: UserAccount | null
): Promise<PrecedentProposal> {
  const activeUser = user || getActiveUser();
  const targetKey = getTargetCardKey(targetCard.set, targetCard.name);
  const now = new Date().toISOString();

  const targetSnapshot = buildCardSnapshot(targetCard);
  const originalSnapshot = originalMatch ? buildCardSnapshot(originalMatch.card, originalMatch) : null;
  const chosenSnapshot = buildCardSnapshot(replacementMatch.card, replacementMatch);

  const cmcDelta = originalSnapshot ? chosenSnapshot.cmc - originalSnapshot.cmc : 0;
  let speedShift: 'instant_to_sorcery' | 'sorcery_to_instant' | 'matched' | undefined;

  const origIsInstant = originalSnapshot?.typeLine.toLowerCase().includes('instant');
  const origIsSorcery = originalSnapshot?.typeLine.toLowerCase().includes('sorcery');
  const chosenIsInstant = chosenSnapshot.typeLine.toLowerCase().includes('instant');
  const chosenIsSorcery = chosenSnapshot.typeLine.toLowerCase().includes('sorcery');

  if (origIsInstant && chosenIsSorcery) speedShift = 'instant_to_sorcery';
  else if (origIsSorcery && chosenIsInstant) speedShift = 'sorcery_to_instant';
  else if (origIsInstant === chosenIsInstant && origIsSorcery === chosenIsSorcery) speedShift = 'matched';

  const proposalId = `prop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const proposal: PrecedentProposal = {
    id: proposalId,
    targetKey,
    slotIndex,
    targetCard: targetSnapshot,
    originalComp: originalSnapshot,
    chosenComp: chosenSnapshot,
    inferredInsights,
    mechanicBridge,
    cmcDelta,
    speedShift,
    submittedBy: {
      userId: activeUser?.id || 'guest',
      userName: activeUser?.name || 'Anonymous User',
      userEmail: activeUser?.email,
      avatarColor: activeUser?.avatarColor,
      isAdmin: activeUser?.isAdmin ?? false,
    },
    submittedAt: now,
    status: 'pending',
  };

  // 1. Always update local storage
  const localList = getStoredLocalProposals();
  const updatedList = [proposal, ...localList.filter((p) => p.id !== proposal.id)];
  saveStoredLocalProposals(updatedList);

  // 2. Cloud sync if Supabase is active
  if (isSupabaseConfigured()) {
    try {
      await supabase.from('precedent_proposals').upsert(
        {
          id: proposal.id,
          target_key: proposal.targetKey,
          slot_index: proposal.slotIndex,
          target_card: proposal.targetCard,
          original_comp: proposal.originalComp,
          chosen_comp: proposal.chosenComp,
          inferred_insights: proposal.inferredInsights,
          mechanic_bridge: proposal.mechanicBridge,
          cmc_delta: proposal.cmcDelta,
          speed_shift: proposal.speedShift,
          submitted_by: proposal.submittedBy,
          submitted_at: proposal.submittedAt,
          status: proposal.status,
        },
        { onConflict: 'id' }
      );
    } catch (err) {
      console.warn('Failed to sync precedent proposal to Supabase (saved locally):', err);
    }
  }

  return proposal;
}

/**
 * Fetches precedent proposals for admin review, with optional filters.
 */
export async function fetchPrecedentProposals(filter?: {
  status?: ProposalStatus | 'all';
  setCode?: string;
  search?: string;
}): Promise<PrecedentProposal[]> {
  let list: PrecedentProposal[] = [];

  if (isSupabaseConfigured()) {
    try {
      let query = supabase.from('precedent_proposals').select('*').order('submitted_at', { ascending: false });
      if (filter?.status && filter.status !== 'all') {
        query = query.eq('status', filter.status);
      }
      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        list = data.map((d: any) => ({
          id: d.id,
          targetKey: d.target_key,
          slotIndex: d.slot_index,
          targetCard: d.target_card,
          originalComp: d.original_comp,
          chosenComp: d.chosen_comp,
          inferredInsights: d.inferred_insights || [],
          mechanicBridge: d.mechanic_bridge,
          cmcDelta: d.cmc_delta ?? 0,
          speedShift: d.speed_shift,
          submittedBy: d.submitted_by,
          submittedAt: d.submitted_at,
          status: d.status,
          reviewedBy: d.reviewed_by,
        }));
      }
    } catch (err) {
      console.warn('Failed to query Supabase precedent proposals, falling back to local:', err);
    }
  }

  if (list.length === 0) {
    list = getStoredLocalProposals();
  }

  // Apply filters
  return list.filter((item) => {
    if (filter?.status && filter.status !== 'all' && item.status !== filter.status) {
      return false;
    }
    if (filter?.setCode && filter.setCode !== 'ALL') {
      if (item.targetCard.set.toUpperCase() !== filter.setCode.toUpperCase()) {
        return false;
      }
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase().trim();
      const targetMatch = item.targetCard.name.toLowerCase().includes(q);
      const chosenMatch = item.chosenComp.name.toLowerCase().includes(q);
      const userMatch = item.submittedBy.userName.toLowerCase().includes(q);
      if (!targetMatch && !chosenMatch && !userMatch) return false;
    }
    return true;
  });
}

/**
 * Approves a proposal, making it a canonical precedent across the engine.
 */
export async function approvePrecedentProposal(
  proposalId: string,
  adminUser: UserAccount,
  notes?: string
): Promise<PrecedentProposal | null> {
  const localList = getStoredLocalProposals();
  const index = localList.findIndex((p) => p.id === proposalId);
  const now = new Date().toISOString();

  let targetProposal: PrecedentProposal | null = index >= 0 ? localList[index] : null;

  if (!targetProposal && isSupabaseConfigured()) {
    try {
      const { data } = await supabase.from('precedent_proposals').select('*').eq('id', proposalId).single();
      if (data) {
        targetProposal = {
          id: data.id,
          targetKey: data.target_key,
          slotIndex: data.slot_index,
          targetCard: data.target_card,
          originalComp: data.original_comp,
          chosenComp: data.chosen_comp,
          inferredInsights: data.inferred_insights || [],
          mechanicBridge: data.mechanic_bridge,
          cmcDelta: data.cmc_delta ?? 0,
          speedShift: data.speed_shift,
          submittedBy: data.submitted_by,
          submittedAt: data.submitted_at,
          status: data.status,
          reviewedBy: data.reviewed_by,
        };
      }
    } catch (err) {
      console.warn('Error reading proposal from Supabase:', err);
    }
  }

  if (!targetProposal) return null;

  const reviewerInfo = {
    adminId: adminUser.id,
    adminName: adminUser.name || 'Admin',
    adminEmail: adminUser.email,
    reviewedAt: now,
    notes,
  };

  targetProposal.status = 'approved';
  targetProposal.reviewedBy = reviewerInfo;

  // 1. Update local storage
  if (index >= 0) {
    localList[index] = targetProposal;
    saveStoredLocalProposals(localList);
  } else {
    saveStoredLocalProposals([targetProposal, ...localList]);
  }

  // 2. Update canonical store
  saveCanonicalPrecedent({
    targetCardName: targetProposal.targetCard.name,
    targetCardSet: targetProposal.targetCard.set,
    slotIndex: targetProposal.slotIndex,
    precedentCardName: targetProposal.chosenComp.name,
    precedentCardSet: targetProposal.chosenComp.set,
    precedentScore: Math.max(88, targetProposal.chosenComp.similarityScore || 88),
    approvedAt: now,
    approvedByAdmin: adminUser.name || 'Admin',
    reasons: targetProposal.chosenComp.matchReasons?.length
      ? targetProposal.chosenComp.matchReasons
      : ['Admin Approved Canonical Precedent'],
  });

  // 3. Update Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      await supabase
        .from('precedent_proposals')
        .update({
          status: 'approved',
          reviewed_by: reviewerInfo,
        })
        .eq('id', proposalId);
    } catch (err) {
      console.warn('Failed to update proposal in Supabase:', err);
    }
  }

  return targetProposal;
}

/**
 * Rejects a precedent proposal with optional feedback.
 */
export async function rejectPrecedentProposal(
  proposalId: string,
  adminUser: UserAccount,
  notes?: string
): Promise<PrecedentProposal | null> {
  const localList = getStoredLocalProposals();
  const index = localList.findIndex((p) => p.id === proposalId);
  const now = new Date().toISOString();

  let targetProposal: PrecedentProposal | null = index >= 0 ? localList[index] : null;

  if (!targetProposal && isSupabaseConfigured()) {
    try {
      const { data } = await supabase.from('precedent_proposals').select('*').eq('id', proposalId).single();
      if (data) {
        targetProposal = {
          id: data.id,
          targetKey: data.target_key,
          slotIndex: data.slot_index,
          targetCard: data.target_card,
          originalComp: data.original_comp,
          chosenComp: data.chosen_comp,
          inferredInsights: data.inferred_insights || [],
          mechanicBridge: data.mechanic_bridge,
          cmcDelta: data.cmc_delta ?? 0,
          speedShift: data.speed_shift,
          submittedBy: data.submitted_by,
          submittedAt: data.submitted_at,
          status: data.status,
          reviewedBy: data.reviewed_by,
        };
      }
    } catch (err) {
      console.warn('Error reading proposal from Supabase:', err);
    }
  }

  if (!targetProposal) return null;

  const reviewerInfo = {
    adminId: adminUser.id,
    adminName: adminUser.name || 'Admin',
    adminEmail: adminUser.email,
    reviewedAt: now,
    notes,
  };

  targetProposal.status = 'rejected';
  targetProposal.reviewedBy = reviewerInfo;

  if (index >= 0) {
    localList[index] = targetProposal;
    saveStoredLocalProposals(localList);
  } else {
    saveStoredLocalProposals([targetProposal, ...localList]);
  }

  if (isSupabaseConfigured()) {
    try {
      await supabase
        .from('precedent_proposals')
        .update({
          status: 'rejected',
          reviewed_by: reviewerInfo,
        })
        .eq('id', proposalId);
    } catch (err) {
      console.warn('Failed to update proposal rejection in Supabase:', err);
    }
  }

  return targetProposal;
}

/**
 * Saves an approved precedent into the canonical storage map.
 */
export function saveCanonicalPrecedent(entry: CanonicalPrecedentEntry): void {
  try {
    const key = getTargetCardKey(entry.targetCardSet, entry.targetCardName);
    const store = getStoredCanonicalPrecedents();
    if (!store[key]) {
      store[key] = {};
    }
    store[key][entry.slotIndex] = entry;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CANONICAL_STORAGE_KEY, JSON.stringify(store));
    }
  } catch (err) {
    console.error('Failed to save canonical precedent:', err);
  }
}

/**
 * Loads the canonical approved precedents map (combining baseline repository file and runtime approvals).
 */
export function getStoredCanonicalPrecedents(): CanonicalCompsMap {
  try {
    let runtimeStore: CanonicalCompsMap = {};
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(CANONICAL_STORAGE_KEY);
      if (raw) runtimeStore = JSON.parse(raw);
    }

    const merged: CanonicalCompsMap = { ...(baseCanonicalComps as unknown as CanonicalCompsMap) };
    for (const [targetKey, slots] of Object.entries(runtimeStore)) {
      if (!merged[targetKey]) merged[targetKey] = {};
      for (const [slot, entry] of Object.entries(slots)) {
        merged[targetKey][Number(slot)] = entry;
      }
    }
    return merged;
  } catch (err) {
    console.warn('Failed to load canonical precedents:', err);
    return (baseCanonicalComps as unknown as CanonicalCompsMap) || {};
  }
}

/**
 * Exports all canonical approved precedents as pretty-printed JSON
 * suitable for committing into src/data/canonicalComps.json.
 */
export function exportCanonicalCompsJSON(): string {
  const store = getStoredCanonicalPrecedents();
  return JSON.stringify(store, null, 2);
}
