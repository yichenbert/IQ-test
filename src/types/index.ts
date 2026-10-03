export type Difficulty = 'easy' | 'medium' | 'hard' | 'genius'

export type PresetCategory = 
  | 'math' 
  | 'logic' 
  | 'spatial' 
  | 'probability' 
  | 'algorithm' 
  | 'deduction'

export type Category = PresetCategory | (string & {})

export type QuestionType = 'single-choice' | 'multiple-choice' | 'fill-blank' | 'free-response'

export interface OptionItem {
  id: string
  label: string // 'A' | 'B' | 'C' | 'D' etc.
  text: string
}

export interface Question {
  id: string
  title: string
  description?: string
  category: Category
  difficulty: Difficulty
  type: QuestionType
  options?: OptionItem[]
  answer: string | string[] // For single-choice / fill-blank: string; for multiple-choice: string[]
  explanation: string
  tags?: string[]
  createdAt: number
  updatedAt: number
}

export interface UserAnswerRecord {
  questionId: string
  userAnswer: string | string[]
  isCorrect: boolean
  timeSpentSeconds: number
}

export interface TestSessionResult {
  id: string
  timestamp: number
  totalQuestions: number
  correctCount: number
  score: number // percentage 0-100
  estimatedIQ: number
  timeSpentSeconds: number
  categoryStats: Record<Category, { total: number; correct: number }>
  records: UserAnswerRecord[]
}

export interface LLMConfig {
  apiKey: string
  baseURL: string
  model: string
  temperature: number
  isKeyProtected?: boolean
  accessPasscode?: string
  maskedKey?: string
}

export interface AIEvalItemResult {
  questionId: string
  questionTitle: string
  correctAnswer: string | string[]
  aiRawResponse: string
  aiReasoning?: string
  extractedAnswer: string
  isCorrect: boolean
  latencyMs: number
  error?: string
}

export interface AIBenchmarkSession {
  id: string
  timestamp: number
  modelName: string
  totalQuestions: number
  correctCount: number
  accuracyRate: number
  estimatedIQ: number
  avgLatencyMs: number
  results: AIEvalItemResult[]
}

