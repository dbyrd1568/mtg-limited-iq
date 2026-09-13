import React, { useState, useEffect, useCallback } from 'react';
import { Card, QuestionCategory, QuizOption, QuizQuestion, QuizResult, QuizSettings, SetInfo, SeventeenLandsSetData, UserCardEvaluation, UserProfileStats, UserAccount } from './types/mtg';
import { fetchCardsForSet, fetchAllSets, POPULAR_LIMITED_SETS } from './services/scryfall';
import { fetch17LandsSetData, is17LandsEligibleForSet, getPreloaded17LandsData, generateEstimated17LandsData } from './services/seventeenLands';
import { loadUserStats, loadUserEvaluations, saveUserEvaluation, clearUserEvaluationsForSet, recordQuizCompletion, defaultStats, getLastSelectedSetCode, saveLastSelectedSetCode, getActiveUser, setActiveUser, clearActiveUser, getBlindGradingForSet, setBlindGradingForSet, hasSeenWelcomeTour } from './services/storage';

import { generateQuiz } from './services/quizGenerator';
import { supabase, isSupabaseConfigured } from './services/supabase';
import { supabaseUserToUserAccount } from './services/auth';
import { pullRemoteUserData, migrateLocalDataToCloud } from './services/cloudSync';
import { isCloudUUID } from './services/environment';
import { checkIsAdmin } from './services/admin';
import { trackFeature, trackLogin, KNOWN_FEATURES } from './services/telemetry';

// Components
import { Navbar, ActiveTab } from './components/Navbar';
import { SetSelectorModal } from './components/SetSelectorModal';
import { AuthModal } from './components/Auth/AuthModal';
import { LoginGate } from './components/Auth/LoginGate';
import { AdminDashboard } from './components/Admin/AdminDashboard';
import { AdminAccessDenied } from './components/Admin/AdminAccessDenied';
import { WelcomeTourModal } from './components/UI/WelcomeTourModal';
import { EmptySetPlaceholder } from './components/UI/EmptySetPlaceholder';
import { QuizSetup } from './components/Quiz/QuizSetup';
import { QuizActive } from './components/Quiz/QuizActive';
import { QuizSummary } from './components/Quiz/QuizSummary';
import { EvaluationHub } from './components/Evaluation/EvaluationHub';
import { ExportGradesModal } from './components/Evaluation/ExportGradesModal';
import { StatsDashboard } from './components/Stats/StatsDashboard';
import { SetExplorer } from './components/Explorer/SetExplorer';
import { parseAppUrlParams, updateAppUrlParams } from './services/urlParams';
import { Brain, Flame } from 'lucide-react';
import { PlaneswalkerSymbol } from './components/UI/PlaneswalkerSymbol';
import { SetBadge, SetSymbol } from './components/UI/SetSymbol';

export const App: React.FC = () => {
  // Navigation & Modal State (Parsed from URL query parameters)
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const params = parseAppUrlParams();
    return params.tab || 'evaluation';
  });
  const [quizSubTab, setQuizSubTab] = useState<'take' | 'stats'>(() => {
    const params = parseAppUrlParams();
    return params.quiz_subtab || 'take';
  });
  const [isSetSelectorOpen, setIsSetSelectorOpen] = useState<boolean>(() => {
    const params = parseAppUrlParams();
    const savedCode = getLastSelectedSetCode();
    return !params.set && !savedCode && hasSeenWelcomeTour();
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isWelcomeTourOpen, setIsWelcomeTourOpen] = useState<boolean>(() => !hasSeenWelcomeTour());
  const [isGlobalExportModalOpen, setIsGlobalExportModalOpen] = useState<boolean>(false);

  // User Accounts State (Nullable when unauthenticated)
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => getActiveUser());
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isAuthInitializing, setIsAuthInitializing] = useState<boolean>(true);

  // Check administrator permissions whenever currentUser changes
  useEffect(() => {
    checkIsAdmin(currentUser).then((res) => setIsAdmin(res));
  }, [currentUser]);

  // Set & Cards State: Only set if specified in URL or previously saved by user (otherwise null)
  const [allSets, setAllSets] = useState<SetInfo[]>(POPULAR_LIMITED_SETS);
  const [currentSet, setCurrentSet] = useState<SetInfo | null>(() => {
    const params = parseAppUrlParams();
    if (params.set) {
      const match = POPULAR_LIMITED_SETS.find((p) => p.code.toUpperCase() === params.set?.toUpperCase());
      if (match) return match;
      return {
        code: params.set.toUpperCase(),
        name: `Set (${params.set.toUpperCase()})`,
        card_count: 270,
        set_type: 'expansion',
      };
    }
    const savedCode = getLastSelectedSetCode();
    if (savedCode) {
      const match = POPULAR_LIMITED_SETS.find((p) => p.code.toUpperCase() === savedCode.toUpperCase());
      if (match) return match;
      return {
        code: savedCode.toUpperCase(),
        name: `Set (${savedCode.toUpperCase()})`,
        card_count: 270,
        set_type: 'expansion',
      };
    }
    return null;
  });

  const [cards, setCards] = useState<Card[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<{ loaded: number; total: number } | null>(null);

  // 17Lands Data State (Preloaded immediately on frame 0 to eliminate "Data Unavailable" delay)
  const [seventeenLandsData, setSeventeenLandsData] = useState<SeventeenLandsSetData | null>(() => {
    const params = parseAppUrlParams();
    const targetCode = currentSet?.code || params.set || getLastSelectedSetCode() || 'HOB';
    return getPreloaded17LandsData(targetCode);
  });


  // User Stats & Evaluations State (Scoped to currentUser)
  const [userStats, setUserStats] = useState<UserProfileStats>(() => loadUserStats(currentUser?.id || 'guest'));
  const [userEvaluations, setUserEvaluations] = useState<Record<string, UserCardEvaluation>>(() => loadUserEvaluations(currentUser?.id || 'guest'));

  // Blind Grading Preference (Shared between Grading Hub and Cards Explorer)
  const [isBlindGrading, setIsBlindGrading] = useState<boolean>(() => {
    if (!currentSet) return true;
    return getBlindGradingForSet(currentSet.code, currentUser?.id || 'guest', currentSet.card_count);
  });

  // Shared Card Filter State (persists across Grading ↔ Cards tab switches)
  const [sharedSearchQuery, setSharedSearchQuery] = useState<string>('');
  const [sharedSelectedColors, setSharedSelectedColors] = useState<string[]>(['ALL']);
  const [sharedSelectedRarities, setSharedSelectedRarities] = useState<string[]>(['ALL']);
  const [sharedSelectedRoles, setSharedSelectedRoles] = useState<string[]>(['ALL']);

  useEffect(() => {
    if (currentSet) {
      setIsBlindGrading(getBlindGradingForSet(currentSet.code, currentUser?.id || 'guest', cards.length || currentSet.card_count));
    }
  }, [currentSet?.code, currentUser?.id, cards.length, currentSet?.card_count]);

  const handleToggleBlindGrading = useCallback(() => {
    if (!currentSet) return;
    setIsBlindGrading((prev) => {
      const next = !prev;
      setBlindGradingForSet(currentSet.code, next, currentUser?.id || 'guest');
      trackFeature('blind_grading', { set: currentSet.code, enabled: next }, currentUser);
      return next;
    });
  }, [currentSet, currentUser]);

  // Quiz Workflow State
  const [quizState, setQuizState] = useState<'setup' | 'active' | 'summary'>('setup');
  const [activeQuestions, setActiveQuestions] = useState<QuizQuestion[]>([]);
  const [activeSettings, setActiveSettings] = useState<QuizSettings | null>(null);
  const [lastResult, setLastResult] = useState<QuizResult | null>(null);

  // Supabase Auth Listener on Startup
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setIsAuthInitializing(false);
      return;
    }

    let isProcessingSession = false;
    const handleUserSession = async (user: any) => {
      if (!user || isProcessingSession) return;
      isProcessingSession = true;

      try {
        const cloudUser = supabaseUserToUserAccount(user);
        setActiveUser(cloudUser);
        setCurrentUser(cloudUser);

        // Track real user login in telemetry
        trackLogin(cloudUser);

        // Ensure user profile in Supabase includes verified email and name
        if (isCloudUUID(cloudUser.id)) {
          supabase
            .from('profiles')
            .upsert({
              id: cloudUser.id,
              display_name: cloudUser.name,
              email: cloudUser.email || user.email,
              avatar_url: cloudUser.avatarUrl,
              updated_at: new Date().toISOString(),
            })
            .then(
              () => {},
              () => {}
            );
        }

        // 1. Pull existing remote cloud data
        const { stats, evaluations } = await pullRemoteUserData(cloudUser.id);

        // 2. Check if local guest has progress and cloud is fresh
        const localStats = loadUserStats('guest');
        const localEvals = loadUserEvaluations('guest');
        const hasLocalProgress = localStats.totalQuizzes > 0 || Object.keys(localEvals).length > 0;

        if ((!stats || stats.totalQuizzes === 0) && hasLocalProgress) {
          await migrateLocalDataToCloud(cloudUser.id, 'guest');
          const refreshed = await pullRemoteUserData(cloudUser.id);
          if (refreshed.stats) setUserStats(refreshed.stats);
          if (refreshed.evaluations && Object.keys(refreshed.evaluations).length > 0) {
            setUserEvaluations(refreshed.evaluations);
          }
        } else {
          if (stats) setUserStats(stats);
          if (evaluations && Object.keys(evaluations).length > 0) {
            setUserEvaluations(evaluations);
          }
        }
      } catch (err) {
        console.warn('Error handling user session:', err);
      } finally {
        isProcessingSession = false;
        setIsAuthInitializing(false);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        handleUserSession(session.user);
      } else {
        clearActiveUser();
        setCurrentUser(null);
        setIsAuthInitializing(false);
      }
    }).catch(() => {
      clearActiveUser();
      setCurrentUser(null);
      setIsAuthInitializing(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await handleUserSession(session.user);
      } else if (event === 'SIGNED_OUT') {
        clearActiveUser();
        setCurrentUser(null);
        setUserStats(defaultStats);
        setUserEvaluations({});
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Initial Data Load (Stats, Evaluations, Sets)
  useEffect(() => {
    if (!currentUser) return;
    const loadedStats = loadUserStats(currentUser.id);
    setUserStats(loadedStats);

    const loadedEvals = loadUserEvaluations(currentUser.id);
    setUserEvaluations(loadedEvals);

    fetchAllSets()
      .then((sets) => {
        if (sets && sets.length > 0) {
          const sorted = [...sets].sort((a, b) => (b.released_at || '').localeCompare(a.released_at || ''));
          setAllSets(sorted);

          const savedCode = getLastSelectedSetCode(currentUser.id);
          if (savedCode) {
            const match = sorted.find(s => s.code.toUpperCase() === savedCode.toUpperCase());
            if (match) {
              setCurrentSet(match);
            }
          }
        }
      })
      .catch((err) => console.warn('Could not load all sets list:', err));
  }, [currentUser?.id]);

  // Handle User Switch
  const handleUserChanged = (newUser: UserAccount | null) => {
    setCurrentUser(newUser);
    if (newUser) {
      setUserStats(loadUserStats(newUser.id));
      setUserEvaluations(loadUserEvaluations(newUser.id));
    }
  };

  // Fetch cards and 17lands data whenever currentSet changes
  const loadSetData = useCallback(async (set: SetInfo | null) => {
    if (!set) {
      setCards([]);
      setSeventeenLandsData(null);
      setIsLoadingCards(false);
      setDownloadProgress(null);
      return;
    }

    setIsLoadingCards(true);
    setDownloadProgress(null);

    // Instantly populate preloaded 17Lands data so all 17Lands features are immediately active
    const preloaded = getPreloaded17LandsData(set.code);
    if (preloaded) {
      setSeventeenLandsData(preloaded);
    } else {
      setSeventeenLandsData(null);
    }

    // Concurrently fetch cards and latest 17Lands telemetry
    const cardsPromise = fetchCardsForSet(
      set.code,
      (loaded, total) => {
        setDownloadProgress({ loaded, total });
      },
      (cachedCards) => {
        // Immediately populate cached cards to eliminate blank screen while checking Scryfall
        setCards(cachedCards);
        setIsLoadingCards(false);
      }
    );

    const landsPromise = set.has_17lands_data !== false
      ? fetch17LandsSetData(set.code)
      : Promise.resolve(null);

    try {
      const [fetchedCards, landsData] = await Promise.all([cardsPromise, landsPromise]);
      setCards(fetchedCards);

      if (
        landsData &&
        landsData.setCode?.toUpperCase() === set.code.toUpperCase() &&
        (landsData.sampleSize || 0) > 500 &&
        Object.keys(landsData.cards || {}).length >= 5
      ) {
        setSeventeenLandsData(landsData);
      } else if (preloaded) {
        setSeventeenLandsData(preloaded);
      } else if (set.has_17lands_data !== false && fetchedCards && fetchedCards.length > 0) {
        // Ensure every set that has 17Lands draft history has rich telemetry
        const estimated = generateEstimated17LandsData(fetchedCards);
        setSeventeenLandsData(estimated);
      } else {
        setSeventeenLandsData(null);
      }
    } catch (err) {
      console.error(`Error loading data for set ${set.code}:`, err);
      if (!preloaded) {
        setSeventeenLandsData(null);
      }
    } finally {
      setIsLoadingCards(false);
    }
  }, []);


  useEffect(() => {
    loadSetData(currentSet);
  }, [currentSet, loadSetData]);

  // Sync URL query params whenever activeTab or currentSet changes
  useEffect(() => {
    updateAppUrlParams({
      tab: activeTab,
      set: currentSet ? currentSet.code : undefined,
    });
  }, [activeTab, currentSet]);

  // Handle browser back/forward history navigation
  useEffect(() => {
    const handlePopState = () => {
      const params = parseAppUrlParams();
      if (params.tab && params.tab !== activeTab) {
        setActiveTab(params.tab);
      }
      if (params.set && params.set.toUpperCase() !== currentSet?.code.toUpperCase()) {
        const found = allSets.find(s => s.code.toUpperCase() === params.set?.toUpperCase());
        if (found) setCurrentSet(found);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTab, currentSet?.code, allSets]);

  // Handle Set Change
  const handleSelectSet = (set: SetInfo) => {
    saveLastSelectedSetCode(set.code, currentUser?.id || 'guest');
    setCurrentSet(set);
    setIsSetSelectorOpen(false);
    setQuizState('setup');
    trackFeature('set_switcher', { set: set.code }, currentUser);
  };

  // Quiz Handlers
  const handleStartQuiz = (settings: QuizSettings) => {
    if (cards.length === 0 || !currentSet) return;

    const missedKeys = new Set(Object.keys(userStats.missedCards || {}));
    const generatedQuestions = generateQuiz(cards, settings, seventeenLandsData, missedKeys, currentSet.released_at);

    if (generatedQuestions.length === 0) {
      alert('Not enough cards in this set matching your selected filters. Please adjust question categories or rarities.');
      return;
    }

    setActiveSettings(settings);
    setActiveQuestions(generatedQuestions);
    setQuizState('active');
  };

  const handleFinishQuiz = (result: QuizResult) => {
    const updatedStats = recordQuizCompletion(result, currentUser?.id || 'guest');
    setUserStats(updatedStats);
    setLastResult(result);
    setQuizState('summary');
    trackFeature('card_quiz', {
      set: result.setCode,
      score: result.score,
      total: result.totalQuestions,
      pct: result.percentage,
    }, currentUser);
  };

  const handleRetakeQuiz = () => {
    if (activeSettings) {
      handleStartQuiz(activeSettings);
    } else {
      setQuizState('setup');
    }
  };

  const handlePracticeMissedCards = () => {
    if (cards.length === 0 || !currentSet) return;
    const is17Eligible = is17LandsEligibleForSet(currentSet.released_at, seventeenLandsData, currentSet.code, cards);
    const availableCats: QuestionCategory[] = [
      'p1p1_pick',
      'quadrant_role',
      'combat_tricks',
      'instant_speed',
      'mana_cost_and_splash',
      'power_toughness',
      'archetype_engine',
    ];
    if (is17Eligible) {
      availableCats.push('trap_or_sleeper', 'card_evaluation');
    }
    const settings: QuizSettings = {
      setCode: currentSet.code,
      setName: currentSet.name,
      releasedAt: currentSet.released_at,
      questionCount: 10,
      categories: availableCats,
      rarities: ['common', 'uncommon', 'rare', 'mythic'],
      timerSeconds: 0,
      mode: 'quiz',
      onlyMissedCards: true,
    };
    setQuizSubTab('take');
    handleStartQuiz(settings);
  };

  // Evaluation Handlers
  const handleSaveEvaluation = (evaluation: UserCardEvaluation) => {
    saveUserEvaluation(evaluation, currentUser?.id || 'guest');
    setUserEvaluations((prev) => ({
      ...prev,
      [`${evaluation.setCode.toLowerCase()}_${evaluation.cardName.toLowerCase()}`]: evaluation,
    }));
    trackFeature('card_grading', {
      set: evaluation.setCode,
      card: evaluation.cardName,
      grade: evaluation.userGrade,
      score: evaluation.userScore,
    }, currentUser);
  };

  const handleClearEvaluationsForSet = (setCode: string) => {
    const updated = clearUserEvaluationsForSet(setCode, currentUser?.id || 'guest');
    setUserEvaluations(updated);
  };

  const missedCountForCurrentSet = currentSet
    ? Object.values(userStats.missedCards || {}).filter(
        (m) => m.setCode.toUpperCase() === currentSet.code.toUpperCase()
      ).length
    : 0;

  // Show loading state while checking initial session
  if (isAuthInitializing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 dark:bg-[#030614] text-slate-900 dark:text-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-amber-500 dark:from-violet-500 dark:via-indigo-500 dark:to-cyan-400 flex items-center justify-center text-white shadow-xl shadow-violet-500/20 p-2.5 animate-pulse">
            <PlaneswalkerSymbol className="w-full h-full text-white drop-shadow-xs" />
          </div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-600 dark:text-slate-400 animate-pulse">
            <span>Loading MTG Limited IQ...</span>
          </div>
        </div>
      </div>
    );
  }

  // Require Authentication Gate (Enforced on all environments, including localhost)
  if (!currentUser) {
    return (
      <LoginGate
        onAuthenticated={(user) => {
          setCurrentUser(user);
          setUserStats(loadUserStats(user.id));
          setUserEvaluations(loadUserEvaluations(user.id));
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-[#030614] text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200">
      {/* Top Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          trackFeature('tab_navigation', { tab }, currentUser);
          if (tab === 'explorer' && currentSet) {
            trackFeature(KNOWN_FEATURES.SET_EXPLORER, { setCode: currentSet.code, setName: currentSet.name }, currentUser);
          }
          if (tab === 'quiz') {
            setQuizState('setup');
          }
        }}
        currentSet={currentSet}
        onOpenSetSelector={() => setIsSetSelectorOpen(true)}
        userStats={userStats}
        currentUser={currentUser}
        isAdmin={isAdmin}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenWelcomeTour={() => setIsWelcomeTourOpen(true)}
        onOpenExportModal={() => setIsGlobalExportModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {activeTab === 'admin' ? (
          isAdmin ? (
            <AdminDashboard
              currentUser={currentUser}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
              onReturnHome={() => setActiveTab('evaluation')}
              initialSubTab={parseAppUrlParams().subtab as any}
            />
          ) : (
            <AdminAccessDenied
              currentUser={currentUser}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
              onReturnHome={() => setActiveTab('evaluation')}
            />
          )
        ) : !currentSet ? (
          <EmptySetPlaceholder
            onOpenSetSelector={() => setIsSetSelectorOpen(true)}
            onSelectSet={handleSelectSet}
            popularSets={allSets.slice(0, 6)}
          />
        ) : (
          <>
            {activeTab === 'quiz' && (
              <>
                {quizState === 'active' && activeQuestions.length > 0 ? (
                  <QuizActive
                    questions={activeQuestions}
                    cards={cards}
                    setCode={currentSet.code}
                    setName={currentSet.name}
                    timerSeconds={activeSettings?.timerSeconds || 0}
                    onFinishQuiz={handleFinishQuiz}
                    onExitQuiz={() => setQuizState('setup')}
                  />
                ) : (
                  <div className="space-y-4">
                    {/* Quiz Subtab Navigation Header */}
                    <div className="max-w-[1440px] mx-auto px-3 sm:px-6 pt-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap pb-3 border-b border-slate-200 dark:border-slate-800/80">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 via-indigo-600 to-amber-500 dark:from-violet-500 dark:via-indigo-500 dark:to-cyan-400 flex items-center justify-center text-white shadow-md shadow-violet-500/20 shrink-0 p-1.5 border border-white/20">
                            <PlaneswalkerSymbol className="w-full h-full text-white drop-shadow-xs" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-heading">
                                Card Quiz & Tactical Mastery
                              </h1>
                              <SetBadge setCode={currentSet.code} iconSvgUri={currentSet.icon_svg_uri} size="xs" className="px-2 py-0.5 text-[11px]" />
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              Drill {currentSet.name} heuristics, analyze category proficiency, and master missed cards.
                            </p>
                          </div>
                        </div>

                        {/* Right side: Streak, Level, and Subtabs */}
                        <div className="flex items-center gap-2.5 flex-wrap">
                          {/* Streak & Level badges (moved from Navbar to Card Quiz) */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div
                              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-700/50 text-amber-700 dark:text-amber-400 text-xs font-semibold whitespace-nowrap shadow-xs"
                              title={`Current Streak: ${userStats.currentStreak}`}
                            >
                              <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                              <span>{userStats.currentStreak} Streak</span>
                            </div>

                            <div
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-[#060a1d] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium whitespace-nowrap shadow-xs"
                              title={`Level ${userStats.level} (${userStats.xp} Total XP) • Gain XP by taking quizzes and grading cards`}
                            >
                              <span className="font-mono font-bold text-violet-600 dark:text-violet-400">Lv.{userStats.level}</span>
                              <span className="text-slate-500 dark:text-slate-400 text-[11px]">({userStats.xp} XP)</span>
                            </div>
                          </div>

                          {/* Subtabs Pill Switcher (Text only, NO icons on sub modes) */}
                          <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100/90 dark:bg-[#060a1d] border border-slate-200/90 dark:border-slate-800/80 shadow-xs">
                            <button
                              onClick={() => {
                                setQuizSubTab('take');
                                updateAppUrlParams({ tab: 'quiz', subtab: undefined });
                              }}
                              className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                                quizSubTab === 'take'
                                  ? 'bg-violet-600 text-white shadow-xs font-bold'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                              }`}
                            >
                              Take Quiz
                            </button>

                            <button
                              onClick={() => {
                                setQuizSubTab('stats');
                                updateAppUrlParams({ tab: 'quiz', subtab: 'stats' });
                              }}
                              className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                                quizSubTab === 'stats'
                                  ? 'bg-violet-600 text-white shadow-xs font-bold'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                              }`}
                            >
                              Mastery Stats
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {quizSubTab === 'take' && (
                      <>
                        {quizState === 'setup' && (
                          <QuizSetup
                            currentSet={currentSet}
                            onStartQuiz={handleStartQuiz}
                            onOpenSetSelector={() => setIsSetSelectorOpen(true)}
                            availableCardsCount={cards.length}
                            missedCardsCount={missedCountForCurrentSet}
                            seventeenLandsData={seventeenLandsData}
                            cards={cards}
                          />

                        )}

                        {quizState === 'summary' && lastResult && (
                          <QuizSummary
                            result={lastResult}
                            onRetakeQuiz={handleRetakeQuiz}
                            onPracticeMissed={handlePracticeMissedCards}
                            onGoToEvaluation={() => setActiveTab('evaluation')}
                            onGoToStats={() => {
                              setQuizSubTab('stats');
                              updateAppUrlParams({ tab: 'quiz', subtab: 'stats' });
                            }}
                          />
                        )}
                      </>
                    )}

                    {quizSubTab === 'stats' && (
                      <StatsDashboard
                        userStats={userStats}
                        onDrillMissedCards={handlePracticeMissedCards}
                        onRefreshStats={() => {
                          const activeId = currentUser?.id || 'guest';
                          setUserStats(loadUserStats(activeId));
                          setUserEvaluations(loadUserEvaluations(activeId));
                        }}
                        onTakeQuiz={() => {
                          setQuizSubTab('take');
                          setQuizState('setup');
                          updateAppUrlParams({ tab: 'quiz', subtab: undefined });
                        }}
                        onSelectCardName={(cardName) => {
                          const matched = cards.find(
                            (c) => c.name.toLowerCase() === cardName.toLowerCase()
                          );
                          if (matched) {
                            setActiveTab('evaluation');
                            updateAppUrlParams({
                              tab: 'evaluation',
                              card: matched.collector_number || matched.name,
                            });
                          }
                        }}
                      />
                    )}
                  </div>
                )}
              </>
            )}

            {activeTab === 'evaluation' && (
              <EvaluationHub
                cards={cards}
                currentSetCode={currentSet.code}
                currentSetName={currentSet.name}
                currentSet={currentSet}
                currentUser={currentUser}
                userEvaluations={userEvaluations}
                seventeenLandsData={seventeenLandsData}
                isBlindGrading={isBlindGrading}
                onToggleBlindGrading={handleToggleBlindGrading}
                onSaveEvaluation={handleSaveEvaluation}
                onClearEvaluationsForSet={handleClearEvaluationsForSet}
                onOpenSetSelector={() => setIsSetSelectorOpen(true)}
                searchQuery={sharedSearchQuery}
                selectedColors={sharedSelectedColors}
                selectedRarities={sharedSelectedRarities}
                selectedRoles={sharedSelectedRoles}
                onSearchQueryChange={setSharedSearchQuery}
                onSelectedColorsChange={setSharedSelectedColors}
                onSelectedRaritiesChange={setSharedSelectedRarities}
                onSelectedRolesChange={setSharedSelectedRoles}
                availableSets={allSets}
              />
            )}

            {activeTab === 'explorer' && (
              <SetExplorer
                cards={cards}
                currentSetCode={currentSet.code}
                currentSetName={currentSet.name}
                currentSet={currentSet}
                currentUser={currentUser}
                userEvaluations={userEvaluations}
                seventeenLandsData={seventeenLandsData}
                isBlindGrading={isBlindGrading}
                onToggleBlindGrading={handleToggleBlindGrading}
                onSaveEvaluation={handleSaveEvaluation}
                onClearEvaluationsForSet={handleClearEvaluationsForSet}
                searchQuery={sharedSearchQuery}
                selectedColors={sharedSelectedColors}
                selectedRarities={sharedSelectedRarities}
                selectedRoles={sharedSelectedRoles}
                onSearchQueryChange={setSharedSearchQuery}
                onSelectedColorsChange={setSharedSelectedColors}
                onSelectedRaritiesChange={setSharedSelectedRarities}
                onSelectedRolesChange={setSharedSelectedRoles}
                onGradeCard={(card) => {
                  setActiveTab('evaluation');
                  updateAppUrlParams({
                    tab: 'evaluation',
                    subtab: 'grade',
                    card: card.collector_number || card.name,
                  });
                }}
              />
            )}

          </>
        )}
      </main>

      {/* Set Selector Modal */}
      <SetSelectorModal
        isOpen={isSetSelectorOpen}
        onClose={() => setIsSetSelectorOpen(false)}
        allSets={allSets}
        currentSetCode={currentSet?.code || ''}
        onSelectSet={handleSelectSet}
        isLoadingCards={isLoadingCards}
        downloadProgress={downloadProgress}
      />

      {/* User Auth & Profile Switcher Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onUserChange={handleUserChanged}
        onRefreshStats={() => {
          const activeId = currentUser?.id || 'guest';
          setUserStats(loadUserStats(activeId));
          setUserEvaluations(loadUserEvaluations(activeId));
        }}
      />

      {/* Welcome Guide & Tour Modal */}
      <WelcomeTourModal
        isOpen={isWelcomeTourOpen}
        onClose={() => {
          setIsWelcomeTourOpen(false);
          if (!currentSet) {
            setIsSetSelectorOpen(true);
          }
        }}
        onNavigateTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'quiz') {
            setQuizState('setup');
          }
        }}
        onOpenSetSelector={() => {
          setIsWelcomeTourOpen(false);
          setIsSetSelectorOpen(true);
        }}
      />

      {/* Global Export & Backup Modal (Accessible to all users from Top Navigation) */}
      <ExportGradesModal
        isOpen={isGlobalExportModalOpen}
        onClose={() => setIsGlobalExportModalOpen(false)}
        cards={cards}
        evaluations={userEvaluations}
        seventeenLandsData={seventeenLandsData}
        currentSet={currentSet || allSets[0]}
        userId={currentUser?.id}
      />
    </div>
  );
};

export default App;
