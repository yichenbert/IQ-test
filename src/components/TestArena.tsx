import React, { useState, useEffect, useRef } from 'react'
import {
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
  Flag,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  BarChart3,
  Award,
  Zap,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import type { Question, Category, TestSessionResult, UserAnswerRecord } from '../types'
import {
  DIFFICULTY_LABELS,
  calculateEstimatedIQ,
  getIQEvaluationTitle,
  getCategoryInfo,
} from '../utils/iqCalculator'
import { MathRenderer } from './MathRenderer'
import { checkAnswerCorrectness } from '../utils/aiEvaluator'

interface TestArenaProps {
  questions: Question[]
  onSaveResult: (result: TestSessionResult) => void
  onExitToBank: () => void
}

type Stage = 'setup' | 'testing' | 'result'

export const TestArena: React.FC<TestArenaProps> = ({
  questions,
  onSaveResult,
  onExitToBank,
}) => {
  const [stage, setStage] = useState<Stage>('setup')

  const [selectedCount, setSelectedCount] = useState<number>(Math.min(10, questions.length))
  const [isRandomOrder, setIsRandomOrder] = useState<boolean>(true)
  const [hasTimer, setHasTimer] = useState<boolean>(true)
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number>(20)

  const [testQuestions, setTestQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const [userAnswers, setUserAnswers] = useState<Record<string, string | string[]>>({})
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set())
  const [remainingSeconds, setRemainingSeconds] = useState<number>(1200)
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0)

  const [sessionResult, setSessionResult] = useState<TestSessionResult | null>(null)
  const [reviewFilter, setReviewFilter] = useState<'all' | 'wrong' | 'correct'>('all')

  const timerRef = useRef<number | null>(null)

  const handleStartTest = (customQuestionList?: Question[]) => {
    let pool = customQuestionList ? [...customQuestionList] : [...questions]
    if (pool.length === 0) {
      alert('题库暂无题目，请先在题库中心添加题目')
      return
    }

    if (isRandomOrder) {
      pool.sort(() => Math.random() - 0.5)
    }

    const count = customQuestionList ? customQuestionList.length : Math.min(selectedCount, pool.length)
    const selected = pool.slice(0, count)

    setTestQuestions(selected)
    setCurrentIndex(0)
    setUserAnswers({})
    setFlaggedIds(new Set())
    setRemainingSeconds(timeLimitMinutes * 60)
    setElapsedSeconds(0)
    setStage('testing')
  }

  useEffect(() => {
    if (stage !== 'testing') {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }

    timerRef.current = window.setInterval(() => {
      setElapsedSeconds(prev => prev + 1)
      if (hasTimer) {
        setRemainingSeconds(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!)
            handleSubmitTest()
            return 0
          }
          return prev - 1
        })
      }
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [stage, hasTimer])

  const currentQ = testQuestions[currentIndex]

  const handleSelectOption = (optLabel: string) => {
    if (!currentQ) return

    if (currentQ.type === 'single-choice') {
      setUserAnswers(prev => ({ ...prev, [currentQ.id]: optLabel }))
    } else if (currentQ.type === 'multiple-choice') {
      const current = (userAnswers[currentQ.id] as string[]) || []
      let next: string[]
      if (current.includes(optLabel)) {
        next = current.filter(l => l !== optLabel)
      } else {
        next = [...current, optLabel].sort()
      }
      setUserAnswers(prev => ({ ...prev, [currentQ.id]: next }))
    }
  }

  const handleFillBlankChange = (val: string) => {
    if (!currentQ) return
    setUserAnswers(prev => ({ ...prev, [currentQ.id]: val }))
  }

  const toggleFlag = (qId: string) => {
    setFlaggedIds(prev => {
      const next = new Set(prev)
      if (next.has(qId)) next.delete(qId)
      else next.add(qId)
      return next
    })
  }

  const handleSubmitTest = () => {
    if (stage !== 'testing') return

    const records: UserAnswerRecord[] = []
    let correctCount = 0
    let totalWeightScore = 0
    let earnedWeightScore = 0

    const catStats: Record<Category, { total: number; correct: number }> = {
      math: { total: 0, correct: 0 },
      logic: { total: 0, correct: 0 },
      spatial: { total: 0, correct: 0 },
      probability: { total: 0, correct: 0 },
      algorithm: { total: 0, correct: 0 },
      deduction: { total: 0, correct: 0 },
    }

    testQuestions.forEach(q => {
      const ans = userAnswers[q.id] || ''
      const isCorrect = Array.isArray(q.answer)
        ? Array.isArray(ans) &&
          ans.length === q.answer.length &&
          ans.every(a => q.answer.includes(a))
        : checkAnswerCorrectness(String(ans), q.answer)

      const weight = DIFFICULTY_LABELS[q.difficulty].weight
      totalWeightScore += weight
      if (isCorrect) {
        correctCount++
        earnedWeightScore += weight
      }

      if (catStats[q.category]) {
        catStats[q.category].total += 1
        if (isCorrect) catStats[q.category].correct += 1
      }

      records.push({
        questionId: q.id,
        userAnswer: ans,
        isCorrect,
        timeSpentSeconds: Math.round(elapsedSeconds / testQuestions.length),
      })
    })

    const score = Math.round((correctCount / testQuestions.length) * 100)
    const estimatedIQ = calculateEstimatedIQ(earnedWeightScore, totalWeightScore)

    const result: TestSessionResult = {
      id: `session-${Date.now()}`,
      timestamp: Date.now(),
      totalQuestions: testQuestions.length,
      correctCount,
      score,
      estimatedIQ,
      timeSpentSeconds: elapsedSeconds,
      categoryStats: catStats,
      records,
    }

    setSessionResult(result)
    onSaveResult(result)
    setStage('result')

    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      })
    } catch {}
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  if (stage === 'setup') {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-8 backdrop-blur-sm text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-indigo-500/20">
            <Sparkles className="w-8 h-8 text-white" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            智能体与数理智商标准评测
          </h2>
          <p className="text-slate-400 text-sm max-w-lg mx-auto mt-2">
            题库涵盖高阶微积分极限、贝叶斯逆概率、阿里全球数学竞赛真题、李代数特征空间与信息熵极值，全方位评估抽象代数与深度推断能力。
          </p>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4">
              <label className="text-xs font-semibold text-slate-400 block mb-2">测试题量</label>
              <div className="flex items-center gap-1.5">
                {[5, 10, questions.length].map(cnt => (
                  <button
                    key={cnt}
                    onClick={() => setSelectedCount(cnt)}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      selectedCount === cnt
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {cnt === questions.length ? '全部' : `${cnt}题`}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4">
              <label className="text-xs font-semibold text-slate-400 block mb-2">出题顺序</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsRandomOrder(true)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    isRandomOrder
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  随机乱序
                </button>
                <button
                  onClick={() => setIsRandomOrder(false)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    !isRandomOrder
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  题库顺序
                </button>
              </div>
            </div>

            <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4">
              <label className="text-xs font-semibold text-slate-400 block mb-2">限时模式</label>
              <div className="flex items-center gap-1.5">
                {[15, 20, 30].map(mins => (
                  <button
                    key={mins}
                    onClick={() => {
                      setHasTimer(true)
                      setTimeLimitMinutes(mins)
                    }}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      hasTimer && timeLimitMinutes === mins
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {mins}分
                  </button>
                ))}
                <button
                  onClick={() => setHasTimer(false)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    !hasTimer
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  无限制
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => handleStartTest()}
              disabled={questions.length === 0}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white shadow-xl shadow-indigo-600/30 transition-all disabled:opacity-50"
            >
              🚀 即刻开始模拟测验
            </button>
            <button
              onClick={onExitToBank}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl text-sm font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
            >
              返回题库中心
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (stage === 'testing') {
    if (!currentQ) return null

    const currentAnswer = userAnswers[currentQ.id]
    const isFlagged = flaggedIds.has(currentQ.id)
    const answeredCount = Object.keys(userAnswers).length

    return (
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-600 text-white">
              第 {currentIndex + 1} / {testQuestions.length} 题
            </span>
            <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-indigo-300 border border-slate-700">
              {getCategoryInfo(currentQ.category).icon} {getCategoryInfo(currentQ.category).label}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-md border hidden sm:inline ${
                DIFFICULTY_LABELS[currentQ.difficulty]?.badge
              }`}
            >
              {DIFFICULTY_LABELS[currentQ.difficulty]?.label}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {hasTimer && (
              <div
                className={`flex items-center gap-1.5 font-mono text-sm font-bold px-3 py-1 rounded-lg border ${
                  remainingSeconds < 180
                    ? 'bg-rose-950/50 text-rose-400 border-rose-500/50 animate-pulse'
                    : 'bg-slate-950 text-cyan-400 border-slate-800'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>{formatTime(remainingSeconds)}</span>
              </div>
            )}

            <button
              onClick={() => toggleFlag(currentQ.id)}
              className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                isFlagged
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
              title="标记为疑难题稍后检查"
            >
              <Flag className={`w-3.5 h-3.5 ${isFlagged ? 'fill-amber-400 text-amber-400' : ''}`} />
              <span className="hidden sm:inline">标记待查</span>
            </button>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-sm space-y-6">
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-white mb-4">
              {currentQ.title}
            </h3>
            {currentQ.description && (
              <div className="text-sm sm:text-base leading-relaxed text-slate-200">
                <MathRenderer content={currentQ.description} />
              </div>
            )}
          </div>

          {currentQ.options && currentQ.options.length > 0 ? (
            <div className="space-y-3 pt-2">
              {currentQ.options.map(opt => {
                const isSelected =
                  currentQ.type === 'multiple-choice'
                    ? Array.isArray(currentAnswer) && currentAnswer.includes(opt.label)
                    : currentAnswer === opt.label

                return (
                  <button
                    key={opt.id}
                    onClick={() => handleSelectOption(opt.label)}
                    className={`w-full p-4 rounded-2xl border text-left flex items-start gap-4 transition-all ${
                      isSelected
                        ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-600/10 ring-1 ring-indigo-500'
                        : 'bg-slate-950/60 hover:bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <span
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {opt.label}
                    </span>
                    <div className="flex-1 pt-0.5 text-sm sm:text-base font-normal">
                      <MathRenderer content={opt.text} inline />
                    </div>
                  </button>
                )
              })}
            </div>
          ) : currentQ.type === 'free-response' ? (
            <div className="pt-2 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-purple-300">
                  【解答/证明大题】请输入您的推导演绎步骤、证明逻辑及最终结论：
                </label>
                <span className="text-[11px] text-slate-400">支持 LaTeX 公式语法（$式子$）</span>
              </div>
              <textarea
                rows={6}
                value={typeof currentAnswer === 'string' ? currentAnswer : ''}
                onChange={e => handleFillBlankChange(e.target.value)}
                placeholder="在此输入您的详细推导与证明过程，例如：&#10;由 Cayley-Hamilton 定理可得...&#10;设凸对称集为 K，根据闵可夫斯基第一凸体定理...&#10;故最终结论为：..."
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-purple-500 leading-relaxed"
              />

              {typeof currentAnswer === 'string' && currentAnswer.trim().length > 0 && (
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
                  <div className="text-[11px] font-semibold text-slate-400">输入内容实时公式预览：</div>
                  <div className="text-xs sm:text-sm text-slate-200">
                    <MathRenderer content={currentAnswer} />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-400 mb-2">
                请输入你的推导答案：
              </label>
              <input
                type="text"
                value={typeof currentAnswer === 'string' ? currentAnswer : ''}
                onChange={e => handleFillBlankChange(e.target.value)}
                placeholder="例如数值、公式等..."
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 flex-wrap">
            {testQuestions.map((q, i) => {
              const isAns = Boolean(userAnswers[q.id])
              const isFlg = flaggedIds.has(q.id)
              const isCur = i === currentIndex

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(i)}
                  className={`w-7 h-7 rounded-lg text-xs font-mono font-bold transition-all relative ${
                    isCur
                      ? 'ring-2 ring-indigo-400 text-white font-black'
                      : ''
                  } ${
                    isAns
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {i + 1}
                  {isFlg && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400" />
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>上一题</span>
            </button>

            {currentIndex < testQuestions.length - 1 ? (
              <button
                onClick={() => setCurrentIndex(prev => Math.min(testQuestions.length - 1, prev + 1))}
                className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/20"
              >
                <span>下一题</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => {
                  const unans = testQuestions.length - answeredCount
                  if (unans > 0) {
                    if (!window.confirm(`还有 ${unans} 道题目尚未作答，确定现在交卷吗？`)) {
                      return
                    }
                  }
                  handleSubmitTest()
                }}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg shadow-emerald-600/30"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>确认提交答卷</span>
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (stage === 'result' && sessionResult) {
    const iqEval = getIQEvaluationTitle(sessionResult.estimatedIQ)

    const filteredRecords = sessionResult.records.filter(r => {
      if (reviewFilter === 'wrong') return !r.isCorrect
      if (reviewFilter === 'correct') return r.isCorrect
      return true
    })

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-3xl p-8 text-center relative overflow-hidden shadow-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold mb-4">
            <Award className="w-4 h-4" />
            <span>AI智商测评模型 (常模标定 SD 15)</span>
          </div>

          <div className="flex flex-col items-center justify-center">
            <span className="text-6xl sm:text-7xl font-black tracking-tight bg-gradient-to-r from-cyan-400 via-indigo-300 to-rose-400 bg-clip-text text-transparent">
              {sessionResult.estimatedIQ}
            </span>
            <span className="text-xs uppercase tracking-widest text-slate-400 font-mono mt-1">
              ESTIMATED IQ SCORE
            </span>
          </div>

          <h3 className={`text-xl font-bold mt-4 ${iqEval.color}`}>
            {iqEval.title}
          </h3>
          <p className="text-slate-300 text-xs sm:text-sm max-w-md mx-auto mt-1 leading-relaxed">
            {iqEval.desc}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 pt-6 border-t border-slate-800/80">
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <span className="text-xs text-slate-400 block">答对题数</span>
              <span className="text-lg font-bold text-white">
                {sessionResult.correctCount} / {sessionResult.totalQuestions}
              </span>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <span className="text-xs text-slate-400 block">准确率</span>
              <span className="text-lg font-bold text-emerald-400">
                {sessionResult.score}%
              </span>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <span className="text-xs text-slate-400 block">总耗时</span>
              <span className="text-lg font-bold text-cyan-400">
                {formatTime(sessionResult.timeSpentSeconds)}
              </span>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <span className="text-xs text-slate-400 block">平均单题速度</span>
              <span className="text-lg font-bold text-indigo-400">
                {Math.round(sessionResult.timeSpentSeconds / sessionResult.totalQuestions)} 秒
              </span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
          <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            各维度学科与认知能力雷达解析
          </h4>

          <div className="space-y-3">
            {Object.entries(sessionResult.categoryStats).map(([catKey, stats]) => {
              if (stats.total === 0) return null
              const info = getCategoryInfo(catKey)
              const rate = Math.round((stats.correct / stats.total) * 100)

              return (
                <div key={catKey} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium flex items-center gap-1.5">
                      <span className="w-5 text-center text-indigo-400">{info.icon}</span>
                      {info.label}
                    </span>
                    <span className="text-slate-400 font-mono">
                      {stats.correct}/{stats.total} ({rate}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${info.color} transition-all duration-700`}
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              逐题解析与公式证明复盘
            </h4>

            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setReviewFilter('all')}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  reviewFilter === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                全部 ({sessionResult.records.length})
              </button>
              <button
                onClick={() => setReviewFilter('wrong')}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  reviewFilter === 'wrong'
                    ? 'bg-rose-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                错题 (
                {sessionResult.records.filter(r => !r.isCorrect).length})
              </button>
              <button
                onClick={() => setReviewFilter('correct')}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  reviewFilter === 'correct'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                正解 (
                {sessionResult.records.filter(r => r.isCorrect).length})
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {filteredRecords.map(record => {
              const q = testQuestions.find(item => item.id === record.questionId)
              if (!q) return null

              return (
                <div
                  key={q.id}
                  className={`border rounded-2xl p-5 space-y-4 ${
                    record.isCorrect
                      ? 'bg-slate-900/40 border-slate-800'
                      : 'bg-rose-950/10 border-rose-900/40'
                  }`}
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                    <div className="flex items-center gap-2">
                      {record.isCorrect ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      )}
                      <span className="font-bold text-sm text-white">
                        第 {testQuestions.findIndex(x => x.id === q.id) + 1} 题：{q.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      {q.type === 'free-response' ? (
                        <>
                          <span className="text-slate-400">
                            作答状态:{' '}
                            <strong className={record.userAnswer ? 'text-purple-300' : 'text-slate-500'}>
                              {record.userAnswer ? '已提交证明推导' : '未作答'}
                            </strong>
                          </span>
                          <span className="text-slate-400">|</span>
                          <span className="text-slate-400">
                            标准核心结论:{' '}
                            <strong className="text-emerald-400">
                              {Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}
                            </strong>
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-slate-400">
                            你的回答:{' '}
                            <strong className={record.isCorrect ? 'text-emerald-400' : 'text-rose-400'}>
                              {Array.isArray(record.userAnswer)
                                ? record.userAnswer.join(', ') || '未作答'
                                : record.userAnswer || '未作答'}
                            </strong>
                          </span>
                          <span className="text-slate-400">|</span>
                          <span className="text-slate-400">
                            标准答案:{' '}
                            <strong className="text-emerald-400">
                              {Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}
                            </strong>
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {q.description && (
                    <div className="text-xs sm:text-sm">
                      <MathRenderer content={q.description} />
                    </div>
                  )}

                  {q.type === 'free-response' && record.userAnswer && (
                    <div className="p-4 bg-purple-950/20 border border-purple-800/40 rounded-xl space-y-1.5">
                      <div className="text-xs font-semibold text-purple-300">
                        你的推导演绎作答：
                      </div>
                      <div className="text-xs sm:text-sm text-slate-200">
                        <MathRenderer content={String(record.userAnswer)} />
                      </div>
                    </div>
                  )}

                  <div className="p-4 bg-slate-950/80 border border-emerald-950/60 rounded-xl space-y-1.5">
                    <div className="text-xs font-semibold text-emerald-400">
                      {q.type === 'free-response' ? '官方标准证明与完整推导过程：' : '公式推导与详细题解：'}
                    </div>
                    <div className="text-xs sm:text-sm text-slate-300">
                      <MathRenderer content={q.explanation} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-6 border-t border-slate-800">
          <button
            onClick={() => handleStartTest()}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            <span>重新测验一组</span>
          </button>

          {sessionResult.records.some(r => !r.isCorrect) && (
            <button
              onClick={() => {
                const wrongIds = new Set(
                  sessionResult.records.filter(r => !r.isCorrect).map(r => r.questionId)
                )
                const wrongQuestions = testQuestions.filter(q => wrongIds.has(q.id))
                handleStartTest(wrongQuestions)
              }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-semibold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>专项强化错题集 (
                {sessionResult.records.filter(r => !r.isCorrect).length} 题)</span>
            </button>
          )}

          <button
            onClick={onExitToBank}
            className="px-6 py-3 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
          >
            返回题库
          </button>
        </div>
      </div>
    )
  }

  return null
}

