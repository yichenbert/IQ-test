import { useState, useEffect } from 'react'
import type { Question, TestSessionResult, LLMConfig, AIBenchmarkSession } from './types'
import {
  loadQuestions,
  saveQuestions,
  resetQuestionsToDefault,
  loadLLMConfig,
  saveLLMConfig,
  loadTestHistory,
  saveTestResult,
  loadAIBenchmarkHistory,
  saveAIBenchmarkSession,
} from './utils/storage'
import { Header, type TabType } from './components/Header'
import { QuestionBank } from './components/QuestionBank'
import { TestArena } from './components/TestArena'
import { AIBenchmark } from './components/AIBenchmark'
import { HistoryRecords } from './components/HistoryRecords'
import { QuestionModal } from './components/QuestionModal'
import { AIQuestionImporter } from './components/AIQuestionImporter'

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('bank')
  const [questions, setQuestions] = useState<Question[]>([])
  const [llmConfig, setLlmConfig] = useState<LLMConfig>(loadLLMConfig)
  const [humanHistory, setHumanHistory] = useState<TestSessionResult[]>([])
  const [aiHistory, setAiHistory] = useState<AIBenchmarkSession[]>([])

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)

  // Initialize data from local storage
  useEffect(() => {
    setQuestions(loadQuestions())
    setLlmConfig(loadLLMConfig())
    setHumanHistory(loadTestHistory())
    setAiHistory(loadAIBenchmarkHistory())
  }, [])

  // Question CRUD handlers
  const handleSaveQuestion = (q: Question) => {
    let updated: Question[]
    if (editingQuestion) {
      updated = questions.map(item => (item.id === q.id ? q : item))
    } else {
      updated = [q, ...questions]
    }
    setQuestions(updated)
    saveQuestions(updated)
  }

  const handleDeleteQuestion = (id: string) => {
    const updated = questions.filter(q => q.id !== id)
    setQuestions(updated)
    saveQuestions(updated)
  }

  const handleOpenAddModal = () => {
    setEditingQuestion(null)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (q: Question) => {
    setEditingQuestion(q)
    setIsModalOpen(true)
  }

  const handleImportQuestions = (imported: Question[]) => {
    // Merge or replace
    const existingIds = new Set(questions.map(q => q.id))
    const merged = [...questions]
    imported.forEach(q => {
      if (existingIds.has(q.id)) {
        const idx = merged.findIndex(x => x.id === q.id)
        merged[idx] = q
      } else {
        merged.push(q)
      }
    })
    setQuestions(merged)
    saveQuestions(merged)
  }

  const handleExportQuestions = () => {
    const jsonStr = JSON.stringify(questions, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `AI_IQ_Question_Bank_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleResetDefault = () => {
    const defaultList = resetQuestionsToDefault()
    setQuestions(defaultList)
  }

  const handleSaveTestResult = (result: TestSessionResult) => {
    saveTestResult(result)
    setHumanHistory(loadTestHistory())
  }

  const handleSaveBenchmark = (session: AIBenchmarkSession) => {
    saveAIBenchmarkSession(session)
    setAiHistory(loadAIBenchmarkHistory())
  }

  const handleSaveConfig = (cfg: LLMConfig) => {
    setLlmConfig(cfg)
    saveLLMConfig(cfg)
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-200 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        totalQuestions={questions.length}
        onAddNew={handleOpenAddModal}
      />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'bank' && (
          <QuestionBank
            questions={questions}
            onAddQuestion={handleOpenAddModal}
            onOpenAIImport={() => setActiveTab('ai-import')}
            onEditQuestion={handleOpenEditModal}
            onDeleteQuestion={handleDeleteQuestion}
            onImportQuestions={handleImportQuestions}
            onExportQuestions={handleExportQuestions}
            onResetDefault={handleResetDefault}
          />
        )}

        {activeTab === 'ai-import' && (
          <AIQuestionImporter
            config={llmConfig}
            onSaveConfig={handleSaveConfig}
            onAddQuestionToBank={handleSaveQuestion}
            onBatchAddQuestions={handleImportQuestions}
            onNavigateToBank={() => setActiveTab('bank')}
          />
        )}

        {activeTab === 'test' && (
          <TestArena
            questions={questions}
            onSaveResult={handleSaveTestResult}
            onExitToBank={() => setActiveTab('bank')}
          />
        )}

        {activeTab === 'ai-bench' && (
          <AIBenchmark
            questions={questions}
            config={llmConfig}
            onSaveConfig={handleSaveConfig}
            onSaveBenchmark={handleSaveBenchmark}
          />
        )}

        {activeTab === 'history' && (
          <HistoryRecords
            humanHistory={humanHistory}
            aiHistory={aiHistory}
            onClearHumanHistory={() => {
              localStorage.removeItem('ai_iq_test_history_v1')
              setHumanHistory([])
            }}
            onClearAIHistory={() => {
              localStorage.removeItem('ai_iq_test_ai_benchmark_history_v1')
              setAiHistory([])
            }}
          />
        )}
      </main>

      {/* Add / Edit Question Modal */}
      <QuestionModal
        isOpen={isModalOpen}
        questionToEdit={editingQuestion}
        config={llmConfig}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveQuestion}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/40 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>AI-IQ Matrix · 高阶智能体与数理逻辑基准测试平台</span>
          <span className="font-mono text-[11px] text-slate-600">
            Powered by KaTeX · React · Tailwind CSS
          </span>
        </div>
      </footer>
    </div>
  )
}

export default App
