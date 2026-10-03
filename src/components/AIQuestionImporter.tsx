import React, { useState, useRef, useEffect } from 'react'
import type { Question, LLMConfig, Category, Difficulty, QuestionType } from '../types'
import { recognizeQuestionWithAI, polishAnswerAndProofWithAI } from '../utils/aiVisionImporter'
import { MathRenderer } from './MathRenderer'
import {
  Upload,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Settings,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Key,
  Globe,
  Sliders,
  RefreshCw,
  PlusCircle,
  Tag,
  BookOpen,
  ArrowRight,
  ClipboardPaste,
  Wand2,
} from 'lucide-react'

interface AIQuestionImporterProps {
  config: LLMConfig
  onSaveConfig: (cfg: LLMConfig) => void
  onAddQuestionToBank: (q: Question) => void
  onNavigateToBank: () => void
}

const CATEGORY_MAP: Record<Category, { label: string; icon: string }> = {
  math: { label: '高阶数学', icon: '📐' },
  logic: { label: '纯逻辑推理', icon: '🧩' },
  spatial: { label: '空间几何', icon: '🧊' },
  probability: { label: '概率统计', icon: '🎲' },
  algorithm: { label: '算法复杂性', icon: '⚡' },
  deduction: { label: '归纳演绎', icon: '🔍' },
}

const DIFFICULTY_MAP: Record<Difficulty, { label: string; color: string }> = {
  easy: { label: '入门', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
  medium: { label: '中等', color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' },
  hard: { label: '困难', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  genius: { label: '特级大师', color: 'text-rose-400 border-rose-500/30 bg-rose-500/10' },
}

export const AIQuestionImporter: React.FC<AIQuestionImporterProps> = ({
  config,
  onSaveConfig,
  onAddQuestionToBank,
  onNavigateToBank,
}) => {
  // Config state
  const [showConfig, setShowConfig] = useState(!config.apiKey)
  const [localConfig, setLocalConfig] = useState<LLMConfig>(config)

  // Input states
  const [imageBase64, setImageBase64] = useState<string>('')
  const [imageName, setImageName] = useState<string>('')
  const [rawText, setRawText] = useState<string>('')
  const [userRawNotes, setUserRawNotes] = useState<string>('')

  // Parsing / status states
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPolishing, setIsPolishing] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successSaved, setSuccessSaved] = useState(false)

  // Result question state for inspection and editing
  const [parsedQuestion, setParsedQuestion] = useState<Question | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setLocalConfig(config)
  }, [config])

  // Support paste image from clipboard
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile()
          if (blob) {
            handleImageFile(blob, `剪贴板截图_${new Date().toLocaleTimeString()}.png`)
            break
          }
        }
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [])

  const handleImageFile = (file: File, customName?: string) => {
    if (!file.type.startsWith('image/')) {
      alert('请上传图片文件 (PNG, JPG, WEBP 等)')
      return
    }

    const reader = new FileReader()
    reader.onload = event => {
      const base64 = event.target?.result as string
      setImageBase64(base64)
      setImageName(customName || file.name)
      setErrorMessage('')
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageFile(e.dataTransfer.files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleSaveConfig = () => {
    onSaveConfig(localConfig)
    setShowConfig(false)
  }

  // Trigger full recognition
  const handleStartRecognition = async () => {
    if (!imageBase64 && !rawText.trim()) {
      setErrorMessage('请先上传题目图片或输入题干文本')
      return
    }

    if (!localConfig.apiKey && !localConfig.baseURL.includes('localhost') && !localConfig.baseURL.includes('127.0.0.1')) {
      setShowConfig(true)
      setErrorMessage('请先配置您的 AI 接口 API Key 或兼容端点')
      return
    }

    setIsProcessing(true)
    setErrorMessage('')
    setStatusMessage('正在连接多模态模型进行高精度题意提取与数学公式转译...')
    setSuccessSaved(false)

    abortControllerRef.current = new AbortController()

    try {
      const result = await recognizeQuestionWithAI({
        imageBase64: imageBase64 || undefined,
        rawText: rawText.trim() || undefined,
        userRawNotes: userRawNotes.trim() || undefined,
        config: localConfig,
        signal: abortControllerRef.current.signal,
      })

      setParsedQuestion(result)
      setStatusMessage('✨ 题目提取与排版完成！请在下方核验，或一键存入题库。')
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setStatusMessage('已取消解析')
      } else {
        const msg = err instanceof Error ? err.message : String(err)
        setErrorMessage(msg)
      }
    } finally {
      setIsProcessing(false)
      abortControllerRef.current = null
    }
  }

  // Trigger polish only on user rough notes
  const handlePolishAnswerOnly = async () => {
    if (!parsedQuestion) return
    if (!userRawNotes.trim()) {
      setErrorMessage('请先在“手动答案与思路草稿”框中输入内容')
      return
    }

    setIsPolishing(true)
    setErrorMessage('')

    abortControllerRef.current = new AbortController()

    try {
      const { answer, explanation } = await polishAnswerAndProofWithAI({
        title: parsedQuestion.title,
        description: parsedQuestion.description,
        type: parsedQuestion.type,
        userRawNotes: userRawNotes.trim(),
        config: localConfig,
        signal: abortControllerRef.current.signal,
      })

      setParsedQuestion(prev => (prev ? { ...prev, answer, explanation } : null))
      setStatusMessage('✨ 答案与证明过程已重新根据您的思路完成 LaTeX 严密排版！')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMessage(`排版失败: ${msg}`)
    } finally {
      setIsPolishing(false)
      abortControllerRef.current = null
    }
  }

  // Save to question bank
  const handleSaveToBank = () => {
    if (!parsedQuestion) return
    onAddQuestionToBank(parsedQuestion)
    setSuccessSaved(true)
    setStatusMessage('🎉 题目已成功保存至题库！')
  }

  const handleReset = () => {
    setImageBase64('')
    setImageName('')
    setRawText('')
    setUserRawNotes('')
    setParsedQuestion(null)
    setErrorMessage('')
    setStatusMessage('')
    setSuccessSaved(false)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Title & Introduction Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-72 h-72 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/30">
                <Sparkles className="w-5 h-5" />
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                AI 智能识图与题目全自动排版录入
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              支持上传试卷截图、手写稿拍照或网页截屏（支持直接 <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300 font-mono text-[11px]">Ctrl+V</kbd> 粘贴）。
              多模态 AI 将自动识别公式 LaTeX、判定题型（单选/多选/填空/大题证明）、分类标签，并对您随手写下的答案草稿进行层次分明的专业数学排版。
            </p>
          </div>

          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-950 hover:bg-slate-900 text-slate-300 border border-slate-800 transition-colors self-start sm:self-auto"
          >
            <Settings className="w-4 h-4 text-indigo-400" />
            <span>AI 接口参数设置</span>
            {showConfig ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* API Settings Section */}
        {showConfig && (
          <div className="mt-6 pt-5 border-t border-slate-800/80 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" />
                自定义模型接口 (OpenAI 兼容 / 多模态 Vision 协议)
              </h3>
              <span className="text-[11px] text-slate-500">
                支持 OpenAI、通义千问 VL、Claude、Gemini、DeepSeek 及各类 OneAPI 中转端点
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1">
                  <Globe className="w-3 h-3 text-cyan-400" />
                  接口 Base URL
                </label>
                <input
                  type="text"
                  value={localConfig.baseURL}
                  onChange={e => setLocalConfig({ ...localConfig, baseURL: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1">
                  <Key className="w-3 h-3 text-amber-400" />
                  API 密钥 (API Key)
                </label>
                <input
                  type="password"
                  value={localConfig.apiKey}
                  onChange={e => setLocalConfig({ ...localConfig, apiKey: e.target.value })}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1">
                  <ImageIcon className="w-3 h-3 text-purple-400" />
                  识别模型 (需支持视觉识图)
                </label>
                <input
                  type="text"
                  value={localConfig.model}
                  onChange={e => setLocalConfig({ ...localConfig, model: e.target.value })}
                  placeholder="gpt-4o / qwen-vl-max / gemini-1.5-flash"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={handleSaveConfig}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
              >
                保存接口配置
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Form: Input Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Image / Text Input */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <span className="text-sm font-bold text-white flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-cyan-400" />
              1. 题目图片或截图输入
            </span>
            <span className="text-[11px] text-slate-400">支持拖拽或直接 Ctrl+V 粘贴</span>
          </div>

          {/* Dropzone & Preview */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className={`border-2 border-dashed rounded-2xl p-4 text-center transition-all ${
              imageBase64
                ? 'border-indigo-500/50 bg-indigo-950/10'
                : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'
            }`}
          >
            {imageBase64 ? (
              <div className="space-y-3">
                <div className="relative group max-h-60 overflow-hidden rounded-xl bg-slate-950 flex items-center justify-center p-2 border border-slate-800">
                  <img
                    src={imageBase64}
                    alt="题目截图"
                    className="max-h-56 max-w-full object-contain rounded-lg"
                  />
                  <button
                    onClick={() => {
                      setImageBase64('')
                      setImageName('')
                    }}
                    className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-slate-950/90 hover:bg-rose-950 text-slate-400 hover:text-rose-300 text-xs border border-slate-700 transition-colors"
                  >
                    移除图片
                  </button>
                </div>
                <div className="text-xs text-slate-400 flex items-center justify-center gap-2">
                  <span className="truncate max-w-xs">{imageName || '已选图片'}</span>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-indigo-400 hover:text-indigo-300 underline"
                  >
                    更换图片
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-8 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/20">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-200">
                    点击选择图片，或将图片拖拽到此处
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    也支持直接在当前网页按 <kbd className="px-1.5 py-0.5 bg-slate-800 rounded font-mono text-[10px] text-slate-300">Ctrl+V</kbd> 粘贴剪贴板截图
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                >
                  浏览本地图片
                </button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                if (e.target.files && e.target.files[0]) {
                  handleImageFile(e.target.files[0])
                }
              }}
            />
          </div>

          {/* Optional raw text if image is blurry or user prefers text */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
              <ClipboardPaste className="w-3.5 h-3.5 text-slate-500" />
              题目文字补充 / 纯文本录题 (可选)
            </label>
            <textarea
              rows={2}
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder="若图片较模糊，可在此粘贴文字辅助识别..."
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 leading-relaxed font-sans"
            />
          </div>
        </div>

        {/* Right: User Raw Answer Notes & Action */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-purple-400" />
                2. 手动答案草稿与思路 (AI 自动整理排版)
              </span>
              <span className="text-[11px] text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                核心亮点
              </span>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-300">
                请在此随手输入答案或解题思路草稿（无须拘泥格式）：
              </label>
              <textarea
                rows={7}
                value={userRawNotes}
                onChange={e => setUserRawNotes(e.target.value)}
                placeholder="例如：&#10;• 选择题直接写：答案选C，因为导数为零时取极值；&#10;• 解答证明题可写草稿：结论是 1/2。根据非对称抛硬币的马氏链对称性，设首达时停，由强马尔可夫性可证极限均匀分布；&#10;• 或仅写一个数值结论：1/16。&#10;&#10;👉 AI 将自动在此基础上梳理步骤，排版为严谨、规范的高阶 LaTeX 公式证明！"
                className="w-full px-3.5 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 leading-relaxed font-sans"
              />
              <p className="text-[11px] text-slate-500">
                💡 如果您手上没有现成答案，也可以留空，AI 会尝试自行推导证明。
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-3">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {statusMessage && (
              <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-800/60 text-indigo-300 text-xs flex items-center gap-2">
                <Sparkles className="w-4 h-4 shrink-0 text-indigo-400" />
                <span>{statusMessage}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleStartRecognition}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 shadow-lg shadow-purple-600/20 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>AI 深度识别与排版中...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>⚡ 开始 AI 识图与规范排版入库</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="w-full sm:w-auto px-4 py-3 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-950 hover:bg-slate-900 border border-slate-800 transition-colors"
              >
                清空重置
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recognition Result & Inspection Section */}
      {parsedQuestion && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <CheckCircle className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  识别与排版结果核验
                </h3>
                <p className="text-xs text-slate-400">
                  可在此直接微调题目信息，右侧/下方即时预览 KaTeX 公式呈现效果
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {parsedQuestion.type === 'free-response' && (
                <button
                  type="button"
                  disabled={isPolishing}
                  onClick={handlePolishAnswerOnly}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-purple-950/60 hover:bg-purple-900/80 text-purple-200 border border-purple-800/60 transition-colors"
                  title="基于上方的草稿，重新让 AI 润色并排版题解公式"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isPolishing ? 'animate-spin' : ''}`} />
                  <span>重新润色答案排版</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleSaveToBank}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  successSaved
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                }`}
              >
                {successSaved ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>已存入题库</span>
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4" />
                    <span>确认无误，存入题库</span>
                  </>
                )}
              </button>

              {successSaved && (
                <button
                  type="button"
                  onClick={onNavigateToBank}
                  className="flex items-center gap-1 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-indigo-300 transition-colors"
                >
                  <span>前往题库查看</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Form and Preview Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Editable Form */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    题目标题
                  </label>
                  <input
                    type="text"
                    value={parsedQuestion.title}
                    onChange={e =>
                      setParsedQuestion({ ...parsedQuestion, title: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    题型判断
                  </label>
                  <select
                    value={parsedQuestion.type}
                    onChange={e => {
                      const newType = e.target.value as QuestionType
                      setParsedQuestion({
                        ...parsedQuestion,
                        type: newType,
                        options:
                          newType === 'free-response' || newType === 'fill-blank'
                            ? undefined
                            : parsedQuestion.options || [
                                { id: 'opt-1', label: 'A', text: '' },
                                { id: 'opt-2', label: 'B', text: '' },
                              ],
                      })
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="single-choice">单选题</option>
                    <option value="multiple-choice">多选题</option>
                    <option value="fill-blank">填空题</option>
                    <option value="free-response">解答/证明大题</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    分类领域
                  </label>
                  <select
                    value={parsedQuestion.category}
                    onChange={e =>
                      setParsedQuestion({
                        ...parsedQuestion,
                        category: e.target.value as Category,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    {Object.entries(CATEGORY_MAP).map(([key, info]) => (
                      <option key={key} value={key}>
                        {info.icon} {info.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    难度评级
                  </label>
                  <select
                    value={parsedQuestion.difficulty}
                    onChange={e =>
                      setParsedQuestion({
                        ...parsedQuestion,
                        difficulty: e.target.value as Difficulty,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    {Object.entries(DIFFICULTY_MAP).map(([key, info]) => (
                      <option key={key} value={key}>
                        {info.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  题目完整题干 (KaTeX LaTeX)
                </label>
                <textarea
                  rows={4}
                  value={parsedQuestion.description || ''}
                  onChange={e =>
                    setParsedQuestion({ ...parsedQuestion, description: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-indigo-500 leading-relaxed"
                />
              </div>

              {/* Options if choice */}
              {(parsedQuestion.type === 'single-choice' ||
                parsedQuestion.type === 'multiple-choice') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    选项配置
                  </label>
                  <div className="space-y-2">
                    {parsedQuestion.options?.map((opt, idx) => (
                      <div key={opt.id} className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center shrink-0">
                          {opt.label}
                        </span>
                        <input
                          type="text"
                          value={opt.text}
                          onChange={e => {
                            const newOptions = [...(parsedQuestion.options || [])]
                            newOptions[idx].text = e.target.value
                            setParsedQuestion({ ...parsedQuestion, options: newOptions })
                          }}
                          className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  {parsedQuestion.type === 'free-response' ? '核心结论 / 考查要点' : '标准答案'}
                </label>
                <input
                  type="text"
                  value={
                    Array.isArray(parsedQuestion.answer)
                      ? parsedQuestion.answer.join(', ')
                      : parsedQuestion.answer
                  }
                  onChange={e =>
                    setParsedQuestion({ ...parsedQuestion, answer: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-emerald-400 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  详细解析与推导证明过程 (AI 已格式化为标准 LaTeX)
                </label>
                <textarea
                  rows={6}
                  value={parsedQuestion.explanation}
                  onChange={e =>
                    setParsedQuestion({ ...parsedQuestion, explanation: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-indigo-500 leading-relaxed"
                />
              </div>
            </div>

            {/* Live Visual Render Preview */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
                  <span className="font-semibold text-indigo-400 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    渲染预览效果 (KaTeX Real-Time)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${
                        DIFFICULTY_MAP[parsedQuestion.difficulty].color
                      }`}
                    >
                      {DIFFICULTY_MAP[parsedQuestion.difficulty].label}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[11px]">
                      {CATEGORY_MAP[parsedQuestion.category].icon}{' '}
                      {CATEGORY_MAP[parsedQuestion.category].label}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-base font-bold text-white mb-2">
                    {parsedQuestion.title}
                  </h4>
                  {parsedQuestion.description && (
                    <div className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                      <MathRenderer content={parsedQuestion.description} />
                    </div>
                  )}
                </div>

                {parsedQuestion.type === 'free-response' ? (
                  <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-800/40 text-xs text-purple-300 flex items-center justify-between">
                    <span>题型：解答分析 / 证明大题（无选项）</span>
                    <span className="font-mono bg-purple-900/50 px-2 py-0.5 rounded border border-purple-700/50 text-white">
                      结论: {Array.isArray(parsedQuestion.answer) ? parsedQuestion.answer.join(', ') : parsedQuestion.answer}
                    </span>
                  </div>
                ) : (
                  parsedQuestion.options &&
                  parsedQuestion.options.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {parsedQuestion.options.map(opt => (
                        <div
                          key={opt.id}
                          className="p-2.5 rounded-xl border border-slate-800 bg-slate-900/50 flex items-start gap-2 text-xs"
                        >
                          <span className="w-5 h-5 rounded bg-slate-800 text-slate-300 font-bold flex items-center justify-center shrink-0">
                            {opt.label}
                          </span>
                          <div className="pt-0.5 text-slate-200">
                            <MathRenderer content={opt.text} inline />
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}

                <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/40 space-y-2">
                  <div className="flex items-center justify-between text-xs pb-1.5 border-b border-emerald-900/40">
                    <span className="font-semibold text-emerald-400">
                      {parsedQuestion.type === 'free-response'
                        ? '官方标准证明推导：'
                        : '公式推导与详细题解：'}
                    </span>
                    <span className="font-mono text-emerald-300 bg-emerald-900/40 px-2 py-0.5 rounded border border-emerald-700/50">
                      答案: {Array.isArray(parsedQuestion.answer) ? parsedQuestion.answer.join(', ') : parsedQuestion.answer}
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                    <MathRenderer content={parsedQuestion.explanation} />
                  </div>
                </div>
              </div>

              {parsedQuestion.tags && parsedQuestion.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-800">
                  {parsedQuestion.tags.map((t, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-400"
                    >
                      <Tag className="w-2.5 h-2.5 text-indigo-400" />
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
