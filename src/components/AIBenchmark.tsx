import React, { useState, useRef } from 'react'
import {
  Bot,
  Play,
  Square,
  Key,
  Globe,
  Cpu,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Download,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Brain,
  Sliders,
  FileText,
} from 'lucide-react'
import type { Question, LLMConfig, AIBenchmarkSession, AIEvalItemResult } from '../types'
import {
  evaluateQuestionWithAI,
  buildQuestionPrompt,
} from '../utils/aiEvaluator'
import { calculateEstimatedIQ, getIQEvaluationTitle } from '../utils/iqCalculator'
import { MathRenderer } from './MathRenderer'

interface AIBenchmarkProps {
  questions: Question[]
  config: LLMConfig
  onSaveConfig: (cfg: LLMConfig) => void
  onSaveBenchmark: (session: AIBenchmarkSession) => void
}

const PRESET_MODELS = [
  {
    name: 'DeepSeek Reasoner (R1 推理大模型)',
    baseURL: 'https://api.deepseek.com',
    model: 'deepseek-reasoner',
    temperature: 0.0,
  },
  {
    name: 'DeepSeek Chat (V3 通用大模型)',
    baseURL: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    temperature: 0.1,
  },
  {
    name: 'OpenAI GPT-4o (旗舰全能)',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    temperature: 0.1,
  },
  {
    name: 'OpenAI o3-mini (快速推理)',
    baseURL: 'https://api.openai.com/v1',
    model: 'o3-mini',
    temperature: 0.1,
  },
  {
    name: '本地 Ollama (DeepSeek-R1 / Qwen)',
    baseURL: 'http://localhost:11434/v1',
    model: 'deepseek-r1:8b',
    temperature: 0.1,
  },
]

export const AIBenchmark: React.FC<AIBenchmarkProps> = ({
  questions,
  config,
  onSaveConfig,
  onSaveBenchmark,
}) => {
  const [apiKey, setApiKey] = useState(config.apiKey)
  const [baseURL, setBaseURL] = useState(config.baseURL)
  const [model, setModel] = useState(config.model)
  const [temperature, setTemperature] = useState(config.temperature ?? 0.1)
  const [showConfig, setShowConfig] = useState(true)

  const [isRunning, setIsRunning] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [results, setResults] = useState<AIEvalItemResult[]>([])
  const [currentSession, setCurrentSession] = useState<AIBenchmarkSession | null>(null)
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set())
  const [copiedBatch, setCopiedBatch] = useState(false)

  const abortControllerRef = useRef<AbortController | null>(null)

  const handleApplyPreset = (preset: typeof PRESET_MODELS[0]) => {
    setBaseURL(preset.baseURL)
    setModel(preset.model)
    setTemperature(preset.temperature)
    const updated = {
      apiKey,
      baseURL: preset.baseURL,
      model: preset.model,
      temperature: preset.temperature,
    }
    onSaveConfig(updated)
  }

  const handleSaveConfig = () => {
    const updated = { apiKey, baseURL, model, temperature }
    onSaveConfig(updated)
    alert('API 配置已保存到浏览器本地！')
  }

  const toggleExpand = (idx: number) => {
    setExpandedIndices(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const handleStartBenchmark = async () => {
    if (questions.length === 0) {
      alert('题库暂无题目')
      return
    }

    if (!baseURL) {
      alert('请填写 Base URL')
      return
    }

    const activeConfig: LLMConfig = { apiKey, baseURL, model, temperature }
    onSaveConfig(activeConfig)

    setIsRunning(true)
    setResults([])
    setCurrentSession(null)
    setCurrentIndex(0)
    setExpandedIndices(new Set())

    const abortCtrl = new AbortController()
    abortControllerRef.current = abortCtrl

    const accumulatedResults: AIEvalItemResult[] = []

    for (let i = 0; i < questions.length; i++) {
      if (abortCtrl.signal.aborted) break
      setCurrentIndex(i)

      const q = questions[i]
      const itemResult = await evaluateQuestionWithAI(q, activeConfig, abortCtrl.signal)
      accumulatedResults.push(itemResult)
      setResults([...accumulatedResults])
    }

    setIsRunning(false)

    if (accumulatedResults.length > 0) {
      const correctCount = accumulatedResults.filter(r => r.isCorrect).length
      const accuracyRate = Math.round((correctCount / accumulatedResults.length) * 100)
      const avgLatencyMs = Math.round(
        accumulatedResults.reduce((acc, r) => acc + r.latencyMs, 0) / accumulatedResults.length
      )
      const estimatedIQ = calculateEstimatedIQ(correctCount, accumulatedResults.length)

      const session: AIBenchmarkSession = {
        id: `ai-bench-${Date.now()}`,
        timestamp: Date.now(),
        modelName: model || 'Unknown AI',
        totalQuestions: accumulatedResults.length,
        correctCount,
        accuracyRate,
        estimatedIQ,
        avgLatencyMs,
        results: accumulatedResults,
      }

      setCurrentSession(session)
      onSaveBenchmark(session)
    }
  }

  const handleStopBenchmark = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsRunning(false)
    }
  }

  const handleCopyAllPrompts = async () => {
    let fullText = `# AI 智商基准测试题目全集 (共 ${questions.length} 题)\n\n`
    questions.forEach((q, idx) => {
      fullText += `### 题目 #${idx + 1}: ${q.title}\n`
      fullText += buildQuestionPrompt(q)
      fullText += `\n---\n\n`
    })

    try {
      await navigator.clipboard.writeText(fullText)
      setCopiedBatch(true)
      setTimeout(() => setCopiedBatch(false), 2000)
    } catch {
      alert('已生成文本，但剪贴板访问失败')
    }
  }

  const handleExportMarkdownReport = () => {
    if (!currentSession) return

    let md = `# AI 智商测试评测报告 - ${currentSession.modelName}\n\n`
    md += `- **测试时间**: ${new Date(currentSession.timestamp).toLocaleString()}\n`
    md += `- **受测模型**: \`${currentSession.modelName}\`\n`
    md += `- **总题数**: ${currentSession.totalQuestions}\n`
    md += `- **答对题数**: ${currentSession.correctCount}\n`
    md += `- **准确率**: ${currentSession.accuracyRate}%\n`
    md += `- **预估 AI 智商 (IQ)**: ${currentSession.estimatedIQ}\n`
    md += `- **平均单题响应延迟**: ${currentSession.avgLatencyMs} ms\n\n`
    md += `## 逐题评测明细\n\n`

    currentSession.results.forEach((r, idx) => {
      md += `### 第 ${idx + 1} 题: ${r.questionTitle}\n`
      md += `- **判分结果**: ${r.isCorrect ? '✅ 答对' : '❌ 答错'}\n`
      md += `- **标准答案**: ${Array.isArray(r.correctAnswer) ? r.correctAnswer.join(', ') : r.correctAnswer}\n`
      md += `- **AI 提取答案**: \`${r.extractedAnswer}\`\n`
      md += `- **推理耗时**: ${r.latencyMs} ms\n\n`
      if (r.aiReasoning) {
        md += `> **模型思考过程 (CoT)**:\n> ${r.aiReasoning.replace(/\n/g, '\n> ')}\n\n`
      }
      md += `**模型完整回答**:\n\n${r.aiRawResponse || r.error || '无输出'}\n\n---\n\n`
    })

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `AI_IQ_Report_${currentSession.modelName}_${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center text-white shadow-lg shadow-purple-600/20">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                大模型 AI 智商自动化评测套件
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                支持直连 OpenAI / DeepSeek / Claude / 本地 Ollama 兼容端点，实时捕获思维链 (CoT) 并自动对拍打分
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyAllPrompts}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition-colors"
              title="复制全部题目的 Prompt，可在任意大模型网页端批量手动测试"
            >
              {copiedBatch ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">已复制全部 Prompt</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>批量复制 Prompt (免API)</span>
                </>
              )}
            </button>

            <button
              onClick={() => setShowConfig(!showConfig)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{showConfig ? '收起配置' : '展开 API 配置'}</span>
            </button>
          </div>
        </div>

        {showConfig && (
          <div className="mt-6 pt-5 border-t border-slate-800/80 space-y-4">
            <div>
              <span className="text-xs font-semibold text-slate-400 block mb-2">
                快速选用模型预设：
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_MODELS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="px-2.5 py-1 text-xs rounded-lg bg-slate-950 hover:bg-purple-950/40 text-slate-300 hover:text-purple-300 border border-slate-800 transition-colors"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
                  <Globe className="w-3 h-3 text-cyan-400" />
                  API Base URL *
                </label>
                <input
                  type="text"
                  value={baseURL}
                  onChange={e => setBaseURL(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
                  <Cpu className="w-3 h-3 text-purple-400" />
                  Model 名称 *
                </label>
                <input
                  type="text"
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  placeholder="gpt-4o / deepseek-reasoner"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
                  <Key className="w-3 h-3 text-amber-400" />
                  API Key (浏览器本地加密保存)
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 mb-1">
                  Temperature ({temperature})
                </label>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={temperature}
                    onChange={e => setTemperature(parseFloat(e.target.value))}
                    className="flex-1 accent-purple-500"
                  />
                  <button
                    type="button"
                    onClick={handleSaveConfig}
                    className="px-2.5 py-1 text-xs rounded bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/40"
                  >
                    保存
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs text-slate-400">
            评测题目规模: <span className="text-white font-bold">{questions.length}</span> 道高质量题目
          </div>

          <div className="flex items-center gap-3">
            {isRunning ? (
              <button
                onClick={handleStopBenchmark}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition-all"
              >
                <Square className="w-3.5 h-3.5" />
                <span>中止评测</span>
              </button>
            ) : (
              <button
                onClick={handleStartBenchmark}
                disabled={questions.length === 0}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-600/30 transition-all disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>启动 AI 全量智商评测</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {isRunning && (
        <div className="bg-slate-900/60 border border-purple-500/40 rounded-2xl p-5 backdrop-blur-sm space-y-3 animate-pulse">
          <div className="flex items-center justify-between text-xs">
            <span className="text-purple-300 font-semibold flex items-center gap-2">
              <Bot className="w-4 h-4" />
              正在评测: 第 {currentIndex + 1} / {questions.length} 题 - {questions[currentIndex]?.title}
            </span>
            <span className="text-slate-400 font-mono">
              {Math.round(((currentIndex + 1) / questions.length) * 100)}%
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {currentSession && !isRunning && (
        <div className="bg-gradient-to-br from-slate-900 via-purple-950/30 to-slate-900 border border-purple-500/40 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden">
          <div className="flex flex-col items-center justify-center">
            <span className="text-xs uppercase tracking-widest text-purple-400 font-mono font-bold mb-2">
              AI MODEL IQ BENCHMARK REPORT
            </span>
            <span className="text-6xl sm:text-7xl font-black bg-gradient-to-r from-purple-400 via-pink-300 to-amber-300 bg-clip-text text-transparent">
              {currentSession.estimatedIQ}
            </span>
            <span className="text-sm font-semibold text-slate-300 mt-2">
              {currentSession.modelName} · {getIQEvaluationTitle(currentSession.estimatedIQ).title}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 block">答对题数</span>
              <span className="text-lg font-bold text-white">
                {currentSession.correctCount} / {currentSession.totalQuestions}
              </span>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 block">准确率</span>
              <span className="text-lg font-bold text-purple-400">
                {currentSession.accuracyRate}%
              </span>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 block">平均推理延迟</span>
              <span className="text-lg font-bold text-cyan-400">
                {currentSession.avgLatencyMs} ms
              </span>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 block">综合评定</span>
              <span className="text-lg font-bold text-amber-400">
                {currentSession.estimatedIQ >= 130 ? '卓越超越' : '标准水准'}
              </span>
            </div>
          </div>

          <div className="mt-6 flex justify-center">
            <button
              onClick={handleExportMarkdownReport}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>下载完整 Markdown 评测报告</span>
            </button>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-400" />
              评测结果明细 ({results.length} 题)
            </h3>
          </div>

          <div className="space-y-3">
            {results.map((item, idx) => {
              const isExp = expandedIndices.has(idx)
              const q = questions.find(x => x.id === item.questionId)

              return (
                <div
                  key={idx}
                  className={`border rounded-2xl p-5 transition-all ${
                    item.isCorrect
                      ? 'bg-slate-900/50 border-slate-800'
                      : 'bg-rose-950/10 border-rose-900/40'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {item.isCorrect ? (
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                          <XCircle className="w-4 h-4" />
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-semibold text-white">
                          #{idx + 1} {item.questionTitle}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {item.latencyMs} ms
                          </span>
                          <span>·</span>
                          <span>
                            AI 答案: <strong className="text-white font-mono">{item.extractedAnswer}</strong>
                          </span>
                          <span>·</span>
                          <span>
                            正确: <strong className="text-emerald-400 font-mono">
                              {Array.isArray(item.correctAnswer) ? item.correctAnswer.join(', ') : item.correctAnswer}
                            </strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleExpand(idx)}
                      className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 self-end sm:self-auto font-medium"
                    >
                      <span>{isExp ? '收起详情' : '展开思维链与回答'}</span>
                      {isExp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {isExp && (
                    <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-4">
                      {q?.description && (
                        <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs">
                          <span className="font-semibold text-slate-400 block mb-1">题目原题：</span>
                          <MathRenderer content={q.description} />
                        </div>
                      )}

                      {item.aiReasoning && (
                        <div className="p-4 bg-purple-950/20 border border-purple-900/40 rounded-xl space-y-2">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-300">
                            <Brain className="w-3.5 h-3.5" />
                            <span>模型内部思考过程 (Reasoning / Chain of Thought)</span>
                          </div>
                          <div className="text-xs text-slate-300 font-mono whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed">
                            {item.aiReasoning}
                          </div>
                        </div>
                      )}

                      <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>模型最终输出 (LaTeX 渲染)</span>
                        </div>
                        {item.error ? (
                          <div className="text-xs text-rose-400 font-mono">{item.error}</div>
                        ) : (
                          <div className="text-xs sm:text-sm">
                            <MathRenderer content={item.aiRawResponse} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

