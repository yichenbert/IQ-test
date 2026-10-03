import React, { useState, useRef, useEffect } from 'react'
import { X, Sparkles, Plus, Trash2, Eye, Code, HelpCircle, Upload, CheckCircle2, AlertCircle } from 'lucide-react'
import type { Question, Category, Difficulty, QuestionType, OptionItem, LLMConfig } from '../types'
import { CATEGORY_LABELS, DIFFICULTY_LABELS, getCategoryInfo } from '../utils/iqCalculator'
import { MathRenderer } from './MathRenderer'
import { polishAnswerAndProofWithAI } from '../utils/aiVisionImporter'

interface QuestionModalProps {
  isOpen: boolean
  questionToEdit?: Question | null
  config?: LLMConfig
  onClose: () => void
  onSave: (question: Question) => void
}

const LATEX_SHORTCUTS = [
  { label: '分数', snippet: '\\frac{a}{b}' },
  { label: '根号', snippet: '\\sqrt{x}' },
  { label: '上标', snippet: 'x^{2}' },
  { label: '下标', snippet: 'a_{n}' },
  { label: '极限', snippet: '\\lim_{n \\to \\infty}' },
  { label: '求和', snippet: '\\sum_{k=1}^{n}' },
  { label: '积分', snippet: '\\int_{0}^{1} f(x) \\, dx' },
  { label: '矩阵', snippet: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
  { label: 'π', snippet: '\\pi' },
  { label: 'α', snippet: '\\alpha' },
  { label: 'β', snippet: '\\beta' },
  { label: '∞', snippet: '\\infty' },
  { label: '≤', snippet: '\\le' },
  { label: '≥', snippet: '\\ge' },
  { label: '±', snippet: '\\pm' },
  { label: '≈', snippet: '\\approx' },
  { label: '实数集', snippet: '\\mathbb{R}' },
  { label: '条件概率', snippet: 'P(A \\mid B)' },
]

export const QuestionModal: React.FC<QuestionModalProps> = ({
  isOpen,
  questionToEdit,
  config,
  onClose,
  onSave,
}) => {
  const isEditing = Boolean(questionToEdit)

  const [title, setTitle] = useState(questionToEdit?.title || '')
  const [description, setDescription] = useState(questionToEdit?.description || '')
  const [category, setCategory] = useState<Category>(questionToEdit?.category || 'math')
  const [difficulty, setDifficulty] = useState<Difficulty>(questionToEdit?.difficulty || 'medium')
  const [type, setType] = useState<QuestionType>(questionToEdit?.type || 'single-choice')
  const [options, setOptions] = useState<OptionItem[]>(
    questionToEdit?.options || [
      { id: 'opt-A', label: 'A', text: '' },
      { id: 'opt-B', label: 'B', text: '' },
      { id: 'opt-C', label: 'C', text: '' },
      { id: 'opt-D', label: 'D', text: '' },
    ]
  )
  const [answer, setAnswer] = useState<string | string[]>(
    questionToEdit?.answer ?? ''
  )
  const [explanation, setExplanation] = useState(
    questionToEdit?.explanation || ''
  )
  const [tagsStr, setTagsStr] = useState(questionToEdit?.tags?.join(', ') || '')
  const [previewTab, setPreviewTab] = useState<'split' | 'edit' | 'preview'>('split')

  // AI 答案识别与排版助手
  const isPendingAnswer = questionToEdit?.answer === '待补充答案' || !questionToEdit?.answer
  const [showAiHelper, setShowAiHelper] = useState<boolean>(isPendingAnswer)
  const [aiDraftNotes, setAiDraftNotes] = useState('')
  const [aiScratchImage, setAiScratchImage] = useState<string | null>(null)
  const [isPolishing, setIsPolishing] = useState(false)
  const [polishMsg, setPolishMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 关键：当待编辑题目变化或弹窗重新打开时，全面同步更新表单所有字段
  useEffect(() => {
    if (questionToEdit) {
      setTitle(questionToEdit.title || '')
      setDescription(questionToEdit.description || '')
      setCategory(questionToEdit.category || 'math')
      setDifficulty(questionToEdit.difficulty || 'medium')
      setType(questionToEdit.type || 'single-choice')
      setOptions(
        questionToEdit.options && questionToEdit.options.length > 0
          ? questionToEdit.options
          : [
              { id: 'opt-A', label: 'A', text: '' },
              { id: 'opt-B', label: 'B', text: '' },
              { id: 'opt-C', label: 'C', text: '' },
              { id: 'opt-D', label: 'D', text: '' },
            ]
      )
      setAnswer(questionToEdit.answer ?? '')
      setExplanation(questionToEdit.explanation || '')
      setTagsStr(questionToEdit.tags?.join(', ') || '')
      const isPending = questionToEdit.answer === '待补充答案' || !questionToEdit.answer
      setShowAiHelper(isPending)
      setAiDraftNotes('')
      setAiScratchImage(null)
      setPolishMsg(null)
    } else {
      setTitle('')
      setDescription('')
      setCategory('math')
      setDifficulty('medium')
      setType('single-choice')
      setOptions([
        { id: 'opt-A', label: 'A', text: '' },
        { id: 'opt-B', label: 'B', text: '' },
        { id: 'opt-C', label: 'C', text: '' },
        { id: 'opt-D', label: 'D', text: '' },
      ])
      setAnswer('')
      setExplanation('')
      setTagsStr('')
      setShowAiHelper(false)
      setAiDraftNotes('')
      setAiScratchImage(null)
      setPolishMsg(null)
    }
  }, [questionToEdit, isOpen])

  const handlePasteScratchImage = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile()
        if (file) {
          const reader = new FileReader()
          reader.onload = ev => {
            setAiScratchImage(ev.target?.result as string)
          }
          reader.readAsDataURL(file)
          e.preventDefault()
          break
        }
      }
    }
  }

  const handleRunAiPolish = async () => {
    if (!config?.apiKey) {
      setPolishMsg({
        type: 'error',
        text: '未检测到 API Key，请先在「AI 识图录入」或设置中填入 API 密钥以调用大模型。',
      })
      return
    }
    if (!aiDraftNotes.trim() && !aiScratchImage) {
      setPolishMsg({
        type: 'error',
        text: '请输入您的答案草稿、思路碎片，或上传/粘贴草稿纸截图。',
      })
      return
    }

    setIsPolishing(true)
    setPolishMsg(null)

    try {
      const res = await polishAnswerAndProofWithAI({
        title,
        description,
        type,
        options,
        userRawNotes: aiDraftNotes,
        imageBase64: aiScratchImage || undefined,
        config,
      })

      setAnswer(res.answer)
      setExplanation(res.explanation)
      setPolishMsg({
        type: 'success',
        text: '✨ 已成功完成 AI 识别与 LaTeX 排版！核心答案与推导解析已自动填充。',
      })
      if (previewTab === 'edit') {
        setPreviewTab('split')
      }
    } catch (err: any) {
      setPolishMsg({
        type: 'error',
        text: err.message || 'AI 排版请求异常，请检查网络或模型配置',
      })
    } finally {
      setIsPolishing(false)
    }
  }

  const [activeField, setActiveField] = useState<'desc' | 'explanation' | number>('desc')
  const descRef = useRef<HTMLTextAreaElement>(null)
  const expRef = useRef<HTMLTextAreaElement>(null)

  const insertSnippet = (snippet: string) => {
    if (activeField === 'desc' && descRef.current) {
      const textarea = descRef.current
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const text = description
      const updated = text.substring(0, start) + snippet + text.substring(end)
      setDescription(updated)
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + snippet.length, start + snippet.length)
      }, 50)
    } else if (activeField === 'explanation' && expRef.current) {
      const textarea = expRef.current
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const text = explanation
      const updated = text.substring(0, start) + snippet + text.substring(end)
      setExplanation(updated)
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + snippet.length, start + snippet.length)
      }, 50)
    } else if (typeof activeField === 'number' && options[activeField]) {
      const updated = [...options]
      updated[activeField].text += snippet
      setOptions(updated)
    } else {
      setDescription(prev => prev + ' ' + snippet)
    }
  }

  const handleAddOption = () => {
    const nextChar = String.fromCharCode(65 + options.length)
    setOptions([
      ...options,
      { id: `opt-${nextChar}`, label: nextChar, text: '' },
    ])
  }

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return
    const updated = options.filter((_, i) => i !== index).map((opt, i) => ({
      ...opt,
      label: String.fromCharCode(65 + i),
    }))
    setOptions(updated)
  }

  const handleOptionTextChange = (index: number, text: string) => {
    const updated = [...options]
    updated[index].text = text
    setOptions(updated)
  }

  const handleSingleAnswerChange = (label: string) => {
    setAnswer(label)
  }

  const handleMultipleAnswerToggle = (label: string) => {
    const current = Array.isArray(answer) ? [...answer] : [String(answer)]
    if (current.includes(label)) {
      setAnswer(current.filter(l => l !== label))
    } else {
      setAnswer([...current, label].sort())
    }
  }

  const handleSave = () => {
    if (!title.trim()) {
      alert('请填写题目简述或标题')
      return
    }
    if (!description.trim()) {
      alert('请填写题目内容')
      return
    }

    const tags = tagsStr
      .split(/[,，]/)
      .map(t => t.trim())
      .filter(Boolean)

    const newQuestion: Question = {
      id: questionToEdit ? questionToEdit.id : `q-${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      category,
      difficulty,
      type,
      options: (type === 'fill-blank' || type === 'free-response') ? undefined : options,
      answer,
      explanation: explanation.trim(),
      tags,
      createdAt: questionToEdit ? questionToEdit.createdAt : Date.now(),
      updatedAt: Date.now(),
    }

    onSave(newQuestion)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="relative w-full max-w-6xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                {isEditing ? '编辑题库题目' : '录入新题目 (支持 LaTeX 公式)'}
              </h3>
              <p className="text-xs text-slate-400">
                支持行内公式 <code className="text-indigo-300 font-mono">$E=mc^2$</code> 与块级公式 <code className="text-indigo-300 font-mono">$$\int_0^1 x dx$$</code>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800 text-xs">
              <button
                onClick={() => setPreviewTab('split')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  previewTab === 'split' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-white'
                }`}
              >
                左右分栏
              </button>
              <button
                onClick={() => setPreviewTab('edit')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  previewTab === 'edit' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-white'
                }`}
              >
                仅编辑
              </button>
              <button
                onClick={() => setPreviewTab('preview')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  previewTab === 'preview' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-white'
                }`}
              >
                仅预览
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-2 bg-slate-950/40 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto text-xs scrollbar-none">
          <span className="text-slate-400 flex items-center gap-1 font-mono shrink-0 mr-1">
            <Code className="w-3.5 h-3.5 text-indigo-400" />
            公式插入:
          </span>
          {LATEX_SHORTCUTS.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => insertSnippet(item.snippet)}
              className="px-2 py-1 rounded bg-slate-800/80 hover:bg-indigo-600/30 text-slate-300 hover:text-indigo-200 border border-slate-700/60 transition-colors shrink-0 font-mono text-[11px]"
              title={`插入 ${item.snippet}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className={`grid gap-6 ${previewTab === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
            {(previewTab === 'split' || previewTab === 'edit') && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    题目标题 / 考查要点 *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="例如：双重高斯积分的极坐标求解"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">学科领域</label>
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value as Category)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      {Object.entries(CATEGORY_LABELS).map(([catKey, info]) => (
                        <option key={catKey} value={catKey}>
                          {info.icon} {info.label}
                        </option>
                      ))}
                      {!CATEGORY_LABELS[category] && (
                        <option value={category}>
                          📑 {category} (文档/自定义分类)
                        </option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">难度等级</label>
                    <select
                      value={difficulty}
                      onChange={e => setDifficulty(e.target.value as Difficulty)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      {Object.entries(DIFFICULTY_LABELS).map(([diffKey, info]) => (
                        <option key={diffKey} value={diffKey}>
                          {info.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">题目类型</label>
                    <select
                      value={type}
                      onChange={e => setType(e.target.value as QuestionType)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="single-choice">单项选择题</option>
                      <option value="multiple-choice">多项选择题</option>
                      <option value="fill-blank">填空/数值题</option>
                      <option value="free-response">解答题 / 证明大题</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-300">
                      题目描述 (支持 Markdown & LaTeX) *
                    </label>
                    <span className="text-[11px] text-slate-500">
                      光标聚焦此处可插入公式快捷语法
                    </span>
                  </div>
                  <textarea
                    ref={descRef}
                    rows={5}
                    value={description}
                    onFocus={() => setActiveField('desc')}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="输入题干，支持行内 $x$ 和公式块 $$\frac{a}{b}$$..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                {/* AI 答案识别与智能 LaTeX 排版助手 */}
                <div className="bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-slate-900 border border-indigo-500/30 rounded-xl p-3.5 space-y-3 shadow-inner">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-indigo-200 flex items-center gap-1.5">
                          AI 识别我的答案并智能排版
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-normal border border-indigo-500/30">
                            免敲 LaTeX 公式
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          文档导入无答案时，在此直接输入您的粗略思路或草稿，AI 自动提炼标准答案并排版严密 LaTeX 推导
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAiHelper(!showAiHelper)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-medium px-2 py-1 rounded-lg bg-indigo-900/40 hover:bg-indigo-900/60 border border-indigo-500/30 transition-colors"
                    >
                      {showAiHelper ? '收起助手' : '展开 AI 助手'}
                    </button>
                  </div>

                  {showAiHelper && (
                    <div className="space-y-2.5 pt-2 border-t border-indigo-500/20" onPaste={handlePasteScratchImage}>
                      <div>
                        <textarea
                          rows={3}
                          value={aiDraftNotes}
                          onChange={e => setAiDraftNotes(e.target.value)}
                          placeholder="输入您的简要解题思路、粗略答案草稿（例如：'选C，因为在驻点处二阶导大于0'，或只写 '1/2'，或一段零散推演，也可直接在此按 Ctrl+V 粘贴草稿纸截图）..."
                          className="w-full px-3 py-2 bg-slate-950/90 border border-indigo-500/30 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-400 font-sans"
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <label className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 border border-slate-700 transition-colors">
                            <Upload className="w-3.5 h-3.5 text-indigo-400" />
                            <span>{aiScratchImage ? '更换草稿图片' : '上传/粘贴草稿纸截图'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={e => {
                                const f = e.target.files?.[0]
                                if (f) {
                                  const r = new FileReader()
                                  r.onload = ev => setAiScratchImage(ev.target?.result as string)
                                  r.readAsDataURL(f)
                                }
                              }}
                            />
                          </label>
                          {aiScratchImage && (
                            <div className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
                              <span>已载入图片草稿</span>
                              <button
                                type="button"
                                onClick={() => setAiScratchImage(null)}
                                className="text-slate-400 hover:text-rose-400 ml-1"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={isPolishing}
                          onClick={handleRunAiPolish}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {isPolishing ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              <span>AI 正在严密推导排版...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>⚡ AI 智能提炼答案并排版</span>
                            </>
                          )}
                        </button>
                      </div>

                      {polishMsg && (
                        <div
                          className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${
                            polishMsg.type === 'success'
                              ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                              : 'bg-rose-950/60 border border-rose-500/40 text-rose-300'
                          }`}
                        >
                          {polishMsg.type === 'success' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          )}
                          <span>{polishMsg.text}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {type !== 'fill-blank' && type !== 'free-response' ? (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-slate-300">
                        选项列表 (点击单选/复选框设置标准答案)
                      </label>
                      <button
                        type="button"
                        onClick={handleAddOption}
                        className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                      >
                        <Plus className="w-3.5 h-3.5" /> 增加选项
                      </button>
                    </div>

                    <div className="space-y-2">
                      {(options || []).map((opt, idx) => (
                        <div key={opt.id} className="flex items-center gap-2">
                          {type === 'single-choice' ? (
                            <input
                              type="radio"
                              name="correctAnswer"
                              checked={answer === opt.label}
                              onChange={() => handleSingleAnswerChange(opt.label)}
                              className="w-4 h-4 text-indigo-600 bg-slate-950 border-slate-700 focus:ring-indigo-500 cursor-pointer"
                              title="设为标准答案"
                            />
                          ) : (
                            <input
                              type="checkbox"
                              checked={Array.isArray(answer) && answer.includes(opt.label)}
                              onChange={() => handleMultipleAnswerToggle(opt.label)}
                              className="w-4 h-4 text-indigo-600 bg-slate-950 border-slate-700 rounded focus:ring-indigo-500 cursor-pointer"
                              title="设为标准答案"
                            />
                          )}

                          <span className="w-6 text-center font-bold text-sm text-slate-300">
                            {opt.label}.
                          </span>

                          <input
                            type="text"
                            value={opt.text}
                            onFocus={() => setActiveField(idx)}
                            onChange={e => handleOptionTextChange(idx, e.target.value)}
                            placeholder={`选项 ${opt.label} 文本或公式 (如 $\\pi$)`}
                            className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                          />

                          {(options?.length || 0) > 2 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveOption(idx)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                              title="删除此选项"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      {type === 'free-response'
                        ? '核心结论 / 证明命题要点 (例如：1/2 或 dim=⌊(d+2)/2⌋-j 或 构造C满足条件) *'
                        : '标准答案 (字符串或数值，例如 42 或 \\sqrt{2}) *'}
                    </label>
                    <input
                      type="text"
                      value={typeof answer === 'string' ? answer : answer.join(', ')}
                      onChange={e => setAnswer(e.target.value)}
                      placeholder={type === 'free-response' ? "输入核心结论或最终表达式" : "标准答案"}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-300">
                      {type === 'free-response'
                        ? '完整数学证明 / 推导过程 (LaTeX 步骤解析) *'
                        : '详细题解推导 (LaTeX 步骤解析) *'}
                    </label>
                  </div>
                  <textarea
                    ref={expRef}
                    rows={type === 'free-response' ? 7 : 4}
                    value={explanation}
                    onFocus={() => setActiveField('explanation')}
                    onChange={e => setExplanation(e.target.value)}
                    placeholder="输入严谨的解题推导与公式证明..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    标签 (逗号分隔)
                  </label>
                  <input
                    type="text"
                    value={tagsStr}
                    onChange={e => setTagsStr(e.target.value)}
                    placeholder="微积分, 黎曼和, 极限"
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            )}

            {(previewTab === 'split' || previewTab === 'preview') && (
              <div className="flex flex-col bg-slate-950/70 border border-slate-800 rounded-xl p-5 overflow-y-auto">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800 text-xs text-slate-400 font-medium">
                  <Eye className="w-4 h-4 text-cyan-400" />
                  <span>实时渲染预览效果 (KaTeX + Markdown)</span>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 text-xs rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                      {getCategoryInfo(category).label}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs rounded-md border ${(DIFFICULTY_LABELS[difficulty] || DIFFICULTY_LABELS.medium).badge}`}
                    >
                      {(DIFFICULTY_LABELS[difficulty] || DIFFICULTY_LABELS.medium).label}
                    </span>
                    <span className="px-2 py-0.5 text-xs rounded-md bg-slate-800 text-slate-400">
                      {type === 'single-choice'
                        ? '单选题'
                        : type === 'multiple-choice'
                        ? '多选题'
                        : type === 'free-response'
                        ? '解答/证明大题'
                        : '填空题'}
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-white">
                    {title || '题目未命名'}
                  </h4>

                  <div className="pt-2">
                    <MathRenderer content={description} />
                  </div>

                  {type !== 'fill-blank' && type !== 'free-response' && Array.isArray(options) && options.length > 0 && (
                    <div className="pt-3 space-y-2">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        选项预览
                      </div>
                      {options.map(opt => {
                        const isAns = Array.isArray(answer)
                          ? answer.includes(opt.label)
                          : answer === opt.label
                        return (
                          <div
                            key={opt.id}
                            className={`p-2.5 rounded-lg border flex items-start gap-3 transition-colors ${
                              isAns
                                ? 'bg-indigo-950/40 border-indigo-500/50 text-indigo-200'
                                : 'bg-slate-900/50 border-slate-800 text-slate-300'
                            }`}
                          >
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                isAns
                                  ? 'bg-indigo-600 text-white shadow-sm'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                              }`}
                            >
                              {opt.label}
                            </span>
                            <div className="flex-1 pt-0.5">
                              <MathRenderer content={opt.text || '(暂无内容)'} inline />
                            </div>
                            {isAns && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                标准答案
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <div className="pt-4 mt-4 border-t border-slate-800/80">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 mb-2">
                      <HelpCircle className="w-4 h-4" />
                      <span>推导与官方题解解析</span>
                    </div>
                    <div className="p-3 bg-emerald-950/20 border border-emerald-900/30 rounded-lg">
                      <MathRenderer content={explanation} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all"
          >
            {isEditing ? '保存修改' : '确认录入'}
          </button>
        </div>
      </div>
    </div>
  )
}

