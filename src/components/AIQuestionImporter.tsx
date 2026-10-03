import React, { useState, useRef, useEffect } from 'react'
import type { Question, LLMConfig, Category, Difficulty, QuestionType } from '../types'
import { recognizeQuestionWithAI, polishAnswerAndProofWithAI } from '../utils/aiVisionImporter'
import { parsePdfDocument, batchExtractQuestionsFromPdfWithAI, type PdfParseResult } from '../utils/pdfExtractor'
import { exportConfigToken, importConfigToken } from '../utils/security'
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
  BookOpen,
  ArrowRight,
  Wand2,
  FileText,
  Eye,
  EyeOff,
  ShieldCheck,
  Lock,
  Download,
  FolderPlus,
  Trash2,
  Layers,
} from 'lucide-react'

interface AIQuestionImporterProps {
  config: LLMConfig
  onSaveConfig: (cfg: LLMConfig) => void
  onAddQuestionToBank: (q: Question) => void
  onBatchAddQuestions?: (questions: Question[]) => void
  onNavigateToBank: () => void
}

export const AIQuestionImporter: React.FC<AIQuestionImporterProps> = ({
  config,
  onSaveConfig,
  onAddQuestionToBank,
  onBatchAddQuestions,
  onNavigateToBank,
}) => {
  // Mode switcher: Single image/text vs PDF batch
  const [importerTab, setImporterTab] = useState<'single' | 'pdf'>('single')

  // Config state
  const [showConfig, setShowConfig] = useState(!config.apiKey)
  const [localConfig, setLocalConfig] = useState<LLMConfig>(config)
  const [showApiKeyPlain, setShowApiKeyPlain] = useState(false)
  const [importTokenInput, setImportTokenInput] = useState('')
  const [showTokenModal, setShowTokenModal] = useState(false)
  const [copyTokenSuccess, setCopyTokenSuccess] = useState(false)

  // Single Question Input states
  const [imageBase64, setImageBase64] = useState<string>('')
  const [imageName, setImageName] = useState<string>('')
  const [rawText, setRawText] = useState<string>('')
  const [userRawNotes, setUserRawNotes] = useState<string>('')

  // Parsing / status states for single
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPolishing, setIsPolishing] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successSaved, setSuccessSaved] = useState(false)
  const [parsedQuestion, setParsedQuestion] = useState<Question | null>(null)

  // PDF Document Batch Import states
  const [pdfParseResult, setPdfParseResult] = useState<PdfParseResult | null>(null)
  const [isParsingPdf, setIsParsingPdf] = useState(false)
  const [pdfProgress, setPdfProgress] = useState<{ current: number; total: number } | null>(null)
  const [targetCategoryName, setTargetCategoryName] = useState<string>('')
  const [pdfUserNotes, setPdfUserNotes] = useState<string>('')
  const [isBatchExtracting, setIsBatchExtracting] = useState(false)
  const [batchQuestions, setBatchQuestions] = useState<Question[]>([])
  const [pdfStatusMessage, setPdfStatusMessage] = useState('')
  const [pdfErrorMessage, setPdfErrorMessage] = useState('')
  const [pdfBatchSaved, setPdfBatchSaved] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setLocalConfig(config)
  }, [config])

  const handleImageFile = (file: File, fallbackName?: string) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('请选择有效的图片格式（PNG / JPG / WEBP）')
      return
    }

    const reader = new FileReader()
    reader.onload = e => {
      setImageBase64(e.target?.result as string)
      setImageName(file.name || fallbackName || '已选图片')
      setErrorMessage('')
    }
    reader.onerror = () => setErrorMessage('读取图片失败，请重试')
    reader.readAsDataURL(file)
  }

  // Support paste image from clipboard for single import
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (importerTab !== 'single') return
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
  }, [importerTab])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleImageFile(files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  // Handle PDF file selection
  const handlePdfFileSelect = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setPdfErrorMessage('请选择有效的 PDF 文件（.pdf 扩展名）')
      return
    }

    setPdfErrorMessage('')
    setPdfStatusMessage('正在读取 PDF 文档并生成页面预览...')
    setIsParsingPdf(true)
    setPdfBatchSaved(false)
    setBatchQuestions([])

    // 默认分类项名称为文档名称（去除 .pdf）
    const cleanDocName = file.name.replace(/\.pdf$/i, '').trim()
    setTargetCategoryName(cleanDocName || 'PDF试卷真题')

    try {
      const result = await parsePdfDocument(file, 20, (curr, total) => {
        setPdfProgress({ current: curr, total })
      })
      setPdfParseResult(result)
      setPdfStatusMessage(`✅ 文档解析完成！共 ${result.pageCount} 页（提取前 ${result.pages.length} 页），准备进行 AI 批量题意识别。`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setPdfErrorMessage(`PDF 解析异常: ${msg}`)
    } finally {
      setIsParsingPdf(false)
      setPdfProgress(null)
    }
  }

  const handlePdfDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handlePdfFileSelect(files[0])
    }
  }

  // Batch extract questions from PDF with AI
  const handleStartBatchPdfExtract = async () => {
    if (!pdfParseResult) {
      setPdfErrorMessage('请先上传 PDF 文档')
      return
    }
    if (!localConfig.apiKey) {
      setPdfErrorMessage('请先在上方配置 API 密钥 (API Key)')
      setShowConfig(true)
      return
    }
    if (!targetCategoryName.trim()) {
      setPdfErrorMessage('请为这批题目指定一个合并分类项名称')
      return
    }

    setIsBatchExtracting(true)
    setPdfErrorMessage('')
    setPdfStatusMessage('🚀 AI 正在深入剖析 PDF 文本与公式，批量提取独立题目并合并归入该分类项...')
    setPdfBatchSaved(false)

    abortControllerRef.current = new AbortController()

    try {
      const questions = await batchExtractQuestionsFromPdfWithAI({
        pdfResult: pdfParseResult,
        targetCategoryName: targetCategoryName.trim(),
        config: localConfig,
        userNotes: pdfUserNotes.trim() || undefined,
        signal: abortControllerRef.current.signal,
      })

      if (questions.length === 0) {
        setPdfErrorMessage('未能从文档中提取到有效题目，请检查文档内容或调整补充说明')
      } else {
        setBatchQuestions(questions)
        setPdfStatusMessage(`🎉 成功识别出 ${questions.length} 道题目，并已全部合并分类为「${targetCategoryName.trim()}」！请在下方核验。`)
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setPdfStatusMessage('已取消批量提取')
      } else {
        const msg = err instanceof Error ? err.message : String(err)
        setPdfErrorMessage(`批量识别失败: ${msg}`)
      }
    } finally {
      setIsBatchExtracting(false)
      abortControllerRef.current = null
    }
  }

  // Save all batch questions
  const handleSaveAllBatchQuestions = () => {
    if (batchQuestions.length === 0) return
    if (onBatchAddQuestions) {
      onBatchAddQuestions(batchQuestions)
    } else {
      batchQuestions.forEach(q => onAddQuestionToBank(q))
    }
    setPdfBatchSaved(true)
    setPdfStatusMessage(`🎉 全部 ${batchQuestions.length} 道题目已存入题库「${targetCategoryName}」分类项中！`)
  }

  const handleDeleteBatchItem = (index: number) => {
    setBatchQuestions(prev => prev.filter((_, i) => i !== index))
  }

  const handleSaveConfig = () => {
    onSaveConfig(localConfig)
    setShowConfig(false)
    setStatusMessage('接口配置已安全保存！')
    setTimeout(() => setStatusMessage(''), 2500)
  }

  // Export encrypted config token for cross-domain sync (localhost <-> GitHub Pages)
  const handleExportToken = () => {
    const token = exportConfigToken(localConfig, localConfig.accessPasscode)
    navigator.clipboard.writeText(token).then(() => {
      setCopyTokenSuccess(true)
      setTimeout(() => setCopyTokenSuccess(false), 3000)
    }).catch(() => {
      alert(`已生成加密配置包（请手动复制）：\n${token}`)
    })
  }

  // Import config token
  const handleApplyImportToken = () => {
    if (!importTokenInput.trim()) return
    const imported = importConfigToken(importTokenInput.trim(), localConfig.accessPasscode)
    if (imported) {
      setLocalConfig(imported)
      onSaveConfig(imported)
      setShowTokenModal(false)
      setImportTokenInput('')
      setStatusMessage('🎉 接口配置已从配置包安全导入并同步！')
    } else {
      alert('配置包解析失败，可能格式错误或口令不匹配')
    }
  }

  // Trigger single question recognition
  const handleStartRecognition = async () => {
    if (!imageBase64 && !rawText.trim()) {
      setErrorMessage('请至少上传一张图片或输入一段题目文字')
      return
    }

    if (!localConfig.apiKey) {
      setErrorMessage('请先在上方配置 API 密钥 (API Key)')
      setShowConfig(true)
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
        options: parsedQuestion.options,
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
                AI 智能文档录题与题目全自动排版
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              支持上传试卷截图、单题手写拍照，或<strong>整份 PDF 试卷文档批量识别并统一合并为一个分类项</strong>。
              多模态 AI 将自动识别公式 LaTeX、判定题型，并在后续编辑中支持由 AI 识别您的解题草稿规范排版。
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-950 hover:bg-slate-900 text-slate-300 border border-slate-800 transition-colors"
            >
              <Settings className="w-4 h-4 text-indigo-400" />
              <span>AI 接口与防盗设置</span>
              {showConfig ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* API Settings & Protection Section */}
        {showConfig && (
          <div className="mt-6 pt-5 border-t border-slate-800/80 space-y-4 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" />
                模型接口与安全防盗保护设置
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportToken}
                  className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-500/30 transition-colors"
                  title="导出加密配置，在挂载的 GitHub Pages 上一键同步"
                >
                  <Download className="w-3 h-3" />
                  <span>{copyTokenSuccess ? '✅ 已复制配置包' : '导出配置包 (跨站同步)'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowTokenModal(true)}
                  className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                >
                  <FolderPlus className="w-3 h-3 text-cyan-400" />
                  <span>导入配置包</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Key className="w-3 h-3 text-amber-400" />
                    API Key (脱敏防偷)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowApiKeyPlain(!showApiKeyPlain)}
                    className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-0.5"
                  >
                    {showApiKeyPlain ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showApiKeyPlain ? '隐藏' : '显示'}</span>
                  </button>
                </label>
                <input
                  type={showApiKeyPlain ? 'text' : 'password'}
                  value={localConfig.apiKey}
                  onChange={e => setLocalConfig({ ...localConfig, apiKey: e.target.value })}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1">
                  <ImageIcon className="w-3 h-3 text-purple-400" />
                  识别模型
                </label>
                <input
                  type="text"
                  value={localConfig.model}
                  onChange={e => setLocalConfig({ ...localConfig, model: e.target.value })}
                  placeholder="gpt-4o / qwen-vl-max"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-emerald-400" />
                  防盗访问口令 (Passcode)
                </label>
                <input
                  type="text"
                  value={localConfig.accessPasscode || ''}
                  onChange={e => setLocalConfig({ ...localConfig, accessPasscode: e.target.value })}
                  placeholder="留空即无需口令"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-800/40 text-xs">
              <div className="flex items-center gap-2 text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  <strong>安全说明：</strong>API Key 仅保存在您本地浏览器中，Git 仓库已忽略密钥文件。挂载到 GitHub Pages 后若因跨域隔离未读取，可点击上方「导出配置包」并粘贴导入，永不丢失！
                </span>
              </div>
              <button
                onClick={handleSaveConfig}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shrink-0"
              >
                保存接口配置
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Import Encrypted Token */}
      {showTokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-indigo-400" />
                导入并同步 API 配置包
              </h4>
              <button
                onClick={() => setShowTokenModal(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              在本地环境中点击「导出配置包」复制后，在此粘贴，即可一键将 API Key 与模型配置同步到 GitHub Pages 挂载站点，安全且无需重新手输。
            </p>
            <textarea
              rows={4}
              value={importTokenInput}
              onChange={e => setImportTokenInput(e.target.value)}
              placeholder="在此粘贴导出的加密配置包字符串..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowTokenModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                取消
              </button>
              <button
                onClick={handleApplyImportToken}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                确认导入配置
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature Selector Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setImporterTab('single')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            importerTab === 'single'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 border border-slate-800'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>📷 单题识图 / 粘贴录入</span>
        </button>

        <button
          onClick={() => setImporterTab('pdf')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            importerTab === 'pdf'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-purple-600/30'
              : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 border border-slate-800'
          }`}
        >
          <FileText className="w-4 h-4 text-purple-400" />
          <span>📄 PDF 试卷批量识别与合并分类</span>
          <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-md border border-purple-500/30">
            新功能
          </span>
        </button>
      </div>

      {/* ===================== TAB 1: SINGLE QUESTION ===================== */}
      {importerTab === 'single' && (
        <div className="space-y-6">
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
                  <div className="py-8 space-y-3 flex flex-col items-center justify-center">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-indigo-400 flex items-center justify-center border border-slate-700">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs sm:text-sm font-semibold text-slate-200">
                        拖拽试卷图片至此处，或{' '}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                        >
                          浏览本地文件
                        </button>
                      </p>
                      <p className="text-[11px] text-slate-500">
                        支持快捷键 <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-400 font-mono">Cmd+V</kbd> / <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-400 font-mono">Ctrl+V</kbd> 贴图
                      </p>
                    </div>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) handleImageFile(f)
                  }}
                />
              </div>

              {/* Text supplement */}
              <div className="space-y-1.5 pt-2">
                <label className="block text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>纯文本 / 辅助描述补充 (可选)</span>
                  <span className="text-[10px] text-slate-500 font-normal">支持直接粘贴题干原文字</span>
                </label>
                <textarea
                  rows={4}
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                  placeholder="若图片部分文字模糊，或您直接想用纯文本录入题目，可在此粘贴..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Right: Rough Draft & AI Prompting */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-sm space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <span className="text-sm font-bold text-white flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-purple-400" />
                    2. 手动答案草稿与思路 (核心提效)
                  </span>
                  <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/30">
                    AI 自动扩充与 LaTeX 化
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-300">
                    输入您的简要解题思路、粗略答案草稿：
                  </label>
                  <textarea
                    rows={7}
                    value={userRawNotes}
                    onChange={e => setUserRawNotes(e.target.value)}
                    placeholder="例如：'结论选C，设停时tau，根据强马尔可夫性对称展开...'&#10;或者只输入简单结果：'答案是 1/2'&#10;&#10;（若留空，AI 将尝试自行从零推导官方证明）"
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 leading-relaxed font-sans"
                  />
                  <p className="text-[11px] text-slate-400 leading-normal">
                    💡 <strong>无须费心敲公式排版：</strong>即使您只写零散草稿，AI 也会提炼其核心结论，并自动排版为步骤严谨、富含标准 LaTeX 公式的完整题解！
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    disabled={isProcessing}
                    onClick={handleStartRecognition}
                    className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isProcessing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>多模态高精度提取中...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>⚡ 开始 AI 识图与规范排版入库</span>
                      </>
                    )}
                  </button>

                  {parsedQuestion && (
                    <button
                      disabled={isPolishing}
                      onClick={handlePolishAnswerOnly}
                      className="px-3.5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 font-semibold text-xs border border-slate-700 transition-colors flex items-center gap-1.5"
                    >
                      {isPolishing ? (
                        <div className="w-3.5 h-3.5 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      <span>重新润色答案排版</span>
                    </button>
                  )}
                </div>

                {/* Status and feedback */}
                {statusMessage && (
                  <div className="text-xs text-indigo-300 bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{statusMessage}</span>
                  </div>
                )}
                {errorMessage && (
                  <div className="text-xs text-rose-300 bg-rose-950/40 border border-rose-500/30 rounded-xl p-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Parsed Single Question Review Card */}
          {parsedQuestion && (
            <div className="bg-slate-900/80 border border-indigo-500/30 rounded-3xl p-6 sm:p-8 backdrop-blur-sm space-y-6 shadow-xl animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                      识别结果核验
                    </span>
                    <h3 className="text-lg font-bold text-white tracking-tight">
                      {parsedQuestion.title}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400">
                    请核对题目题型、公式渲染与证明过程。如有细微偏差可在左侧直接修改，确认后存入题库。
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleReset}
                    className="px-3.5 py-2 rounded-xl text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                  >
                    重置清空
                  </button>
                  <button
                    onClick={handleSaveToBank}
                    disabled={successSaved}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {successSaved ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>已存入题库！</span>
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
                      onClick={onNavigateToBank}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-1"
                    >
                      <span>前往题库查看</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Two columns: Left editable fields, Right preview */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Edit Form */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    字段微调修改 (支持 LaTeX 公式)
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">题目标题</label>
                      <input
                        type="text"
                        value={parsedQuestion.title}
                        onChange={e => setParsedQuestion({ ...parsedQuestion, title: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">所属分类</label>
                        <input
                          type="text"
                          value={parsedQuestion.category}
                          onChange={e => setParsedQuestion({ ...parsedQuestion, category: e.target.value as Category })}
                          className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">难度等级</label>
                        <select
                          value={parsedQuestion.difficulty}
                          onChange={e => setParsedQuestion({ ...parsedQuestion, difficulty: e.target.value as Difficulty })}
                          className="w-full px-2 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                        >
                          <option value="easy">基础</option>
                          <option value="medium">中等</option>
                          <option value="hard">困难</option>
                          <option value="genius">大师</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">题型判定</label>
                        <select
                          value={parsedQuestion.type}
                          onChange={e => setParsedQuestion({ ...parsedQuestion, type: e.target.value as QuestionType })}
                          className="w-full px-2 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                        >
                          <option value="single-choice">单项选择题</option>
                          <option value="multiple-choice">多项选择题</option>
                          <option value="fill-blank">填空/数值题</option>
                          <option value="free-response">解答/证明大题</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">题干内容</label>
                      <textarea
                        rows={4}
                        value={parsedQuestion.description}
                        onChange={e => setParsedQuestion({ ...parsedQuestion, description: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">标准核心答案</label>
                      <input
                        type="text"
                        value={Array.isArray(parsedQuestion.answer) ? parsedQuestion.answer.join(', ') : parsedQuestion.answer}
                        onChange={e => setParsedQuestion({ ...parsedQuestion, answer: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">详细推导与证明解析</label>
                      <textarea
                        rows={5}
                        value={parsedQuestion.explanation}
                        onChange={e => setParsedQuestion({ ...parsedQuestion, explanation: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Right: Live KaTeX Preview */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    KaTeX 公式真实渲染预览
                  </h4>

                  <div className="space-y-3">
                    <div className="text-sm font-semibold text-white leading-relaxed">
                      <MathRenderer content={parsedQuestion.description || parsedQuestion.title} />
                    </div>

                    {parsedQuestion.options && parsedQuestion.options.length > 0 && (
                      <div className="space-y-2 pt-2">
                        {parsedQuestion.options.map(opt => (
                          <div
                            key={opt.id}
                            className={`p-2.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                              opt.label === parsedQuestion.answer
                                ? 'bg-indigo-950/40 border-indigo-500/50'
                                : 'bg-slate-900 border-slate-800'
                            }`}
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
                    )}

                    <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/40 space-y-2">
                      <div className="flex items-center justify-between text-xs pb-1.5 border-b border-emerald-900/40">
                        <span className="font-semibold text-emerald-400">
                          {parsedQuestion.type === 'free-response' ? '证明与推导：' : '公式推导与详细题解：'}
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
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================== TAB 2: PDF DOCUMENT BATCH EXTRACTION ===================== */}
      {importerTab === 'pdf' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: PDF Dropzone & Document Info */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-400" />
                  1. 上传 PDF 试卷文档
                </span>
                <span className="text-[11px] text-slate-400">支持竞赛真题卷、测验试卷</span>
              </div>

              {/* PDF Dropzone */}
              <div
                onDrop={handlePdfDrop}
                onDragOver={handleDragOver}
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                  pdfParseResult
                    ? 'border-purple-500/50 bg-purple-950/10'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'
                }`}
              >
                {isParsingPdf ? (
                  <div className="py-8 space-y-3 flex flex-col items-center justify-center">
                    <div className="w-10 h-10 border-3 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                    <p className="text-xs text-purple-300 font-semibold">
                      正在解析 PDF 页面... {pdfProgress ? `(${pdfProgress.current}/${pdfProgress.total} 页)` : ''}
                    </p>
                  </div>
                ) : pdfParseResult ? (
                  <div className="space-y-4 text-left">
                    <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white truncate max-w-xs sm:max-w-sm">
                            {pdfParseResult.fileName}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            共 {pdfParseResult.pageCount} 页 · 提取字符数: {pdfParseResult.fullText.length}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => pdfInputRef.current?.click()}
                        className="text-xs text-purple-400 hover:text-purple-300 underline"
                      >
                        更换文件
                      </button>
                    </div>

                    {/* Page Thumbnails preview */}
                    {pdfParseResult.pages.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-semibold text-slate-400">页面预览采样：</span>
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                          {pdfParseResult.pages.map(p => (
                            <div
                              key={p.pageNum}
                              className="shrink-0 w-24 h-32 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden flex flex-col items-center justify-between p-1"
                            >
                              {p.thumbnailUrl ? (
                                <img
                                  src={p.thumbnailUrl}
                                  alt={`第 ${p.pageNum} 页`}
                                  className="w-full h-24 object-cover rounded"
                                />
                              ) : (
                                <div className="w-full h-24 flex items-center justify-center text-[10px] text-slate-600">
                                  文本页
                                </div>
                              )}
                              <span className="text-[10px] font-mono text-slate-400">第 {p.pageNum} 页</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-8 space-y-3 flex flex-col items-center justify-center">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-purple-400 flex items-center justify-center border border-slate-700">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs sm:text-sm font-semibold text-slate-200">
                        拖拽 PDF 文件至此处，或{' '}
                        <button
                          type="button"
                          onClick={() => pdfInputRef.current?.click()}
                          className="text-purple-400 hover:text-purple-300 underline cursor-pointer"
                        >
                          浏览本地 PDF
                        </button>
                      </p>
                      <p className="text-[11px] text-slate-500">
                        支持将整份试卷或文档提取并自动合并为一个分类项
                      </p>
                    </div>
                  </div>
                )}

                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) handlePdfFileSelect(f)
                  }}
                />
              </div>

              {/* Text extract preview */}
              {pdfParseResult && (
                <div className="space-y-1.5 pt-1">
                  <label className="block text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>提取文本摘要</span>
                    <span className="text-[10px] text-slate-500 font-mono">前 500 字</span>
                  </label>
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400 font-mono max-h-24 overflow-y-auto leading-relaxed">
                    {pdfParseResult.fullText.slice(0, 500)}...
                  </div>
                </div>
              )}
            </div>

            {/* Right: Classification Target & Batch Settings */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-sm space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <span className="text-sm font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    2. 自动合并为一个分类项
                  </span>
                  <span className="text-[10px] text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/30">
                    一键聚类成库
                  </span>
                </div>

                {/* Target Category Name */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-indigo-300 flex items-center justify-between">
                    <span>合并分类项名称 (分类标签) *</span>
                    <span className="text-[10px] text-slate-400 font-normal">题库中将以此作为专属标签</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={targetCategoryName}
                      onChange={e => setTargetCategoryName(e.target.value)}
                      placeholder="例如：2024丘成桐女子数学竞赛、高数期中测试卷..."
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-indigo-500/40 rounded-xl text-xs sm:text-sm text-white font-medium focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    🌟 <strong>智能聚类效果：</strong>识别出的所有题目都会打上此分类项。在「题库中心」顶部会出现此分类标签，点击即可一键筛选或挑战此 PDF 试卷全套题目！
                  </p>
                </div>

                {/* Optional Instructions */}
                <div className="space-y-1.5 pt-1">
                  <label className="block text-xs font-medium text-slate-300">
                    补充说明或解析要求 (可选)
                  </label>
                  <textarea
                    rows={3}
                    value={pdfUserNotes}
                    onChange={e => setPdfUserNotes(e.target.value)}
                    placeholder="例如：'仅提取前10题选择题'，或'请严格保留几何图中的坐标符号'..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Notice on pending answers */}
                <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-3 text-xs text-slate-300 space-y-1">
                  <div className="font-semibold text-indigo-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>关于试卷文档无答案的处理说明</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    若导入的试卷本身未附带答案，系统将标记为「待补充答案」。导入后，您只需在<strong>「题库中心」点击该题的「编辑」</strong>，即可随时在弹窗中使用<strong>「AI 识别我的答案并智能排版」</strong>功能，一键将您的简要思路扩充为官方规范的 LaTeX 推导！
                  </p>
                </div>
              </div>

              {/* Start Extraction Action */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <button
                  disabled={!pdfParseResult || isBatchExtracting}
                  onClick={handleStartBatchPdfExtract}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-500 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isBatchExtracting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>AI 正在批量拆解题目并整理 LaTeX 公式...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>⚡ 开始 AI 批量识别与归类解析</span>
                    </>
                  )}
                </button>

                {pdfStatusMessage && (
                  <div className="text-xs text-indigo-300 bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{pdfStatusMessage}</span>
                  </div>
                )}
                {pdfErrorMessage && (
                  <div className="text-xs text-rose-300 bg-rose-950/40 border border-rose-500/30 rounded-xl p-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{pdfErrorMessage}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Batch Result Review List */}
          {batchQuestions.length > 0 && (
            <div className="bg-slate-900/80 border border-purple-500/30 rounded-3xl p-6 sm:p-8 backdrop-blur-sm space-y-6 shadow-2xl animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-purple-300 bg-purple-500/20 px-2.5 py-0.5 rounded-full border border-purple-500/30">
                      分类项：{targetCategoryName}
                    </span>
                    <h3 className="text-lg font-bold text-white tracking-tight">
                      已提取出 {batchQuestions.length} 道独立题目
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400">
                    所有题目已统一归并在该分类项下。您可以逐一核阅，支持移除不需要的内容，确认后一键存入题库。
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleSaveAllBatchQuestions}
                    disabled={pdfBatchSaved}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {pdfBatchSaved ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>已全部存入题库！</span>
                      </>
                    ) : (
                      <>
                        <PlusCircle className="w-4 h-4" />
                        <span>📥 一键全部存入题库 ({batchQuestions.length} 题)</span>
                      </>
                    )}
                  </button>

                  {pdfBatchSaved && (
                    <button
                      onClick={onNavigateToBank}
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>前往题库中心查看</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Cards List */}
              <div className="space-y-4">
                {batchQuestions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="bg-slate-950/70 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 space-y-3 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-indigo-600/20 text-indigo-400 font-mono font-bold text-xs flex items-center justify-center border border-indigo-500/30">
                          #{idx + 1}
                        </span>
                        <h4 className="text-sm font-bold text-white">{q.title}</h4>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30">
                          {q.category}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                          {q.type === 'single-choice'
                            ? '单选题'
                            : q.type === 'multiple-choice'
                            ? '多选题'
                            : q.type === 'fill-blank'
                            ? '填空题'
                            : '解答大题'}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteBatchItem(idx)}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded-lg hover:bg-slate-900 transition-colors"
                        title="移除此题目"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Question Content */}
                    <div className="text-xs sm:text-sm text-slate-200 leading-relaxed pl-8">
                      <MathRenderer content={q.description || q.title} />
                    </div>

                    {/* Options if any */}
                    {q.options && q.options.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-8 pt-1">
                        {q.options.map(opt => (
                          <div
                            key={opt.id}
                            className={`p-2 rounded-lg text-xs flex items-start gap-2 border ${
                              opt.label === q.answer
                                ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-200'
                                : 'bg-slate-900 border-slate-800/80 text-slate-300'
                            }`}
                          >
                            <span className="font-bold text-slate-400">{opt.label}.</span>
                            <div>
                              <MathRenderer content={opt.text} inline />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Answer & Explanation status */}
                    <div className="pl-8 pt-2">
                      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-400">参考答案:</span>
                          <span className={`font-mono px-2 py-0.5 rounded ${
                            q.answer === '待补充答案'
                              ? 'bg-amber-950/40 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30'
                          }`}>
                            {Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 italic">
                          {q.answer === '待补充答案' ? '后续可在题库点击「编辑」，由 AI 识别草稿一键排版' : '已提取解析'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
