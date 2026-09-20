import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  ContextualTourStepId,
  ALL_CONTEXTUAL_TOUR_STEPS,
  getCompletedTourSteps,
  markTourStepCompleted,
  resetTourSteps as resetStorageTourSteps,
  skipAllTourSteps as skipStorageTourSteps,
} from '../services/storage';

export interface TourStepDefinition {
  id: ContextualTourStepId;
  title: string;
  badge: string;
  targetSelector: string;
  preferredPlacement: 'bottom' | 'top' | 'left' | 'right';
  description: string;
  secondaryNote?: string;
}

export const TOUR_STEP_DEFINITIONS: Record<ContextualTourStepId, TourStepDefinition> = {
  set_selector: {
    id: 'set_selector',
    title: 'Switch Active Set',
    badge: 'Format Switcher',
    targetSelector: '#nav-set-selector',
    preferredPlacement: 'bottom',
    description:
      'Click here to switch MTG sets anytime. Explore current Standard formats, upcoming preview seasons, and historical booster draft formats.',
  },
  grading_mode: {
    id: 'grading_mode',
    title: 'Grading vs. 17Lands Mode',
    badge: 'Compare & Telemetry',
    targetSelector: '#mode-toggle-btn',
    preferredPlacement: 'bottom',
    description:
      'Toggle between Grading Mode (benchmarks hidden for blind evaluation) and Compare Mode (17Lands win rates, ALSA, and GIH revealed side-by-side).',
    secondaryNote:
      'Note: For unreleased preview sets, 17Lands data will show automatically once players draft on MTG Arena and data accumulates (~2 weeks post-release).',
  },
  enter_grade: {
    id: 'enter_grade',
    title: 'Enter Card Grades',
    badge: '1-Click Rating',
    targetSelector: '#rate-card-bar',
    preferredPlacement: 'top',
    description:
      'Assign letter grades (A+ through F) in 1 click using the quick rate buttons on any card, or click the card body to add notes and adjust archetype tiers.',
  },
  view_comps: {
    id: 'view_comps',
    title: 'View Comparable Cards',
    badge: 'Precedent Engine',
    targetSelector: '#comps-action-btn',
    preferredPlacement: 'top',
    description:
      'Click Comps on any card to consult the Precedent Engine! Compare against historically similar cards across modern sets with win-rates and empirical grade baselines.',
  },
  replace_comp: {
    id: 'replace_comp',
    title: 'Replace Comps by Searching',
    badge: 'Custom Precedents',
    targetSelector: '#comp-search-bar',
    preferredPlacement: 'bottom',
    description:
      'Customize your historical comps! Search across all of Magic history by card name, oracle text, or mana cost, or click Swap on any slot to replace it.',
  },
  export_grades: {
    id: 'export_grades',
    title: 'Export & Share Grades',
    badge: 'Data Portability',
    targetSelector: '#export-grades-btn',
    preferredPlacement: 'bottom',
    description:
      'Export your card ratings to a CSV spreadsheet, back up your evaluations, or publish directly to 17Lands tier list format.',
  },
  quiz_overview: {
    id: 'quiz_overview',
    title: 'How Quizzes Work',
    badge: 'Tactical Drills',
    targetSelector: '#quiz-setup-header',
    preferredPlacement: 'bottom',
    description:
      'Sharpen your draft instincts with tactical format quizzes! Test your skills on Pack 1 Pick 1 priorities, 17Lands trap vs. sleeper detection, quadrant theory, and combat tricks across Timed, Practice, or Mastery modes.',
  },
};

interface ContextualTourContextType {
  activeStep: TourStepDefinition | null;
  completedSteps: ContextualTourStepId[];
  isTourActive: boolean;
  registerTrigger: (stepId: ContextualTourStepId) => void;
  dismissActiveStep: () => void;
  skipAll: () => void;
  resetTour: () => void;
  isStepCompleted: (stepId: ContextualTourStepId) => boolean;
}

const ContextualTourContext = createContext<ContextualTourContextType | undefined>(undefined);

export const ContextualTourProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [completedSteps, setCompletedSteps] = useState<ContextualTourStepId[]>(() => getCompletedTourSteps());
  const [activeStepId, setActiveStepId] = useState<ContextualTourStepId | null>(null);
  const [registeredPendingSteps, setRegisteredPendingSteps] = useState<Set<ContextualTourStepId>>(new Set());

  // Determine the active step definition
  const activeStep = useMemo(() => {
    if (!activeStepId) return null;
    return TOUR_STEP_DEFINITIONS[activeStepId] || null;
  }, [activeStepId]);

  // Register an entry trigger for a step (called when a page/modal mounts or opens)
  const registerTrigger = useCallback((stepId: ContextualTourStepId) => {
    setCompletedSteps((currentCompleted) => {
      if (currentCompleted.includes(stepId)) {
        return currentCompleted;
      }

      setRegisteredPendingSteps((prev) => {
        const next = new Set(prev);
        next.add(stepId);
        return next;
      });

      setActiveStepId((currentActive) => {
        // If already showing a step, keep showing it
        if (currentActive) {
          return currentActive;
        }
        return stepId;
      });

      return currentCompleted;
    });
  }, []);

  // Dismiss current active step and advance to next pending step if available
  const dismissActiveStep = useCallback(() => {
    if (!activeStepId) return;

    markTourStepCompleted(activeStepId);

    setCompletedSteps((prev) => {
      if (!prev.includes(activeStepId)) {
        return [...prev, activeStepId];
      }
      return prev;
    });

    setRegisteredPendingSteps((prev) => {
      const next = new Set(prev);
      next.delete(activeStepId);

      // Find next pending step that is not yet completed
      const remaining = Array.from(next);
      if (remaining.length > 0) {
        remaining.sort((a, b) => ALL_CONTEXTUAL_TOUR_STEPS.indexOf(a) - ALL_CONTEXTUAL_TOUR_STEPS.indexOf(b));
        setActiveStepId(remaining[0]);
      } else {
        setActiveStepId(null);
      }

      return next;
    });
  }, [activeStepId]);

  // Skip all remaining steps
  const skipAll = useCallback(() => {
    skipStorageTourSteps();
    setCompletedSteps(ALL_CONTEXTUAL_TOUR_STEPS);
    setActiveStepId(null);
    setRegisteredPendingSteps(new Set());
  }, []);

  // Reset tour so user can re-run onboarding
  const resetTour = useCallback(() => {
    resetStorageTourSteps();
    setCompletedSteps([]);
    setActiveStepId(null);
    setRegisteredPendingSteps(new Set());
  }, []);

  const isStepCompleted = useCallback(
    (stepId: ContextualTourStepId) => {
      return completedSteps.includes(stepId);
    },
    [completedSteps]
  );

  return (
    <ContextualTourContext.Provider
      value={{
        activeStep,
        completedSteps,
        isTourActive: Boolean(activeStep),
        registerTrigger,
        dismissActiveStep,
        skipAll,
        resetTour,
        isStepCompleted,
      }}
    >
      {children}
    </ContextualTourContext.Provider>
  );
};

export const useContextualTour = (): ContextualTourContextType => {
  const context = useContext(ContextualTourContext);
  if (!context) {
    throw new Error('useContextualTour must be used within a ContextualTourProvider');
  }
  return context;
};
