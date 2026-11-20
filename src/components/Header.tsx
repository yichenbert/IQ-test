import React from 'react'
import { Brain, Layers, Bot, Award, Plus, Sparkles, Wand2 } from 'lucide-react'
import { ThemeSwitcher } from './ThemeSwitcher'

export type TabType = 'bank' | 'test' | 'ai-bench' | 'ai-import' | 'history'

interface HeaderProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
  totalQuestions: number
  onAddNew: () => void
}

interface NavItem {
  id: TabType
  label: string
  shortLabel: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  totalQuestions,
  onAddNew,
}) => {
  const navItems: NavItem[] = [
    { id: 'bank', label: '题库中心', shortLabel: '题库', icon: Layers, badge: totalQuestions },
    { id: 'ai-import', label: 'AI 识图录入', shortLabel: '识图', icon: Wand2 },
    { id: 'test', label: '模拟测验', shortLabel: '测验', icon: Sparkles },
    { id: 'ai-bench', label: 'AI 自动评测', shortLabel: '评测', icon: Bot },
    { id: 'history', label: '战报记录', shortLabel: '战报', icon: Award },
  ]

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Logo & Title */}
          <button
            type="button"
            onClick={() => onTabChange('bank')}
            className="flex items-center gap-3 text-left group shrink-0"
          >
            <div className="brand-logo-box w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/20 transition-transform duration-200 group-hover:scale-105">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-lg tracking-tight brand-gradient-text">
                  AI-IQ Matrix
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono hidden sm:inline-block">
                  LaTeX 2.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden xl:block leading-tight">
                多模态大模型 & 人类高智商基准测试题库
              </p>
            </div>
          </button>

          {/* Desktop Unified Pill Navigation */}
          <nav
            aria-label="主导航"
            className="hidden lg:flex items-center gap-1 p-1 rounded-2xl nav-pill-group"
          >
            {navItems.map(item => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 active:scale-[0.98] ${
                    isActive ? 'nav-pill-active' : 'nav-pill-item'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.label}</span>
                  {typeof item.badge === 'number' && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full transition-colors ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          {/* Action button & Theme Switcher */}
          <div className="flex items-center gap-2 shrink-0">
            <ThemeSwitcher />

            <button
              type="button"
              onClick={onAddNew}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all active:scale-[0.98] shadow-sm"
              title="新增题目"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">新增题目</span>
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Scrollable Navigation Bar */}
        <nav
          aria-label="移动端导航"
          className="flex lg:hidden items-center gap-1.5 pb-2.5 overflow-x-auto scrollbar-none"
        >
          {navItems.map(item => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                  isActive
                    ? 'nav-pill-active'
                    : 'nav-pill-item border border-slate-800/80'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{item.shortLabel}</span>
                {typeof item.badge === 'number' && (
                  <span
                    className={`text-[10px] font-mono px-1.5 rounded-full ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
