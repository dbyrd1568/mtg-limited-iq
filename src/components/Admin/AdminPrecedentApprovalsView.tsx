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
} from 'lucide-react';
import { UserAccount } from '../../types/mtg';
import { PrecedentProposal, ProposalStatus } from '../../types/precedentApproval';
import {
  fetchPrecedentProposals,
  approvePrecedentProposal,
  rejectPrecedentProposal,
  exportCanonicalCompsJSON,
} from '../../services/precedentApprovalService';
import { POPULAR_LIMITED_SETS } from '../../services/scryfall';
import { ManaCostRenderer } from '../UI/ManaSymbol';
import { SetBadge } from '../UI/SetSymbol';

interface AdminPrecedentApprovalsViewProps {
  currentUser: UserAccount | null;
}

export const AdminPrecedentApprovalsView: React.FC<AdminPrecedentApprovalsViewProps> = ({
  currentUser,
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

  const loadProposals = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPrecedentProposals({
        status: statusFilter,
        setCode: selectedSet,
        search: searchQuery,
      });
      setProposals(data);
    } catch (err) {
      console.error('Failed to load precedent proposals:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, selectedSet, searchQuery]);

  useEffect(() => {
    loadProposals();
  }, [loadProposals]);

  const pendingCount = useMemo(() => {
    return proposals.filter((p) => p.status === 'pending').length;
  }, [proposals]);

  const handleApprove = async (proposal: PrecedentProposal) => {
    if (!currentUser) return;
    setProcessingId(proposal.id);
    try {
      await approvePrecedentProposal(proposal.id, currentUser);
      await loadProposals();
    } catch (err) {
      console.error('Failed to approve proposal:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectionModalProposal || !currentUser) return;
    setProcessingId(rejectionModalProposal.id);
    try {
      await rejectPrecedentProposal(rejectionModalProposal.id, currentUser, rejectionReason);
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
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#060a1d] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-cyan-400">
                <Sparkles className="w-5 h-5" />
              </span>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-heading">
                Precedent Learning &amp; Comp Approvals
              </h2>
              {pendingCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300/60 animate-pulse">
                  {pendingCount} Pending Review
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
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#040714] rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold">
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

      {/* Proposals List */}
      {loading ? (
        <div className="p-12 text-center space-y-3 rounded-3xl bg-white dark:bg-[#060a1d] border border-slate-200 dark:border-slate-800">
          <RefreshCw className="w-8 h-8 text-violet-500 animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading precedent proposals...</p>
        </div>
      ) : proposals.length === 0 ? (
        <div className="p-12 text-center space-y-3 rounded-3xl bg-white dark:bg-[#060a1d] border border-slate-200 dark:border-slate-800">
          <CheckCircle2 className="w-10 h-10 text-emerald-500/80 mx-auto" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Proposals Found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {statusFilter === 'pending'
              ? 'All precedent proposals have been reviewed! New proposals submitted by users will appear here automatically.'
              : `No proposals match the current status filter "${statusFilter}".`}
          </p>
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
                className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#060a1d] border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
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

                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
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
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#030612] border border-slate-200 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-violet-700 dark:text-cyan-300 px-2 py-0.5 rounded bg-violet-100 dark:bg-violet-950/80 border border-violet-200 dark:border-violet-800/60">
                        Target Card (Ref)
                      </span>
                      <SetBadge setCode={target.set} size="xs" />
                    </div>

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

                    <div className="flex items-center gap-2 pt-1 text-[11px] font-mono">
                      {target.tierGrade && (
                        <span className="px-2 py-0.5 rounded bg-amber-100/80 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800/50">
                          Tier: {target.tierGrade}
                        </span>
                      )}
                      {typeof target.winRate === 'number' && (
                        <span className="text-slate-500 dark:text-slate-400">
                          WR: {(target.winRate * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 2. Old Replaced Comp */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#030612] border border-slate-200 dark:border-slate-800 space-y-2.5 opacity-80">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
                        Replaced Comp
                      </span>
                      {oldComp && <SetBadge setCode={oldComp.set} size="xs" />}
                    </div>

                    {oldComp ? (
                      <>
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

                        <div className="flex items-center justify-between text-[11px] font-mono pt-1">
                          <span className="text-slate-500 dark:text-slate-400">
                            Score: {oldComp.similarityScore}%
                          </span>
                          {oldComp.tierGrade && (
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              Tier {oldComp.tierGrade}
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-slate-400 italic pt-4">No previous card in this slot</p>
                    )}
                  </div>

                  {/* 3. Proposed Replacement Comp */}
                  <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border-2 border-emerald-300/80 dark:border-emerald-600/60 space-y-2.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700">
                        Proposed Replacement
                      </span>
                      <SetBadge setCode={newComp.set} size="xs" />
                    </div>

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

                    <div className="flex items-center justify-between text-[11px] font-mono pt-1">
                      <span className="px-2 py-0.5 rounded bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-bold">
                        Score: {newComp.similarityScore}%
                      </span>
                      {newComp.tierGrade && (
                        <span className="font-bold text-emerald-800 dark:text-emerald-300">
                          Tier: {newComp.tierGrade} ({newComp.winRate ? `${(newComp.winRate * 100).toFixed(1)}%` : ''})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Inferred Insights & Bridge Section */}
                {(proposal.inferredInsights.length > 0 || proposal.mechanicBridge) && (
                  <div className="p-3.5 rounded-2xl bg-violet-50/70 dark:bg-[#04081c] border border-violet-200/80 dark:border-violet-900/50 space-y-1.5 text-xs">
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
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approve for Global Learning</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Modal */}
      {rejectionModalProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-[#070b1e] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
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
