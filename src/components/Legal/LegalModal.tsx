import React, { useState } from 'react';
import { ShieldCheck, FileText, ArrowLeft, X, ExternalLink } from 'lucide-react';
import { PlaneswalkerSymbol } from '../UI/PlaneswalkerSymbol';

export type LegalDocType = 'privacy' | 'terms';

interface LegalModalProps {
  initialDoc?: LegalDocType;
  isOpen: boolean;
  onClose: () => void;
  isStandalonePage?: boolean;
}

export const LegalModal: React.FC<LegalModalProps> = ({
  initialDoc = 'privacy',
  isOpen,
  onClose,
  isStandalonePage = false,
}) => {
  const [activeDoc, setActiveDoc] = useState<LegalDocType>(initialDoc);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl my-auto bg-white dark:bg-[#070b1e] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-[#050818] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-600 dark:text-cyan-300">
              <PlaneswalkerSymbol className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white font-heading">
                  MTG Limited IQ
                </h2>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  Legal
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activeDoc === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab switch */}
            <div className="flex items-center p-1 bg-slate-200/70 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setActiveDoc('privacy')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  activeDoc === 'privacy'
                    ? 'bg-white dark:bg-violet-600 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Privacy
              </button>
              <button
                type="button"
                onClick={() => setActiveDoc('terms')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  activeDoc === 'terms'
                    ? 'bg-white dark:bg-violet-600 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Terms
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 overflow-y-auto text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed space-y-6">
          {activeDoc === 'privacy' ? (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-black text-slate-900 dark:text-white font-heading mb-1">
                  Privacy Policy
                </h1>
                <p className="text-xs text-slate-400 font-mono">
                  Effective Date: September 13, 2026 • Last Updated: September 13, 2026
                </p>
              </div>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  1. Overview & Commitment
                </h3>
                <p>
                  MTG Limited IQ (accessible at <a href="https://mtg-limited-iq.com" className="text-violet-600 dark:text-cyan-400 hover:underline">mtg-limited-iq.com</a>) provides Magic: The Gathering Limited drafting drills, card evaluations, and format mastery analytics. We respect your privacy and are committed to protecting your personal information.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  2. Information We Collect
                </h3>
                <p>We collect only the minimum information necessary to provide account synchronization and personalized study features:</p>
                <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-300">
                  <li>
                    <strong>Authentication Data:</strong> When you sign in via Google OAuth, Discord, Apple, or Magic Link email, we receive your verified email address, display name, and avatar URL. We request only standard public identity scopes (<code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-violet-600 dark:text-cyan-300 font-mono text-[11px]">openid</code>, <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-violet-600 dark:text-cyan-300 font-mono text-[11px]">email</code>, <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-violet-600 dark:text-cyan-300 font-mono text-[11px]">profile</code>). We never request or access any private Google Drive, Gmail, or sensitive cloud files.
                  </li>
                  <li>
                    <strong>Study & Evaluation Data:</strong> Your custom card ratings (grades, tier picks, strategic notes), quiz responses, and set exploration progress are stored to sync across your devices.
                  </li>
                  <li>
                    <strong>Anonymous Telemetry:</strong> Anonymized grading accuracy metrics and feature usage counters are tracked to identify community sleeper and trap cards across MTG Limited formats.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  3. How Information is Used
                </h3>
                <p>Your data is used exclusively to:</p>
                <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-300">
                  <li>Authenticate your account securely and synchronize your evaluations across devices.</li>
                  <li>Calculate your format calibration curve and quiz mastery scores.</li>
                  <li>Maintain platform security via PostgreSQL Row-Level Security (RLS).</li>
                </ul>
                <p className="font-semibold text-slate-900 dark:text-white">
                  We do not sell, rent, monetize, or share your personal information with third-party advertisers or data brokers.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  4. Third-Party Services & Infrastructure
                </h3>
                <p>MTG Limited IQ utilizes reputable infrastructure partners to deliver the service:</p>
                <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-300">
                  <li><strong>Supabase:</strong> Encrypted authentication and PostgreSQL database hosting.</li>
                  <li><strong>Cloudflare:</strong> Edge network hosting and SSL encryption.</li>
                  <li><strong>Scryfall API:</strong> Public Magic: The Gathering card imagery and rules text.</li>
                  <li><strong>17Lands:</strong> Public aggregate Limited card win rates.</li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  5. Wizards of the Coast Fan Content Disclaimer
                </h3>
                <p>
                  MTG Limited IQ is unofficial Fan Content permitted under the Wizards of the Coast Fan Content Policy. Portions of the materials used are property of Wizards of the Coast LLC, a subsidiary of Hasbro, Inc. MTG Limited IQ is not endorsed or sponsored by Wizards of the Coast.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  6. Your Rights & Data Deletion
                </h3>
                <p>
                  You may request complete deletion of your account and all associated evaluations, quiz history, and profile records at any time by emailing us at <a href="mailto:dbyrd1568@gmail.com" className="text-violet-600 dark:text-cyan-400 hover:underline font-mono">dbyrd1568@gmail.com</a>.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  7. Contact Information
                </h3>
                <p>
                  If you have questions regarding this Privacy Policy, please contact:
                </p>
                <p className="font-mono text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  Devon Byrd<br />
                  Maintainer, MTG Limited IQ<br />
                  Email: dbyrd1568@gmail.com<br />
                  Website: https://mtg-limited-iq.com
                </p>
              </section>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-black text-slate-900 dark:text-white font-heading mb-1">
                  Terms of Service
                </h1>
                <p className="text-xs text-slate-400 font-mono">
                  Effective Date: September 13, 2026 • Last Updated: September 13, 2026
                </p>
              </div>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  1. Acceptance of Terms
                </h3>
                <p>
                  By accessing or using MTG Limited IQ (<a href="https://mtg-limited-iq.com" className="text-violet-600 dark:text-cyan-400 hover:underline">mtg-limited-iq.com</a>), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the application.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  2. Description of Service
                </h3>
                <p>
                  MTG Limited IQ provides web-based draft drill simulations, card evaluation tools, format archetype guides, and quiz training exercises for players of Magic: The Gathering.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  3. User Accounts & Acceptable Use
                </h3>
                <p>
                  You agree to use MTG Limited IQ solely for lawful, non-commercial educational and entertainment purposes. You agree not to attempt to compromise the security, integrity, or availability of the service, or abuse API endpoints.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  4. Intellectual Property & Fan Content
                </h3>
                <p>
                  Magic: The Gathering, card names, mana symbols, expansion symbols, and card art are copyright and trademark Wizards of the Coast LLC, a subsidiary of Hasbro, Inc. MTG Limited IQ is not produced, endorsed, or affiliated with Wizards of the Coast.
                </p>
                <p>
                  Original code, custom evaluation algorithms, user interface designs, and calibration calculation engines are the property of MTG Limited IQ.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  5. User Generated Content
                </h3>
                <p>
                  You retain ownership of the card evaluations, notes, and ratings you submit. By using the service, you grant MTG Limited IQ a worldwide, royalty-free license to store your content for account synchronization and aggregate anonymized community ratings.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  6. Disclaimer of Warranties
                </h3>
                <p>
                  MTG Limited IQ is provided on an "as is" and "as available" basis without warranties of any kind, whether express or implied. We do not guarantee uninterrupted or error-free operation.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  7. Contact
                </h3>
                <p>
                  For inquiries or support, contact Devon Byrd at <a href="mailto:dbyrd1568@gmail.com" className="text-violet-600 dark:text-cyan-400 hover:underline font-mono">dbyrd1568@gmail.com</a>.
                </p>
              </section>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-[#050818] flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400">
            MTG Limited IQ • Unofficial Fan Content
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
          >
            {isStandalonePage ? <ArrowLeft className="w-3.5 h-3.5" /> : null}
            <span>{isStandalonePage ? 'Return to App' : 'Close'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
