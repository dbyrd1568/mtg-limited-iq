import React, { useState } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Trash2,
  Lock,
  CheckCircle2,
  AlertCircle,
  Key,
  ShieldAlert,
  ShieldOff,
} from 'lucide-react';
import { AdminAccessRecord } from '../../types/admin';
import { grantAdminAccess, revokeAdminAccess, isPermanentSuperAdmin } from '../../services/admin';
import { UserAccount } from '../../types/mtg';

interface AdminAccessControlViewProps {
  adminList: AdminAccessRecord[];
  currentUser: UserAccount | null;
  onRefreshAdmins: () => void;
}

export const AdminAccessControlView: React.FC<AdminAccessControlViewProps> = ({
  adminList,
  currentUser,
  onRefreshAdmins,
}) => {
  const [actionType, setActionType] = useState<'grant' | 'revoke'>('grant');
  const [adminInput, setAdminInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = adminInput.trim();
    if (!cleanInput) return;

    if (actionType === 'revoke') {
      if (isPermanentSuperAdmin(cleanInput)) {
        setFeedback({
          type: 'error',
          message: 'The primary owner account cannot be revoked.',
        });
        return;
      }

      if (typeof window !== 'undefined' && window.confirm) {
        if (!window.confirm(`Are you sure you want to revoke admin privileges from ${cleanInput}?`)) {
          return;
        }
      }

      setIsSubmitting(true);
      setFeedback(null);

      const res = await revokeAdminAccess(cleanInput);
      setIsSubmitting(false);

      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Successfully revoked administrator privileges from ${cleanInput}.`,
        });
        setAdminInput('');
        onRefreshAdmins();
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Failed to revoke admin access.',
        });
      }
    } else {
      setIsSubmitting(true);
      setFeedback(null);

      const res = await grantAdminAccess(cleanInput, currentUser?.id);
      setIsSubmitting(false);

      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Successfully granted administrator privileges to ${cleanInput}.`,
        });
        setAdminInput('');
        onRefreshAdmins();
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Failed to grant admin access.',
        });
      }
    }
  };

  const handleRevoke = async (admin: AdminAccessRecord) => {
    if (admin.role === 'owner' || isPermanentSuperAdmin(admin.email)) {
      alert('The primary owner account cannot be revoked.');
      return;
    }

    if (typeof window !== 'undefined' && window.confirm) {
      if (!window.confirm(`Are you sure you want to revoke admin privileges from ${admin.email}?`)) {
        return;
      }
    }

    setIsSubmitting(true);
    const res = await revokeAdminAccess(admin.email || admin.id);
    setIsSubmitting(false);

    if (res.success) {
      setFeedback({
        type: 'success',
        message: `Successfully revoked admin privileges from ${admin.email}.`,
      });
      onRefreshAdmins();
    } else {
      setFeedback({
        type: 'error',
        message: res.error || 'Failed to revoke admin access.',
      });
    }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Access Control Header */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400">
            <Key className="w-5 h-5" />
          </div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-heading">
            Admin Whitelist & Security Management
          </h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Manage authorized administrator accounts. Only verified administrators can view telemetry,
          cross-user evaluations, and manage access permissions. All requests are verified against PostgreSQL Row-Level Security.
        </p>
      </div>

      {/* Grant / Revoke Admin Form */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            {actionType === 'grant' ? (
              <UserPlus className="w-4.5 h-4.5 text-violet-600 dark:text-violet-400" />
            ) : (
              <ShieldOff className="w-4.5 h-4.5 text-rose-600 dark:text-rose-400" />
            )}
            <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">
              {actionType === 'grant' ? 'Grant Administrator Access' : 'Revoke Administrator Access'}
            </h3>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setActionType('grant');
                setFeedback(null);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                actionType === 'grant'
                  ? 'bg-white dark:bg-slate-700 text-violet-700 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Grant
            </button>
            <button
              type="button"
              onClick={() => {
                setActionType('revoke');
                setFeedback(null);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                actionType === 'revoke'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Revoke
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <input
              type="text"
              placeholder={
                actionType === 'grant'
                  ? 'Enter user email (e.g. drafter@gmail.com) or Supabase UUID...'
                  : 'Enter admin email or UUID to revoke...'
              }
              value={adminInput}
              onChange={(e) => setAdminInput(e.target.value)}
              className="w-full sm:flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-violet-500 transition-colors"
            />
            <button
              type="submit"
              disabled={isSubmitting || !adminInput.trim()}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-xl disabled:opacity-50 text-white font-bold text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 ${
                actionType === 'grant'
                  ? 'bg-violet-600 hover:bg-violet-500 shadow-md shadow-violet-500/20'
                  : 'bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-500/20'
              }`}
            >
              {actionType === 'grant' ? (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isSubmitting ? 'Granting...' : 'Grant Admin Privileges'}</span>
                </>
              ) : (
                <>
                  <ShieldOff className="w-4 h-4" />
                  <span>{isSubmitting ? 'Revoking...' : 'Revoke Admin Privileges'}</span>
                </>
              )}
            </button>
          </div>

          {feedback && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}
        </form>
      </div>

      {/* Current Authorized Admins Table */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading flex items-center gap-2">
          <Lock className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          <span>Current Authorized Administrators ({adminList.length})</span>
        </h3>

        <div className="rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4 sm:px-6">Admin Contact</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">User ID</th>
                  <th className="py-3 px-4">Date Granted</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {adminList.map((admin) => {
                  const isProtected = admin.role === 'owner' || isPermanentSuperAdmin(admin.email);
                  return (
                    <tr key={admin.id} className="hover:bg-slate-50 dark:hover:bg-slate-950/40 transition-colors">
                      <td className="py-3 px-4 sm:px-6">
                        <div className="font-bold text-slate-900 dark:text-white font-mono">
                          {admin.email}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider border ${
                            admin.role === 'owner'
                              ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/50'
                              : 'bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800/50'
                          }`}
                        >
                          {admin.role}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {admin.userId ? `${admin.userId.slice(0, 8)}...` : 'Pre-provisioned'}
                      </td>

                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {new Date(admin.createdAt).toLocaleDateString()}
                      </td>

                      <td className="py-3 px-4 sm:px-6 text-right">
                        {!isProtected ? (
                          <button
                            onClick={() => handleRevoke(admin)}
                            disabled={isSubmitting}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-600 hover:text-white dark:hover:bg-rose-700 dark:hover:text-white border border-rose-200 dark:border-rose-800/60 transition-all cursor-pointer shadow-xs"
                            title="Revoke Admin Access"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Revoke Access</span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-semibold font-mono">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Protected Owner</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Security Architecture Reference Note */}
      <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
          <ShieldAlert className="w-4 h-4 text-violet-600 dark:text-cyan-300" />
          <span>Security Architecture & RLS Enforcement</span>
        </div>
        <p>
          MTG Limited IQ enforces security at the PostgreSQL database level using Supabase Row-Level Security (RLS).
          The <code className="font-mono text-slate-800 dark:text-slate-200 bg-slate-200/60 dark:bg-slate-900 px-1 py-0.5 rounded">is_admin()</code> function
          evaluates whether the client caller belongs to <code className="font-mono text-slate-800 dark:text-slate-200 bg-slate-200/60 dark:bg-slate-900 px-1 py-0.5 rounded">app_admins</code>.
          Non-admins are strictly forbidden from querying cross-user evaluations, activity logs, or quiz statistics.
        </p>
      </div>
    </div>
  );
};
