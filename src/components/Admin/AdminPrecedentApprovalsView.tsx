import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ArrowRight,
  ArrowLeftRight,
  Download,
  Copy,
  Check,
  Search,
  Filter,
  RefreshCw,
  Layers,
  FileCode,
  AlertCircle,
  HelpCircle,
  User,
  Maximize2,
  ExternalLink,
  X,
  Eye,
} from 'lucide-react';
import { UserAccount } from '../../types/mtg';
import { PrecedentProposal, ProposalStatus } from '../../types/precedentApproval';
import {
  fetchPrecedentProposals,
  approvePrecedentProposal,
  rejectPrecedentProposal,
  exportCanonicalCompsJSON,
  subscribeToPrecedentProposals,
} from '../../services/precedentApprovalService';
import { POPULAR_LIMITED_SETS } from '../../services/scryfall';
import { get17LandsCardUrl } from '../../services/seventeenLands';
import { getActiveUser } from '../../services/storage';
import { CardImage } from '../UI/CardImage';
import { ManaCostRenderer } from '../UI/ManaSymbol';
import { SetBadge } from '../UI/SetSymbol';

interface AdminPrecedentApprovalsViewProps {
  currentUser: UserAccount | null;
  onPendingCountChange?: (count: number) => void;
}

export const AdminPrecedentApprovalsView: React.FC<AdminPrecedentApprovalsViewProps> = ({
  currentUser,
  onPendingCountChange,
}) => {
  const [proposals, setProposals] = useState<PrecedentProposal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | 'all'>('pending');
  const [selectedSet, setSelectedSet] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [copiedExport, setCopiedExport] = useState<boolean>(false);
  const [rejectionModalProposal, setRejectionModalProposal] = useState<PrecedentProposal | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [selectedComparisonProposal, setSelectedComparisonProposal] = useState<PrecedentProposal | null>(null);
  const [globalPendingCount, setGlobalPendingCount] = useState<number>(0);
  const [totalProposalsCount, setTotalProposalsCount] = useState<number>(0);
  const [toastNotification, setToastNotification] = useState<{
    title: string;
    subtitle: string;
    actionSetFilter?: ProposalStatus;
  } | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedComparisonProposal) setSelectedComparisonProposal(null);
        else if (rejectionModalProposal) setRejectionModalProposal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedComparisonProposal, rejectionModalProposal]);

  const loadProposals = useCallback(async () => {
    setLoading(true);
    try {
      const [filteredData, pendingData, allData] = await Promise.all([
        fetchPrecedentProposals({
          status: statusFilter,
          setCode: selectedSet,
          search: searchQuery,
        }),
        fetchPrecedentProposals({ status: 'pending' }),
        fetchPrecedentProposals({ status: 'all' }),
      ]);

      setProposals(filteredData);
      setGlobalPendingCount(pendingData.length);
      setTotalProposalsCount(allData.length);
      onPendingCountChange?.(pendingData.length);
    } catch (err) {
      console.error('Failed to load precedent proposals:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, selectedSet, searchQuery, onPendingCountChange]);

  useEffect(() => {
    loadProposals();
  }, [loadProposals]);

  // Real-time synchronization
  useEffect(() => {
    const unsub = subscribeToPrecedentProposals(() => {
      loadProposals();
    });
    return unsub;
  }, [loadProposals]);

  const handleApprove = async (proposal: PrecedentProposal) => {
    const adminUser = currentUser || getActiveUser() || {
      id: 'admin_owner_01',
      name: 'Admin',
      email: 'admin@limited-iq.local',
      avatarColor: 'emerald',
      isAdmin: true,
      provider: 'local',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    setProcessingId(proposal.id);
    try {
      await approvePrecedentProposal(proposal.id, adminUser);
      await loadProposals();
      setToastNotification({
        title: `Precedent Approved: ${proposal.targetCard.name} ↔ ${proposal.chosenComp.name}`,
        subtitle: `Registered into global canonical memory by ${adminUser.name}.`,
        actionSetFilter: 'approved',
      });
      setTimeout(() => setToastNotification(null), 8000);
    } catch (err) {
      console.error('Failed to approve proposal:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectionModalProposal) return;
    const adminUser = currentUser || getActiveUser() || {
      id: 'admin_owner_01',
      name: 'Admin',
      email: 'admin@limited-iq.local',
      avatarColor: 'emerald',
      isAdmin: true,
      provider: 'local',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    const targetCardName = rejectionModalProposal.targetCard.name;
    setProcessingId(rejectionModalProposal.id);
    try {
      await rejectPrecedentProposal(rejectionModalProposal.id, adminUser, rejectionReason);
      setToastNotification({
        title: `Proposal Rejected for ${targetCardName}`,
        subtitle: `Proposal was flagged as rejected and will not be adopted as precedent.`,
        actionSetFilter: 'rejected',
      });
      setTimeout(() => setToastNotification(null), 8000);
      setRejectionModalProposal(null);
      setRejectionReason('');
      await loadProposals();
    } catch (err) {
      console.error('Failed to reject proposal:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleExportJSON = () => {
    const jsonStr = exportCanonicalCompsJSON();
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(jsonStr);
      }
      // Also download as file
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `canonicalComps_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setCopiedExport(true);
      setTimeout(() => setCopiedExport(false), 2500);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Summary Toolbar */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#17181c] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-cyan-400">
                <Sparkles className="w-5 h-5" />
              </span>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-heading">
                Precedent Learning &amp; Comp Approvals
              </h2>
              {globalPendingCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300/60 animate-pulse">
                  {globalPendingCount} Pending Review
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed">
              When users swap comparable cards during grading, their proposed precedents are submitted here with complete reference context. Approving a proposal trains the global similarity engine to adopt that comp across the entire site.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              type="button"
              onClick={handleExportJSON}
              className="px-3.5 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300/80 dark:border-slate-700 shadow-xs"
              title="Download canonicalComps.json and copy to clipboard for Git commitment"
            >
              {copiedExport ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400">Exported &amp; Copied!</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-violet-500" />
                  <span>Export Canonical Comps (JSON)</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={loadProposals}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer border border-slate-300/80 dark:border-slate-700"
              title="Refresh proposals"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-violet-500' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
          {/* Status Segmented Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#090a0d] rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold">
            {(['pending', 'approved', 'rejected', 'all'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg capitalize transition-all cursor-pointer ${
                  statusFilter === status
                    ? 'bg-white dark:bg-violet-600 text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-lg">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search card name, comp, or user..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>

            {/* Set Filter Dropdown */}
            <select
              value={selectedSet}
              onChange={(e) => setSelectedSet(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer"
            >
              <option value="ALL">All Sets</option>
              {POPULAR_LIMITED_SETS.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code.toUpperCase()} — {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Toast Notification Banner */}
      {toastNotification && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <div className="font-bold text-xs sm:text-sm">{toastNotification.title}</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">{toastNotification.subtitle}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {toastNotification.actionSetFilter && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter(toastNotification.actionSetFilter!);
                  setToastNotification(null);
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs transition-colors cursor-pointer shadow-xs whitespace-nowrap"
              >
                View in {toastNotification.actionSetFilter.toUpperCase()}
              </button>
            )}
            <button
              type="button"
              onClick={() => setToastNotification(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Proposals List */}
      {loading ? (
        <div className="p-12 text-center space-y-3 rounded-3xl bg-white dark:bg-[#17181c] border border-slate-200 dark:border-slate-800">
          <RefreshCw className="w-8 h-8 text-violet-500 animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading precedent proposals...</p>
        </div>
      ) : proposals.length === 0 ? (
        <div className="p-12 text-center space-y-4 rounded-3xl bg-white dark:bg-[#17181c] border border-slate-200 dark:border-slate-800">
          <CheckCircle2 className="w-10 h-10 text-emerald-500/80 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Proposals Found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              {statusFilter === 'pending'
                ? 'All precedent proposals have been reviewed! New proposals submitted by users will appear here automatically in real time.'
                : `No proposals match the current status filter "${statusFilter}".`}
            </p>
          </div>

          {statusFilter === 'pending' && totalProposalsCount > 0 && (
            <div className="flex items-center justify-center gap-2.5 pt-2 flex-wrap">
              <button
                type="button"
                onClick={() => setStatusFilter('approved')}
                className="px-4 py-2 rounded-xl text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-300/80 dark:border-emerald-800/60 transition-colors cursor-pointer shadow-xs"
              >
                View Approved History
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className="px-4 py-2 rounded-xl text-xs font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              >
                View All Proposals ({totalProposalsCount})
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {proposals.map((proposal) => {
            const isProcessing = processingId === proposal.id;
            const target = proposal.targetCard;
            const oldComp = proposal.originalComp;
            const newComp = proposal.chosenComp;

            return (
              <div
                key={proposal.id}
                className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#17181c] border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
              >
                {/* Proposal Meta Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-950/80 text-violet-700 dark:text-cyan-300 flex items-center justify-center font-bold text-xs uppercase border border-violet-200 dark:border-violet-800/60">
                      {proposal.submittedBy.userName.slice(0, 1)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {proposal.submittedBy.userName}
                        </span>
                        {proposal.submittedBy.isAdmin && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300/60">
                            Admin
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400 font-mono">
                          • {new Date(proposal.submittedAt).toLocaleDateString()} at{' '}
                          {new Date(proposal.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Proposed swap for Slot #{proposal.slotIndex + 1}
                      </p>
                    </div>
                  </div>

                  {/* Action & Status */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setSelectedComparisonProposal(proposal)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                      title="Inspect all cards side-by-side"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                      <span>Compare Side-by-Side</span>
                    </button>

                    {proposal.status === 'pending' && (
                      <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        <span>Pending Review</span>
                      </span>
                    )}
                    {proposal.status === 'approved' && (
                      <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Approved by {proposal.reviewedBy?.adminName || 'Admin'}</span>
                      </span>
                    )}
                    {proposal.status === 'rejected' && (
                      <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700/60 flex items-center gap-1.5">
                        <XCircle className="w-3.5 h-3.5 text-rose-500" />
                        <span>Rejected</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* 3-Column Context Grid (Target Reference, Old Comp, Proposed Replacement) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 1. Target Card (Reference) */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#090a0d] border border-slate-200 dark:border-slate-800 space-y-3 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-violet-700 dark:text-cyan-300 px-2 py-0.5 rounded bg-violet-100 dark:bg-violet-950/80 border border-violet-200 dark:border-violet-800/60">
                          Target Card (Ref)
                        </span>
                        <SetBadge setCode={target.set} size="xs" />
                      </div>

                      {/* Card Image */}
                      <button
                        type="button"
                        onClick={() => setSelectedComparisonProposal(proposal)}
                        className="relative w-full aspect-[2.5/3.5] max-h-56 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-[#17181c] shadow-xs group/img cursor-pointer hover:ring-2 hover:ring-violet-400 dark:hover:ring-cyan-400 transition-all flex items-center justify-center block text-left"
                        title={`Click to inspect ${target.name} side-by-side`}
                      >
                        <CardImage
                          card={{
                            id: target.id,
                            name: target.name,
                            set: target.set,
                            mana_cost: target.manaCost,
                            type_line: target.typeLine,
                            oracle_text: target.oracleText,
                            power: target.power,
                            toughness: target.toughness,
                            colors: target.colors as any,
                            rarity: target.rarity as any,
                          }}
                          alt={target.name}
                          className="w-full h-full"
                          imageClassName="w-full h-full object-contain group-hover/img:scale-105 transition-transform duration-200 pointer-events-none"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-slate-950/0 group-hover/img:bg-slate-950/40 transition-colors flex items-center justify-center pointer-events-none">
                          <span className="opacity-0 group-hover/img:opacity-100 transition-opacity bg-slate-900/90 text-white text-[10px] font-mono font-bold px-2 py-1 rounded-lg border border-slate-700 shadow-md flex items-center gap-1">
                            <Maximize2 className="w-3 h-3 text-cyan-300" />
                            <span>Inspect Side-by-Side</span>
                          </span>
                        </div>
                      </button>

                      <div>
                        <div className="flex items-baseline justify-between gap-1">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                            {target.name}
                          </h4>
                          {target.manaCost && (
                            <div className="shrink-0 scale-90 origin-right">
                              <ManaCostRenderer manaCost={target.manaCost} />
                            </div>
                          )}
                        </div>
                        <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          {target.typeLine} {target.power !== undefined && target.toughness !== undefined ? `• ${target.power}/${target.toughness}` : ''}
                        </p>
                      </div>

                      {target.oracleText && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 italic font-serif leading-relaxed line-clamp-3 bg-white/60 dark:bg-slate-900/60 p-2 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
                          "{target.oracleText}"
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-[11px] font-mono">
                      {target.tierGrade && (
                        <span className="px-2 py-0.5 rounded bg-amber-100/80 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800/50">
                          Tier: {target.tierGrade}
                        </span>
                      )}
                      {typeof target.winRate === 'number' && (
                        <a
                          href={get17LandsCardUrl(target.set, target)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1"
                          title="View on 17Lands"
                        >
                          <span>WR: {(target.winRate * 100).toFixed(1)}%</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* 2. Old Replaced Comp */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#090a0d] border border-slate-200 dark:border-slate-800 space-y-3 flex flex-col justify-between opacity-85">
                    {oldComp ? (
                      <>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
                              Replaced Comp
                            </span>
                            <SetBadge setCode={oldComp.set} size="xs" />
                          </div>

                          {/* Card Image */}
                          <button
                            type="button"
                            onClick={() => setSelectedComparisonProposal(proposal)}
                            className="relative w-full aspect-[2.5/3.5] max-h-56 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-[#17181c] shadow-xs group/img cursor-pointer hover:ring-2 hover:ring-slate-400 dark:hover:ring-slate-500 transition-all flex items-center justify-center block text-left"
                            title={`Click to inspect ${oldComp.name} side-by-side`}
                          >
                            <CardImage
                              card={{
                                id: oldComp.id,
                                name: oldComp.name,
                                set: oldComp.set,
                                mana_cost: oldComp.manaCost,
                                type_line: oldComp.typeLine,
                                oracle_text: oldComp.oracleText,
                                power: oldComp.power,
                                toughness: oldComp.toughness,
                                colors: oldComp.colors as any,
                                rarity: oldComp.rarity as any,
                              }}
                              alt={oldComp.name}
                              className="w-full h-full"
                              imageClassName="w-full h-full object-contain group-hover/img:scale-105 transition-transform duration-200 pointer-events-none"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-slate-950/0 group-hover/img:bg-slate-950/40 transition-colors flex items-center justify-center pointer-events-none">
                              <span className="opacity-0 group-hover/img:opacity-100 transition-opacity bg-slate-900/90 text-white text-[10px] font-mono font-bold px-2 py-1 rounded-lg border border-slate-700 shadow-md flex items-center gap-1">
                                <Maximize2 className="w-3 h-3 text-cyan-300" />
                                <span>Inspect Side-by-Side</span>
                              </span>
                            </div>
                          </button>

                          <div>
                            <div className="flex items-baseline justify-between gap-1">
                              <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                                {oldComp.name}
                              </h4>
                              {oldComp.manaCost && (
                                <div className="shrink-0 scale-90 origin-right">
                                  <ManaCostRenderer manaCost={oldComp.manaCost} />
                                </div>
                              )}
                            </div>
                            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                              {oldComp.typeLine} {oldComp.power !== undefined && oldComp.toughness !== undefined ? `• ${oldComp.power}/${oldComp.toughness}` : ''}
                            </p>
                          </div>

                          {oldComp.oracleText && (
                            <p className="text-xs text-slate-600 dark:text-slate-300 italic font-serif leading-relaxed line-clamp-3 bg-white/60 dark:bg-slate-900/60 p-2 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
                              "{oldComp.oracleText}"
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[11px] font-mono pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                          <span className="text-slate-500 dark:text-slate-400">
                            Score: {oldComp.similarityScore}%
                          </span>
                          {oldComp.tierGrade && (
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              Tier {oldComp.tierGrade}
                            </span>
                          )}
                          {typeof oldComp.winRate === 'number' && (
                            <a
                              href={get17LandsCardUrl(oldComp.set, oldComp)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1"
                              title="View on 17Lands"
                            >
                              <span>{(oldComp.winRate * 100).toFixed(1)}%</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center flex-1 py-10 text-center space-y-2">
                        <span className="text-xs text-slate-400 italic">No previous card in this slot</span>
                      </div>
                    )}
                  </div>

                  {/* 3. Proposed Replacement Comp */}
                  <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border-2 border-emerald-300/80 dark:border-emerald-600/60 space-y-3 flex flex-col justify-between shadow-sm">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700">
                          Proposed Replacement
                        </span>
                        <SetBadge setCode={newComp.set} size="xs" />
                      </div>

                      {/* Card Image */}
                      <button
                        type="button"
                        onClick={() => setSelectedComparisonProposal(proposal)}
                        className="relative w-full aspect-[2.5/3.5] max-h-56 rounded-xl overflow-hidden border-2 border-emerald-400/80 dark:border-emerald-500/80 bg-[#17181c] shadow-xs group/img cursor-pointer hover:ring-2 hover:ring-emerald-400 transition-all flex items-center justify-center block text-left"
                        title={`Click to inspect ${newComp.name} side-by-side`}
                      >
                        <CardImage
                          card={{
                            id: newComp.id,
                            name: newComp.name,
                            set: newComp.set,
                            mana_cost: newComp.manaCost,
                            type_line: newComp.typeLine,
                            oracle_text: newComp.oracleText,
                            power: newComp.power,
                            toughness: newComp.toughness,
                            colors: newComp.colors as any,
                            rarity: newComp.rarity as any,
                          }}
                          alt={newComp.name}
                          className="w-full h-full"
                          imageClassName="w-full h-full object-contain group-hover/img:scale-105 transition-transform duration-200 pointer-events-none"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-slate-950/0 group-hover/img:bg-slate-950/40 transition-colors flex items-center justify-center pointer-events-none">
                          <span className="opacity-0 group-hover/img:opacity-100 transition-opacity bg-slate-900/90 text-white text-[10px] font-mono font-bold px-2 py-1 rounded-lg border border-slate-700 shadow-md flex items-center gap-1">
                            <Maximize2 className="w-3 h-3 text-emerald-400" />
                            <span>Inspect Side-by-Side</span>
                          </span>
                        </div>
                      </button>

                      <div>
                        <div className="flex items-baseline justify-between gap-1">
                          <h4 className="font-bold text-sm text-emerald-900 dark:text-emerald-200 leading-tight">
                            {newComp.name}
                          </h4>
                          {newComp.manaCost && (
                            <div className="shrink-0 scale-90 origin-right">
                              <ManaCostRenderer manaCost={newComp.manaCost} />
                            </div>
                          )}
                        </div>
                        <p className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                          {newComp.typeLine} {newComp.power !== undefined && newComp.toughness !== undefined ? `• ${newComp.power}/${newComp.toughness}` : ''}
                        </p>
                      </div>

                      {newComp.oracleText && (
                        <p className="text-xs text-slate-700 dark:text-slate-200 italic font-serif leading-relaxed line-clamp-3 bg-white/80 dark:bg-[#020512] p-2 rounded-xl border border-emerald-200 dark:border-emerald-800/40">
                          "{newComp.oracleText}"
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono pt-2 border-t border-emerald-200/80 dark:border-emerald-800/80">
                      <span className="px-2 py-0.5 rounded bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-bold">
                        Score: {newComp.similarityScore}%
                      </span>
                      {newComp.tierGrade && (
                        <span className="font-bold text-emerald-800 dark:text-emerald-300">
                          Tier: {newComp.tierGrade}
                        </span>
                      )}
                      {typeof newComp.winRate === 'number' && (
                        <a
                          href={get17LandsCardUrl(newComp.set, newComp)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-emerald-700 dark:text-emerald-300 font-bold hover:underline flex items-center gap-1"
                          title="View on 17Lands"
                        >
                          <span>{(newComp.winRate * 100).toFixed(1)}%</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Inferred Insights & Bridge Section */}
                {(proposal.inferredInsights.length > 0 || proposal.mechanicBridge) && (
                  <div className="p-3.5 rounded-2xl bg-violet-50/70 dark:bg-[#17181c] border border-violet-200/80 dark:border-violet-900/50 space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5 font-bold font-mono text-violet-800 dark:text-cyan-300 text-[11px]">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>Learned Delta &amp; Heuristic Insights</span>
                    </div>
                    <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-1 text-[11px] leading-relaxed">
                      {proposal.inferredInsights.map((insight, idx) => (
                        <li key={idx}>{insight}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Reviewer Notes (if rejected or approved with note) */}
                {proposal.reviewedBy?.notes && (
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300">Review Note: </span>
                    <span className="text-slate-600 dark:text-slate-400 italic">"{proposal.reviewedBy.notes}"</span>
                  </div>
                )}

                {/* Action Bar (Only for Pending proposals) */}
                {proposal.status === 'pending' && (
                  <div className="flex items-center justify-end gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setRejectionModalProposal(proposal)}
                      disabled={isProcessing}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-300/80 dark:border-rose-800/60 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Reject Proposal
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApprove(proposal)}
                      disabled={isProcessing}
                      className="px-4 py-1.5 rounded-xl text-xs font-mono font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isProcessing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Approving...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Approve for Global Learning</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Side-by-Side Comparison Modal */}
      {selectedComparisonProposal && (() => {
        const prop = selectedComparisonProposal;
        const target = prop.targetCard;
        const oldComp = prop.originalComp;
        const newComp = prop.chosenComp;
        const isPending = prop.status === 'pending';
        const isBusy = processingId === prop.id;

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
            onClick={() => setSelectedComparisonProposal(null)}
          >
            <div
              className="relative w-full max-w-6xl max-h-[92vh] flex flex-col bg-white dark:bg-[#121316] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#17181c]/90">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-cyan-400">
                    <ArrowLeftRight className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white font-heading">
                        Side-by-Side Precedent Comparison
                      </h3>
                      <span
                        className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          prop.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700'
                            : prop.status === 'rejected'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-300 dark:border-rose-700'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-300 dark:border-amber-700'
                        }`}
                      >
                        {prop.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Comparing proposed precedent swap for{' '}
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {target.name}
                      </span>{' '}
                      ({target.set}) • Slot #{prop.slotIndex + 1} • Submitted by{' '}
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {prop.submittedBy.userName}
                      </span>{' '}
                      on {new Date(prop.submittedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedComparisonProposal(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Close modal (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                {/* 3-Column or 2-Column Side-by-Side Card Comparison Grid */}
                <div
                  className={`grid grid-cols-1 ${
                    oldComp ? 'md:grid-cols-3' : 'md:grid-cols-2'
                  } gap-4 sm:gap-6 items-stretch`}
                >
                  {/* Column 1: Target Reference Card */}
                  <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-[#17181c] border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-3">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
                          Target Reference Card
                        </span>
                        <SetBadge setCode={target.set} size="xs" />
                      </div>

                      <div className="relative w-full aspect-[2.5/3.5] max-h-72 sm:max-h-84 rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 bg-[#17181c] shadow-md flex items-center justify-center">
                        <CardImage
                          card={{
                            id: target.id,
                            name: target.name,
                            set: target.set,
                            mana_cost: target.manaCost,
                            type_line: target.typeLine,
                            oracle_text: target.oracleText,
                            power: target.power,
                            toughness: target.toughness,
                            colors: target.colors as any,
                            rarity: target.rarity as any,
                          }}
                          alt={target.name}
                          className="w-full h-full"
                          imageClassName="w-full h-full object-contain"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-1">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white font-heading">
                            {target.name}
                          </h4>
                          {target.manaCost && (
                            <ManaCostRenderer manaCost={target.manaCost} size="xs" />
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                          <span>{target.typeLine || 'Card'}</span>
                          {target.power && target.toughness && (
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                              {target.power}/{target.toughness}
                            </span>
                          )}
                        </div>
                      </div>

                      {target.oracleText && (
                        <div className="text-xs text-slate-700 dark:text-slate-200 italic font-serif leading-relaxed bg-white/70 dark:bg-slate-900/70 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/60 whitespace-pre-line max-h-40 overflow-y-auto">
                          "{target.oracleText}"
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono pt-3 border-t border-slate-200 dark:border-slate-800">
                      <span className="text-slate-500">Ref Card</span>
                      {target.tierGrade && (
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          Tier {target.tierGrade}
                        </span>
                      )}
                      {typeof target.winRate === 'number' && (
                        <a
                          href={get17LandsCardUrl(target.set, target)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1"
                          title="View on 17Lands"
                        >
                          <span>{(target.winRate * 100).toFixed(1)}% WR</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Column 2: Replaced Precedent (Original) */}
                  {oldComp ? (
                    <div className="p-4 rounded-2xl bg-amber-50/40 dark:bg-amber-950/10 border border-amber-200/80 dark:border-amber-900/40 flex flex-col justify-between space-y-3">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400 px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60">
                            Replaced Precedent (Original)
                          </span>
                          <SetBadge setCode={oldComp.set} size="xs" />
                        </div>

                        <div className="relative w-full aspect-[2.5/3.5] max-h-72 sm:max-h-84 rounded-xl overflow-hidden border border-amber-300/80 dark:border-amber-800/60 bg-[#17181c] shadow-md flex items-center justify-center">
                          <CardImage
                            card={{
                              id: oldComp.id,
                              name: oldComp.name,
                              set: oldComp.set,
                              mana_cost: oldComp.manaCost,
                              type_line: oldComp.typeLine,
                              oracle_text: oldComp.oracleText,
                              power: oldComp.power,
                              toughness: oldComp.toughness,
                              colors: oldComp.colors as any,
                              rarity: oldComp.rarity as any,
                            }}
                            alt={oldComp.name}
                            className="w-full h-full"
                            imageClassName="w-full h-full object-contain"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-start justify-between gap-1">
                            <h4 className="font-bold text-sm text-slate-900 dark:text-white font-heading">
                              {oldComp.name}
                            </h4>
                            {oldComp.manaCost && (
                              <ManaCostRenderer manaCost={oldComp.manaCost} size="xs" />
                            )}
                          </div>
                          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                            <span>{oldComp.typeLine || 'Card'}</span>
                            {oldComp.power && oldComp.toughness && (
                              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                                {oldComp.power}/{oldComp.toughness}
                              </span>
                            )}
                          </div>
                        </div>

                        {oldComp.oracleText && (
                          <div className="text-xs text-slate-700 dark:text-slate-200 italic font-serif leading-relaxed bg-white/70 dark:bg-slate-900/70 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/60 whitespace-pre-line max-h-40 overflow-y-auto">
                            "{oldComp.oracleText}"
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs font-mono pt-3 border-t border-slate-200 dark:border-slate-800">
                        <span className="text-slate-500">
                          Score: {oldComp.similarityScore}%
                        </span>
                        {oldComp.tierGrade && (
                          <span className="font-bold text-slate-700 dark:text-slate-300">
                            Tier {oldComp.tierGrade}
                          </span>
                        )}
                        {typeof oldComp.winRate === 'number' && (
                          <a
                            href={get17LandsCardUrl(oldComp.set, oldComp)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1"
                            title="View on 17Lands"
                          >
                            <span>{(oldComp.winRate * 100).toFixed(1)}% WR</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {/* Column 3: Proposed Replacement Comp (New) */}
                  <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border-2 border-emerald-500/80 dark:border-emerald-500/70 shadow-lg shadow-emerald-500/5 flex flex-col justify-between space-y-3">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700">
                          Proposed Replacement (New Comp)
                        </span>
                        <SetBadge setCode={newComp.set} size="xs" />
                      </div>

                      <div className="relative w-full aspect-[2.5/3.5] max-h-72 sm:max-h-84 rounded-xl overflow-hidden border-2 border-emerald-400 dark:border-emerald-500 bg-[#17181c] shadow-md flex items-center justify-center">
                        <CardImage
                          card={{
                            id: newComp.id,
                            name: newComp.name,
                            set: newComp.set,
                            mana_cost: newComp.manaCost,
                            type_line: newComp.typeLine,
                            oracle_text: newComp.oracleText,
                            power: newComp.power,
                            toughness: newComp.toughness,
                            colors: newComp.colors as any,
                            rarity: newComp.rarity as any,
                          }}
                          alt={newComp.name}
                          className="w-full h-full"
                          imageClassName="w-full h-full object-contain"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-1">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white font-heading">
                            {newComp.name}
                          </h4>
                          {newComp.manaCost && (
                            <ManaCostRenderer manaCost={newComp.manaCost} size="xs" />
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                          <span>{newComp.typeLine || 'Card'}</span>
                          {newComp.power && newComp.toughness && (
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                              {newComp.power}/{newComp.toughness}
                            </span>
                          )}
                        </div>
                      </div>

                      {newComp.oracleText && (
                        <div className="text-xs text-slate-700 dark:text-slate-200 italic font-serif leading-relaxed bg-white/70 dark:bg-slate-900/70 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/60 whitespace-pre-line max-h-40 overflow-y-auto">
                          "{newComp.oracleText}"
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono pt-3 border-t border-slate-200 dark:border-slate-800">
                      <span className="text-slate-500">
                        Score: {newComp.similarityScore}%
                      </span>
                      {newComp.tierGrade && (
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          Tier {newComp.tierGrade}
                        </span>
                      )}
                      {typeof newComp.winRate === 'number' && (
                        <a
                          href={get17LandsCardUrl(newComp.set, newComp)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1"
                          title="View on 17Lands"
                        >
                          <span>{(newComp.winRate * 100).toFixed(1)}% WR</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Comparative Engine Analysis Strip */}
                <div className="p-4 rounded-2xl bg-violet-50/70 dark:bg-[#17181c] border border-violet-200/80 dark:border-violet-900/50 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 font-bold font-mono text-violet-800 dark:text-cyan-300 text-xs">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span>Comparative Engine Analysis &amp; Inferred Insights</span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] font-mono">
                      <span className="px-2 py-0.5 rounded bg-violet-100 dark:bg-violet-950/80 text-violet-700 dark:text-cyan-300 border border-violet-200 dark:border-violet-800/60">
                        CMC Delta:{' '}
                        {prop.cmcDelta > 0
                          ? `+${prop.cmcDelta}`
                          : prop.cmcDelta < 0
                          ? `${prop.cmcDelta}`
                          : '0 (Matched)'}
                      </span>
                      {prop.speedShift && prop.speedShift !== 'matched' && (
                        <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                          Speed: {prop.speedShift.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {prop.mechanicBridge && (
                      <div className="p-3 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 space-y-1">
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          Mechanic Bridge:
                        </span>
                        <p className="text-slate-600 dark:text-slate-400">{prop.mechanicBridge}</p>
                      </div>
                    )}
                    {prop.reviewedBy?.notes && (
                      <div className="p-3 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 space-y-1">
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          Reviewer Note:
                        </span>
                        <p className="text-slate-600 dark:text-slate-400 italic">
                          "{prop.reviewedBy.notes}"
                        </p>
                      </div>
                    )}
                  </div>

                  {prop.inferredInsights.length > 0 && (
                    <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-1 text-xs leading-relaxed">
                      {prop.inferredInsights.map((insight, idx) => (
                        <li key={idx}>{insight}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Modal Footer with Actions */}
              <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#17181c]/70 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-left">
                  {isPending
                    ? 'Review side-by-side cards carefully before approving this precedent into global memory.'
                    : `This proposal was already ${prop.status}.`}
                </span>

                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedComparisonProposal(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    Close
                  </button>

                  {isPending && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const toReject = prop;
                          setSelectedComparisonProposal(null);
                          setRejectionModalProposal(toReject);
                        }}
                        disabled={isBusy}
                        className="px-4 py-2 rounded-xl text-xs font-mono font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-300/80 dark:border-rose-800/60 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Reject Proposal
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          const toApprove = prop;
                          setSelectedComparisonProposal(null);
                          await handleApprove(toApprove);
                        }}
                        disabled={isBusy}
                        className="px-5 py-2 rounded-xl text-xs font-mono font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {isBusy ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Approving...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Approve for Global Learning</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Reject Modal */}
      {rejectionModalProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-[#17181c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-5 h-5" />
              <h3 className="font-bold text-base text-slate-900 dark:text-white font-heading">
                Reject Precedent Proposal
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Rejecting this proposal will prevent it from becoming a global precedent for{' '}
              <span className="font-bold text-slate-900 dark:text-white">
                {rejectionModalProposal.targetCard.name}
              </span>
              . Optionally provide a reason for the record.
            </p>

            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Mana rate is too divergent, mechanics do not translate cleanly..."
              rows={3}
              className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectionModalProposal(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="px-4 py-1.5 rounded-xl text-xs font-mono font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors cursor-pointer shadow-xs"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
