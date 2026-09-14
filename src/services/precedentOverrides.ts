import { Card } from '../types/mtg';
import { SimilarCardMatch } from './cardSimilarity';
import { getActiveUser } from './storage';

export interface PrecedentSlotOverride {
  slotIndex: number; // 0, 1, 2, 3
  originalCardName?: string;
  originalCardId?: string;
  replacementMatch: SimilarCardMatch;
  replacedAt: string;
}

export interface CardPrecedentOverrides {
  targetKey: string;
  slots: Record<number, PrecedentSlotOverride>;
}

export type PrecedentOverridesStore = Record<string, CardPrecedentOverrides>;

export function getTargetCardKey(targetCard: Card): string {
  const set = (targetCard.set || '').trim().toUpperCase();
  const name = (targetCard.name || '').trim().toLowerCase();
  return `${set}_${name}`;
}

export function getPrecedentStorageKey(userId?: string): string {
  const activeId = userId || getActiveUser()?.id || 'guest';
  return `mtg_precedent_overrides_${activeId}`;
}

/**
 * Retrieves all stored precedent overrides for the current user.
 */
export function getAllPrecedentOverrides(userId?: string): PrecedentOverridesStore {
  try {
    const key = getPrecedentStorageKey(userId);
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to read precedent overrides from storage:', err);
    return {};
  }
}

/**
 * Retrieves the slot overrides for a specific target card.
 */
export function getTargetCardOverrides(
  targetCard: Card,
  userId?: string
): Record<number, PrecedentSlotOverride> {
  const all = getAllPrecedentOverrides(userId);
  const targetKey = getTargetCardKey(targetCard);
  return all[targetKey]?.slots || {};
}

/**
 * Saves a user-defined replacement card for a specific slot on a target card.
 */
export function savePrecedentOverride(
  targetCard: Card,
  slotIndex: number,
  originalMatch: SimilarCardMatch | null,
  replacementMatch: SimilarCardMatch,
  userId?: string
): void {
  try {
    const key = getPrecedentStorageKey(userId);
    const all = getAllPrecedentOverrides(userId);
    const targetKey = getTargetCardKey(targetCard);

    if (!all[targetKey]) {
      all[targetKey] = {
        targetKey,
        slots: {},
      };
    }

    const enrichedMatch: SimilarCardMatch = {
      ...replacementMatch,
      isCustomOverride: true,
      originalCardName: originalMatch?.card.name,
    };

    all[targetKey].slots[slotIndex] = {
      slotIndex,
      originalCardName: originalMatch?.card.name,
      originalCardId: originalMatch?.card.id,
      replacementMatch: enrichedMatch,
      replacedAt: new Date().toISOString(),
    };

    localStorage.setItem(key, JSON.stringify(all));
  } catch (err) {
    console.error('Failed to save precedent override:', err);
  }
}

/**
 * Removes a specific slot override for a target card, reverting it to default.
 */
export function removePrecedentOverride(
  targetCard: Card,
  slotIndex: number,
  userId?: string
): void {
  try {
    const key = getPrecedentStorageKey(userId);
    const all = getAllPrecedentOverrides(userId);
    const targetKey = getTargetCardKey(targetCard);

    if (all[targetKey]?.slots) {
      delete all[targetKey].slots[slotIndex];
      if (Object.keys(all[targetKey].slots).length === 0) {
        delete all[targetKey];
      }
      localStorage.setItem(key, JSON.stringify(all));
    }
  } catch (err) {
    console.error('Failed to remove precedent override:', err);
  }
}

/**
 * Clears all slot overrides for a target card.
 */
export function clearTargetCardOverrides(targetCard: Card, userId?: string): void {
  try {
    const key = getPrecedentStorageKey(userId);
    const all = getAllPrecedentOverrides(userId);
    const targetKey = getTargetCardKey(targetCard);

    if (all[targetKey]) {
      delete all[targetKey];
      localStorage.setItem(key, JSON.stringify(all));
    }
  } catch (err) {
    console.error('Failed to clear target card precedent overrides:', err);
  }
}
