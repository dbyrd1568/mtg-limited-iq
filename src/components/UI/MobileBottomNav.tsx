import React from 'react';
import { ActiveTab } from '../Navbar';
import { Award, Zap, Layers, Shield } from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  isAdmin?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onTabChange,
  isAdmin = false,
}) => {
  const tabs = [
    {
      id: 'evaluation' as ActiveTab,
      label: 'Grading',
      icon: Award,
    },
    {
      id: 'quiz' as ActiveTab,
      label: 'Quiz',
      icon: Zap,
    },
    {
      id: 'explorer' as ActiveTab,
      label: 'Cards',
      icon: Layers,
    },
    ...(isAdmin
      ? [
          {
            id: 'admin' as ActiveTab,
            label: 'Admin',
            icon: Shield,
          },
        ]
      : []),
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#060919]/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800/80 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.4)] pb-safe transition-all"
    >
      <div className="flex items-center justify-around h-14 px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer select-none min-h-[44px] ${
                isActive
                  ? 'text-violet-600 dark:text-cyan-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 active:scale-95'
              }`}
            >
              <div
                className={`p-1 rounded-lg transition-all ${
                  isActive
                    ? 'bg-violet-100 dark:bg-violet-950/80 scale-105'
                    : 'bg-transparent'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
              </div>
              <span className="text-[10px] font-medium tracking-tight mt-0.5">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
