import React, { useState, useMemo, useRef } from 'react'
import {
  Search,
  Filter,
  Plus,
  Download,
  Upload,
  RotateCcw,
  Edit3,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  BookOpen,
  Tag,
} from 'lucide-react'
import type { Question, Category, Difficulty, QuestionType } from '../types'
import { CATEGORY_LABELS, DIFFICULTY_LABELS } from '../utils/iqCalculator'
import { MathRenderer } from './MathRenderer'
import { buildQuestionPrompt } from '../utils/aiEvaluator'

interface QuestionBankProps {
  questions: Question[]
  onAddQuestion: () => void
  onOpenAIImport?: () => void
  onEditQuestion: (q: Question) => void
  onDeleteQuestion: (id: string) => void
  onImportQuestions: (imported: Question[]) => void
  onExportQuestions: () => void
  onResetDefault: () => void
}

export const QuestionBank: React.FC<QuestionBankProps> = ({
  questions,
  onAddQuestion,
  onOpenAIImport,
  onEditQuestion,
  onDeleteQuestion,
  onImportQuestions,
  onExportQuestions,
  onResetDefault,
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all')
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | 'all'>('all')
  const [selectedType, setSelectedType] = useState<QuestionType | 'all'>('all')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      if (selectedCategory !== 'all' && q.category !== selectedCategory) return false
      if (selectedDifficulty !== 'all' && q.difficulty !== selectedDifficulty) return false
      if (selectedType !== 'all' && q.type !== selectedType) return false

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase()
        const matchTitle = q.title.toLowerCase().includes(term)
        const matchDesc = q.description?.toLowerCase().includes(term)
        const matchTags = q.tags?.some(t => t.toLowerCase().includes(term))
        if (!matchTitle && !matchDesc && !matchTags) return false
      }
      return true
    })
  }, [questions, selectedCategory, selectedDifficulty, searchTerm])

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCopyPrompt = async (q: Question) => {
    const prompt = buildQuestionPrompt(q)
    try {
      await navigator.clipboard.writeText(prompt)
      setCopiedId(q.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      alert('已生成 Prompt，但浏览器剪贴板权限受限，请手动复制')
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = evt => {
      try {
        const content = evt.target?.result as string
        const parsed = JSON.parse(content)
        if (Array.isArray(parsed) && parsed.length > 0) {
          onImportQuestions(parsed)
          alert(`成功导入 ${parsed.length} 道题目！`)
        } else {
          alert('导入的 JSON 文件格式不符合题库数组结构')
        }
      } catch {
        alert('解析 JSON 题库文件失败，请检查文件格式')
      }
    }
    reader.readAsText(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-400" />
              题库资源管理器
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              当前收录 <span className="text-indigo-400 font-semibold">{questions.length}</span> 道高阶理数推理题目，支持全公式 LaTeX 实时渲染与格式化导出
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onOpenAIImport && (
              <button
                onClick={onOpenAIImport}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-600/20 transition-all"
                title="上传图片或截图，AI 自动识别题干、题型与排版答案"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI 识图录入</span>
              </button>
            )}

            <button
              onClick={onAddQuestion}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>录入新题</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition-colors"
              title="导入本地 JSON 题库"
            >
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              <span>导入 JSON</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json"
              className="hidden"
            />

            <button
              onClick={onExportQuestions}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition-colors"
              title="导出完整题库为 JSON"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>导出题库</span>
            </button>

            <button
              onClick={() => {
                if (window.confirm('确定要重置并恢复官方默认初始题库吗？自建题目将被覆盖。')) {
                  onResetDefault()
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-slate-700/60 transition-colors"
              title="恢复初始经典题库"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>重置默认</span>
            </button>
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="搜索题目、题干关键词、LaTeX 公式符号、阿里巴巴数学竞赛..."
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300"
              >
                清除
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value as Category | 'all')}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">全部学科类别</option>
              {Object.entries(CATEGORY_LABELS).map(([catKey, info]) => (
                <option key={catKey} value={catKey}>
                  {info.icon} {info.label}
                </option>
              ))}
            </select>

            <select
              value={selectedDifficulty}
              onChange={e => setSelectedDifficulty(e.target.value as Difficulty | 'all')}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">全部难度</option>
              {Object.entries(DIFFICULTY_LABELS).map(([diffKey, info]) => (
                <option key={diffKey} value={diffKey}>
                  {info.label}
                </option>
              ))}
            </select>

            <select
              value={selectedType}
              onChange={e => setSelectedType(e.target.value as QuestionType | 'all')}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">全部题型</option>
              <option value="single-choice">单选题</option>
              <option value="multiple-choice">多选题</option>
              <option value="fill-blank">填空题</option>
              <option value="free-response">解答/证明大题</option>
            </select>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            onClick={() => {
              setSelectedCategory('all')
              setSearchTerm('')
            }}
            className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
              selectedCategory === 'all' && !searchTerm
                ? 'bg-indigo-600 text-white font-medium'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            全部 ({questions.length})
          </button>

          <button
            onClick={() => setSearchTerm('2024阿里巴巴全球数学竞赛')}
            className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1 ${
              searchTerm === '2024阿里巴巴全球数学竞赛'
                ? 'bg-amber-600 text-white font-medium shadow-md shadow-amber-600/30'
                : 'bg-amber-500/10 text-amber-300 hover:text-white border border-amber-500/30'
            }`}
          >
            <span>🏆</span>
            <span>2024 阿里数学竞赛 ({questions.filter(q => q.tags?.includes('2024阿里巴巴全球数学竞赛')).length})</span>
          </button>

          {Object.entries(CATEGORY_LABELS).map(([catKey, info]) => {
            const count = questions.filter(q => q.category === catKey).length
            return (
              <button
                key={catKey}
                onClick={() => setSelectedCategory(catKey as Category)}
                className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1 ${
                  selectedCategory === catKey
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <span>{info.icon}</span>
                <span>{info.label.split('与')[0]}</span>
                <span className="text-[10px] opacity-70">({count})</span>
              </button>
            )
          })}
        </div>
      </div>

      {filteredQuestions.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-12 text-center text-slate-400">
          <Filter className="w-8 h-8 mx-auto text-slate-600 mb-2" />
          <p className="text-sm font-medium text-slate-300">没有找到匹配的题目</p>
          <p className="text-xs text-slate-500 mt-1">
            尝试更换搜索词、清除筛选条件，或点击“录入新题”创建题目
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredQuestions.map((q, index) => {
            const isExpanded = expandedIds.has(q.id)
            const catInfo = CATEGORY_LABELS[q.category] || CATEGORY_LABELS.math
            const diffInfo = DIFFICULTY_LABELS[q.difficulty] || DIFFICULTY_LABELS.medium

            return (
              <div
                key={q.id}
                className="bg-slate-900/50 hover:bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 transition-all shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/60">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono text-slate-400 font-bold px-2 py-0.5 rounded bg-slate-800">
                      #{index + 1}
                    </span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
                      {catInfo.icon} {catInfo.label}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border font-medium ${diffInfo.badge}`}
                    >
                      {diffInfo.label}
                    </span>
                    {q.type !== 'single-choice' && (
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                          q.type === 'free-response'
                            ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                            : q.type === 'multiple-choice'
                            ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                            : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {q.type === 'multiple-choice' ? '多选题' : q.type === 'free-response' ? '解答/证明题' : '填空题'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <button
                      onClick={() => handleCopyPrompt(q)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                      title="复制完整提示词（可直接发送给大模型测试）"
                    >
                      {copiedId === q.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">已复制 Prompt</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          <span>复制 Prompt</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => onEditQuestion(q)}
                      className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors"
                      title="编辑题目"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        if (window.confirm(`确定要删除题目“${q.title}”吗？`)) {
                          onDeleteQuestion(q.id)
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                      title="删除题目"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3">
                  <h3 className="text-base font-semibold text-white mb-2">{q.title}</h3>
                  {q.description && (
                    <div className="text-sm">
                      <MathRenderer content={q.description} />
                    </div>
                  )}
                </div>

                {q.type === 'free-response' ? (
                  <div className="mt-4 p-3.5 rounded-xl bg-purple-950/20 border border-purple-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30">
                        解答分析 / 证明大题
                      </span>
                      <span className="text-slate-400">
                        需按步骤写出严密数学证明与推导过程
                      </span>
                    </div>
                    <div className="font-mono text-purple-300 bg-purple-950/80 px-2.5 py-1 rounded-lg border border-purple-800/60 shrink-0">
                      核心结论: {Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}
                    </div>
                  </div>
                ) : (
                  q.options && q.options.length > 0 && (
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {q.options.map(opt => {
                        const isCorrect = Array.isArray(q.answer)
                          ? q.answer.includes(opt.label)
                          : q.answer === opt.label

                        return (
                          <div
                            key={opt.id}
                            className={`p-2.5 rounded-xl border flex items-start gap-2.5 text-xs transition-colors ${
                              isCorrect && isExpanded
                                ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-200'
                                : 'bg-slate-950/60 border-slate-800 text-slate-300'
                            }`}
                          >
                            <span
                              className={`w-5 h-5 rounded-md flex items-center justify-center font-bold shrink-0 ${
                                isCorrect && isExpanded
                                  ? 'bg-emerald-500 text-slate-950'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {opt.label}
                            </span>
                            <div className="flex-1 pt-0.5">
                              <MathRenderer content={opt.text} inline />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                )}

                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {q.tags?.map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-400"
                      >
                        <Tag className="w-2.5 h-2.5 text-indigo-400" />
                        {tag}
                      </span>
                    ))}
                  </div>

                  <button
                    onClick={() => toggleExpand(q.id)}
                    className="flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    <span>{isExpanded ? '收起解析' : '查看答案与推导'}</span>
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-4 p-4 rounded-xl bg-slate-950/90 border border-emerald-900/40 space-y-3">
                    <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                      <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        {q.type === 'free-response' ? '官方标准证明与完整推导过程' : '标准答案与详细推导过程'}
                      </span>
                      <span className="font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {q.type === 'free-response' ? '结论/要点: ' : '答案: '}
                        {Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm">
                      <MathRenderer content={q.explanation} />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

