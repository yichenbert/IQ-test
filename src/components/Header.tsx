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

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  totalQuestions,
  onAddNew,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-cyan-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
                  AI-IQ Matrix
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                  LaTeX 2.0
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                多模态大模型 & 人类高智商基准测试题库
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => onTabChange('bank')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'bank'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>题库中心</span>
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60 hidden md:inline">
                {totalQuestions}
              </span>
            </button>

            <button
              onClick={() => onTabChange('ai-import')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'ai-import'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-purple-400 hover:text-purple-300 hover:bg-purple-950/40'
              }`}
            >
              <Wand2 className="w-4 h-4 text-purple-400" />
              <span>AI 识图录入</span>
            </button>

            <button
              onClick={() => onTabChange('test')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'test'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>模拟测验</span>
            </button>

            <button
              onClick={() => onTabChange('ai-bench')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'ai-bench'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Bot className="w-4 h-4" />
              <span>AI 自动评测</span>
            </button>

            <button
              onClick={() => onTabChange('history')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'history'
                  ? 'bg-slate-800 text-white border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Award className="w-4 h-4" />
              <span className="hidden sm:inline">战报记录</span>
            </button>
          </nav>

          {/* Action button & Theme Switcher */}
          <div className="flex items-center gap-2">
            <ThemeSwitcher />

            <button
              onClick={onAddNew}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/20 transition-colors shadow-sm"
              title="新增题目"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">新增题目</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

