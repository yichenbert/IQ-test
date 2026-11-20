import React, { useState } from 'react'
import { Award, Bot, Clock, Trash2, Calendar, TrendingUp } from 'lucide-react'
import type { TestSessionResult, AIBenchmarkSession } from '../types'
import { getIQEvaluationTitle } from '../utils/iqCalculator'

interface HistoryRecordsProps {
  humanHistory: TestSessionResult[]
  aiHistory: AIBenchmarkSession[]
  onClearHumanHistory: () => void
  onClearAIHistory: () => void
}

export const HistoryRecords: React.FC<HistoryRecordsProps> = ({
  humanHistory,
  aiHistory,
  onClearHumanHistory,
  onClearAIHistory,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'human' | 'ai'>('human')

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}分${s}秒`
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 sm:p-6 backdrop-blur-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              测试战报与评测历史
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1.5">
            长期追踪人类答题水平与多款大模型基准智商评测数据
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveSubTab('human')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                activeSubTab === 'human'
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>人工答题 ({humanHistory.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('ai')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                activeSubTab === 'ai'
                  ? 'bg-purple-600 text-white font-medium'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>AI 评测 ({aiHistory.length})</span>
            </button>
          </div>

          <button
            onClick={() => {
              if (window.confirm('确定要清除当前记录吗？')) {
                if (activeSubTab === 'human') onClearHumanHistory()
                else onClearAIHistory()
              }
            }}
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors"
            title="清除当前历史记录"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {activeSubTab === 'human' && (
        <div className="space-y-3">
          {humanHistory.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
              <Award className="w-8 h-8 mx-auto text-slate-600 mb-2" />
              <p className="text-sm font-medium text-slate-300">暂无人工测验记录</p>
              <p className="text-xs text-slate-500 mt-1">
                点击顶部“模拟测验”开始您的首次智商挑战
              </p>
            </div>
          ) : (
            humanHistory.map((item, idx) => {
              const evalInfo = getIQEvaluationTitle(item.estimatedIQ)
              return (
                <div
                  key={item.id || idx}
                  className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:-translate-y-0.5"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl iq-badge-human flex flex-col items-center justify-center shrink-0">
                      <span className="text-2xl font-black font-mono leading-none">
                        {item.estimatedIQ}
                      </span>
                      <span className="text-[9px] uppercase font-mono opacity-75 mt-1">
                        IQ
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${evalInfo.color}`}>
                          {evalInfo.title}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                          {item.score}% 正确率
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(item.timeSpentSeconds)}
                        </span>
                        <span>·</span>
                        <span>
                          答对 {item.correctCount}/{item.totalQuestions} 题
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {activeSubTab === 'ai' && (
        <div className="space-y-3">
          {aiHistory.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
              <Bot className="w-8 h-8 mx-auto text-slate-600 mb-2" />
              <p className="text-sm font-medium text-slate-300">暂无 AI 评测记录</p>
              <p className="text-xs text-slate-500 mt-1">
                点击顶部“AI 自动评测”连接模型进行智商测评
              </p>
            </div>
          ) : (
            aiHistory.map((item, idx) => {
              const evalInfo = getIQEvaluationTitle(item.estimatedIQ)
              return (
                <div
                  key={item.id || idx}
                  className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:-translate-y-0.5"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl iq-badge-ai flex flex-col items-center justify-center shrink-0">
                      <span className="text-2xl font-black font-mono leading-none">
                        {item.estimatedIQ}
                      </span>
                      <span className="text-[9px] uppercase font-mono opacity-75 mt-1">
                        AI IQ
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white font-mono">
                          {item.modelName}
                        </span>
                        <span className={`text-xs font-semibold ${evalInfo.color}`}>
                          · {evalInfo.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                        <span>·</span>
                        <span>正确率: {item.accuracyRate}%</span>
                        <span>·</span>
                        <span>平均延迟: {item.avgLatencyMs} ms</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

