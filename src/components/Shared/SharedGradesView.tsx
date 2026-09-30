import React, { useState, useEffect, useMemo } from 'react';
import {
  Share2,
  Copy,
  Check,
  Download,
  Search,
  ExternalLink,
  Layers,
  Sparkles,
  AlertCircle,
  ArrowRight,
  Filter,
  Eye,
  Calendar,
  User,
  ShieldCheck,
} from 'lucide-react';
import { Card, SetInfo } from '../../types/mtg';
import { fetchCardsForSet, POPULAR_LIMITED_SETS } from '../../services/scryfall';
import { fetchGradeShareById, PublicGradeShare, SharedCardGrade, sanitizeNotes } from '../../services/shareGrades';
import { copyTextToClipboard, downloadFile } from '../../services/gradeExport';
import { SetSymbol } from '../UI/SetSymbol';
import { PlaneswalkerSymbol } from '../UI/PlaneswalkerSymbol';

interface SharedGradesViewProps {
  shareId: string;
  onExitShare?: () => void;
}

export const SharedGradesView: React.FC<SharedGradesViewProps> = ({ shareId, onExitShare }) => {
  const [share, setShare] = useState<PublicGradeShare | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  // Filters & Sorting
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('ALL');
  const [selectedTier, setSelectedTier] = useState<string>('ALL');
  const [selectedRarity, setSelectedRarity] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'grade' | 'name' | 'collector'>('grade');
  const [hoveredCard, setHoveredCard] = useState<Card | null>(null);

  // Load shared snapshot
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetchGradeShareById(shareId)
      .then((data) => {
        if (!isMounted) return;
        if (!data) {
          setError('This grade share link does not exist, has expired, or was revoked by its author.');
          setIsLoading(false);
          return;
        }
        setShare(data);
        setIsLoading(false);

        // Fetch card metadata for the set to display images, types, and mana costs
        setIsLoadingCards(true);
        fetchCardsForSet(data.setCode)
          .then((fetchedCards) => {
            if (isMounted) {
              setCards(fetchedCards);
              setIsLoadingCards(false);
            }
          })
          .catch((cardErr) => {
            console.warn('Could not fetch Scryfall card imagery for shared set:', cardErr);
            if (isMounted) setIsLoadingCards(false);
          });
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to load shared grades:', err);
        setError('Unable to load shared grades at this time. Please try again later.');
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [shareId]);

  // Lookup Set Info
  const setInfo: SetInfo = useMemo(() => {
    const code = share?.setCode || '';
    const match = POPULAR_LIMITED_SETS.find((s) => s.code.toUpperCase() === code.toUpperCase());
    if (match) return match;
    return {
      code,
      name: `Set (${code})`,
      card_count: cards.length || 270,
      set_type: 'expansion',
    };
  }, [share?.setCode, cards.length]);

  // Fast map of Card Name -> Card metadata
  const cardMap = useMemo(() => {
    const map = new Map<string, Card>();
    for (const c of cards) {
      if (c.name) {
        map.set(c.name.toLowerCase(), c);
      }
    }
    return map;
  }, [cards]);

  // Handle Copy Link
  const handleCopyLink = async () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    const success = await copyTextToClipboard(url);
    if (success) {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    }
  };

  // Handle Export CSV
  const handleExportCsv = () => {
    if (!share) return;
    const headers = ['Card Name', 'Set Code', 'Collector Number', 'Rarity', 'Mana Cost', 'Grade', 'Score (0-5)', 'Pick Priority', 'Notes'];
    const rows: string[] = [headers.join(',')];

    for (const [cardName, g] of Object.entries(share.grades)) {
      const card = cardMap.get(cardName.toLowerCase());
      const collector = card?.collector_number || '';
      const rarity = card?.rarity || '';
      const manaCost = (card?.mana_cost || '').replace(/[{}]/g, '');
      const notes = (g.notes || '').replace(/"/g, '""');

      const row = [
        `"${cardName.replace(/"/g, '""')}"`,
        `"${share.setCode}"`,
        `"${collector}"`,
        `"${rarity}"`,
        `"${manaCost}"`,
        `"${g.userGrade}"`,
        `${g.userScore}`,
        `"${g.pickPriority || ''}"`,
        `"${notes}"`,
      ];
      rows.push(row.join(','));
    }

    const csvContent = rows.join('\n');
    const filename = `${share.setCode}_grades_${share.authorName.replace(/\s+/g, '_')}.csv`;
    downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
  };

  // Filtered and Sorted Graded Cards
  const displayedGrades = useMemo(() => {
    if (!share?.grades) return [];
    let list: Array<{ grade: SharedCardGrade; card?: Card }> = Object.values(share.grades).map((g) => ({
      grade: g,
      card: cardMap.get(g.cardName.toLowerCase()),
    }));

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((item) => item.grade.cardName.toLowerCase().includes(q));
    }

    // Color filter
    if (selectedColor !== 'ALL') {
      list = list.filter((item) => {
        const c = item.card;
        if (!c) return true;
        const colors = c.colors || [];
        if (selectedColor === 'COLORLESS') return colors.length === 0;
        if (selectedColor === 'MULTI') return colors.length > 1;
        return colors.length === 1 && colors[0] === selectedColor;
      });
    }

    // Grade tier filter
    if (selectedTier !== 'ALL') {
      list = list.filter((item) => item.grade.userGrade.startsWith(selectedTier));
    }

    // Rarity filter
    if (selectedRarity !== 'ALL') {
      list = list.filter((item) => item.card?.rarity?.toLowerCase() === selectedRarity.toLowerCase());
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'grade') {
        return b.grade.userScore - a.grade.userScore;
      }
      if (sortBy === 'name') {
        return a.grade.cardName.localeCompare(b.grade.cardName);
      }
      if (sortBy === 'collector') {
        const numA = parseInt(a.card?.collector_number || '9999', 10);
        const numB = parseInt(b.card?.collector_number || '9999', 10);
        return numA - numB;
      }
      return 0;
    });

    return list;
  }, [share?.grades, cardMap, searchQuery, selectedColor, selectedTier, selectedRarity, sortBy]);

  // Loading Screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-violet-500/20 p-3 animate-pulse">
            <PlaneswalkerSymbol className="w-full h-full text-white" />
          </div>
          <p className="text-sm font-medium text-slate-400 animate-pulse">Loading shared card evaluations...</p>
        </div>
      </div>
    );
  }

  // Error / Expired Screen
  if (error || !share) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl space-y-5">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">Share Link Unavailable</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              {error || 'This grade share link does not exist, has expired, or was revoked by its author.'}
            </p>
          </div>
          <div className="pt-2">
            <a
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-all shadow-lg shadow-violet-600/30"
            >
              <span>Explore MTG Limited IQ</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  const { summary } = share;
  const createdDate = new Date(share.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-violet-600 selection:text-white">
      {/* Stripped-Down Minimal Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          {/* Brand & Set Identity */}
          <div className="flex items-center gap-3">
            <a
              href="/"
              title="Go to MTG Limited IQ Homepage"
              className="flex items-center gap-2 group hover:opacity-90 transition-opacity"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-violet-500/20 p-1.5">
                <PlaneswalkerSymbol className="w-full h-full text-white" />
              </div>
              <span className="text-sm font-black tracking-tight text-white hidden sm:inline">
                MTG LIMITED <span className="text-violet-400">IQ</span>
              </span>
            </a>

            <div className="h-4 w-px bg-slate-700/60 hidden sm:block" />

            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-slate-800 border border-slate-700/80 flex items-center justify-center p-1 text-slate-200">
                <SetSymbol setCode={share.setCode} size="xs" />
              </span>
              <div>
                <h1 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5 leading-none">
                  <span>{setInfo.name}</span>
                  <span className="text-xs font-mono font-bold text-violet-400 uppercase">({share.setCode})</span>
                </h1>
                <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                  <User className="w-3 h-3 text-slate-500" />
                  <span>Curated by <strong className="text-slate-200 font-medium">{share.authorName}</strong></span>
                  <span className="text-slate-600">•</span>
                  <Calendar className="w-3 h-3 text-slate-500" />
                  <span>{createdDate}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-all cursor-pointer"
              title="Copy share link to clipboard"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copiedUrl ? 'Copied Link!' : 'Copy Link'}</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-all cursor-pointer"
              title="Download evaluations as CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <a
              href={`/?set=${share.setCode}&tab=evaluation`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all shadow-md shadow-violet-600/30"
              title="Grade this set yourself on MTG Limited IQ"
            >
              <span>Grade Set</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Tier Summary & GPA Banner */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-[11px] font-mono tracking-wider uppercase text-slate-400">Total Graded</span>
              <span className="text-2xl font-black text-white">{summary.totalGraded} <span className="text-xs font-normal text-slate-500">cards</span></span>
            </div>

            <div className="h-8 w-px bg-slate-800" />

            <div className="flex flex-col">
              <span className="text-[11px] font-mono tracking-wider uppercase text-slate-400">Set GPA</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-violet-400">{summary.gpa.toFixed(2)}</span>
                <span className="text-xs font-mono text-slate-500">/ 4.0</span>
              </div>
            </div>
          </div>

          {/* Tier Curve Breakdown */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
              <span>A</span>
              <span className="font-mono text-[11px] bg-emerald-500/20 px-1.5 py-0.5 rounded text-emerald-300">{summary.distribution.A}</span>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold">
              <span>B</span>
              <span className="font-mono text-[11px] bg-blue-500/20 px-1.5 py-0.5 rounded text-blue-300">{summary.distribution.B}</span>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold">
              <span>C</span>
              <span className="font-mono text-[11px] bg-amber-500/20 px-1.5 py-0.5 rounded text-amber-300">{summary.distribution.C}</span>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold">
              <span>D</span>
              <span className="font-mono text-[11px] bg-orange-500/20 px-1.5 py-0.5 rounded text-orange-300">{summary.distribution.D}</span>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold">
              <span>F</span>
              <span className="font-mono text-[11px] bg-rose-500/20 px-1.5 py-0.5 rounded text-rose-300">{summary.distribution.F}</span>
            </div>
          </div>
        </div>

        {/* Filter and Control Bar */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search graded cards..."
              className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          {/* Color Filter */}
          <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-lg border border-slate-800">
            {['ALL', 'W', 'U', 'B', 'R', 'G', 'MULTI', 'COLORLESS'].map((col) => {
              const isActive = selectedColor === col;
              return (
                <button
                  key={col}
                  onClick={() => setSelectedColor(col)}
                  className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-violet-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {col === 'ALL' ? 'All' : col === 'MULTI' ? 'M' : col === 'COLORLESS' ? 'C' : col}
                </button>
              );
            })}
          </div>

          {/* Tier Filter */}
          <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-lg border border-slate-800">
            {['ALL', 'A', 'B', 'C', 'D', 'F'].map((tier) => {
              const isActive = selectedTier === tier;
              return (
                <button
                  key={tier}
                  onClick={() => setSelectedTier(tier)}
                  className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-violet-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {tier}
                </button>
              );
            })}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-slate-400">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-violet-500 cursor-pointer"
            >
              <option value="grade">Grade (Highest)</option>
              <option value="name">Card Name (A-Z)</option>
              <option value="collector">Collector Number</option>
            </select>
          </div>
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span>Showing <strong>{displayedGrades.length}</strong> of {summary.totalGraded} evaluations</span>
        </div>

        {/* Concise Stripped-Down Card List */}
        <div className="space-y-2">
          {displayedGrades.map(({ grade, card }) => {
            const gradeTier = grade.userGrade.charAt(0);
            const badgeColor =
              gradeTier === 'A'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : gradeTier === 'B'
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                : gradeTier === 'C'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : gradeTier === 'D'
                ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400';

            const artUrl =
              card?.image_uris?.art_crop ||
              card?.card_faces?.[0]?.image_uris?.art_crop ||
              card?.image_uris?.small;

            return (
              <div
                key={grade.cardName}
                onMouseEnter={() => card && setHoveredCard(card)}
                onMouseLeave={() => setHoveredCard(null)}
                className="bg-slate-900/70 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700/90 rounded-xl p-3 sm:p-3.5 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group"
              >
                {/* Left: Thumbnail & Card Identification */}
                <div className="flex items-center gap-3 min-w-0">
                  {artUrl ? (
                    <img
                      src={artUrl}
                      alt={grade.cardName}
                      className="w-11 h-11 rounded-lg object-cover border border-slate-700/80 shrink-0 shadow-sm"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-slate-500 text-xs font-mono">
                      #{card?.collector_number || '•'}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-white truncate group-hover:text-violet-300 transition-colors">
                        {grade.cardName}
                      </h3>
                      {card?.mana_cost && (
                        <span className="text-[11px] font-mono text-slate-400">
                          {card.mana_cost}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      {card?.type_line && <span className="truncate">{card.type_line}</span>}
                      {card?.rarity && (
                        <span className="capitalize text-slate-500 font-medium">• {card.rarity}</span>
                      )}
                      {grade.pickPriority && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-medium border border-slate-700/50">
                          {grade.pickPriority}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Grade & Notes */}
                <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                  {/* Notes callout if authorized */}
                  {grade.notes && (
                    <div className="max-w-xs text-[11px] text-slate-300 italic bg-slate-950/60 border border-slate-800/80 px-2.5 py-1.5 rounded-lg line-clamp-2">
                      "{grade.notes}"
                    </div>
                  )}

                  {/* Bold Grade Tier Badge */}
                  <div
                    className={`w-12 h-10 rounded-lg border flex flex-col items-center justify-center font-black ${badgeColor} shadow-sm`}
                  >
                    <span className="text-base leading-none tracking-tight">{grade.userGrade}</span>
                    <span className="text-[9px] font-mono font-medium opacity-80 mt-0.5">
                      {grade.userScore.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {displayedGrades.length === 0 && (
            <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-xl p-8 text-center space-y-2">
              <Filter className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-sm text-slate-400 font-medium">No graded cards match your filter criteria.</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedColor('ALL');
                  setSelectedTier('ALL');
                  setSelectedRarity('ALL');
                }}
                className="text-xs text-violet-400 hover:text-violet-300 font-semibold underline cursor-pointer"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>

        {/* Footer Conversion CTA */}
        <div className="mt-12 p-6 rounded-2xl bg-gradient-to-r from-violet-900/30 via-indigo-900/20 to-purple-900/30 border border-violet-800/30 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center text-white mx-auto shadow-lg shadow-violet-600/30 p-2">
            <PlaneswalkerSymbol className="w-full h-full text-white" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">Drafting {setInfo.name}?</h3>
            <p className="text-xs text-slate-400 max-w-lg mx-auto">
              Test your set mastery with dynamic quizzes, benchmark your evaluations against 17Lands win rates, and create your own tier list.
            </p>
          </div>
          <div>
            <a
              href={`/?set=${share.setCode}&tab=evaluation`}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs transition-all shadow-md shadow-violet-600/30"
            >
              <span>Grade {setInfo.name} Yourself</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </main>

      {/* Floating Card Art Preview on Desktop */}
      {hoveredCard && (
        <div className="fixed bottom-6 right-6 hidden lg:block z-50 pointer-events-none transition-all animate-in fade-in zoom-in-95 duration-150">
          <div className="w-60 rounded-xl overflow-hidden shadow-2xl border border-slate-700 bg-slate-900">
            <img
              src={hoveredCard.image_uris?.normal || hoveredCard.card_faces?.[0]?.image_uris?.normal}
              alt={hoveredCard.name}
              className="w-full h-auto object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
};
