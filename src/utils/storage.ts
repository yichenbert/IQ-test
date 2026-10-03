import type { Question, TestSessionResult, LLMConfig, AIBenchmarkSession } from '../types'
import { INITIAL_QUESTIONS } from '../data/initialQuestions'

const STORAGE_KEYS = {
  QUESTIONS: 'ai_iq_test_questions_v2',
  HISTORY: 'ai_iq_test_history_v1',
  LLM_CONFIG: 'ai_iq_test_llm_config_v1',
  AI_BENCHMARK_HISTORY: 'ai_iq_test_ai_benchmark_history_v1',
}

export function loadQuestions(): Question[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.QUESTIONS)
    if (!raw) {
      // Check v1 fallback
      const oldRaw = localStorage.getItem('ai_iq_test_questions_v1')
      if (oldRaw) {
        const oldParsed = JSON.parse(oldRaw)
        if (Array.isArray(oldParsed) && oldParsed.length > 0) {
          // Merge missing initial questions
          const existingIds = new Set(oldParsed.map((q: Question) => q.id))
          const merged = [...oldParsed]
          for (const initQ of INITIAL_QUESTIONS) {
            if (!existingIds.has(initQ.id)) {
              merged.push(initQ)
            }
          }
          saveQuestions(merged)
          return merged
        }
      }
      saveQuestions(INITIAL_QUESTIONS)
      return INITIAL_QUESTIONS
    }
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Merge any new initial questions by ID
      const existingIds = new Set(parsed.map((q: Question) => q.id))
      let hasNew = false
      const merged = [...parsed]
      for (const initQ of INITIAL_QUESTIONS) {
        if (!existingIds.has(initQ.id)) {
          merged.push(initQ)
          hasNew = true
        }
      }
      if (hasNew) {
        saveQuestions(merged)
      }
      return merged
    }
    return INITIAL_QUESTIONS
  } catch (e) {
    console.error('Failed to load questions from localStorage', e)
    return INITIAL_QUESTIONS
  }
}

export function saveQuestions(questions: Question[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions))
  } catch (e) {
    console.error('Failed to save questions to localStorage', e)
  }
}

export function resetQuestionsToDefault(): Question[] {
  saveQuestions(INITIAL_QUESTIONS)
  return INITIAL_QUESTIONS
}

export function loadLLMConfig(): LLMConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LLM_CONFIG)
    if (raw) {
      return JSON.parse(raw)
    }
  } catch (e) {
    console.error('Failed to load LLM config', e)
  }
  return {
    apiKey: '',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    temperature: 0.1,
  }
}

export function saveLLMConfig(config: LLMConfig): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LLM_CONFIG, JSON.stringify(config))
  } catch (e) {
    console.error('Failed to save LLM config', e)
  }
}

export function loadTestHistory(): TestSessionResult[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HISTORY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.error('Failed to load test history', e)
  }
  return []
}

export function saveTestResult(result: TestSessionResult): void {
  try {
    const history = loadTestHistory()
    history.unshift(result)
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history.slice(0, 50)))
  } catch (e) {
    console.error('Failed to save test result', e)
  }
}

export function loadAIBenchmarkHistory(): AIBenchmarkSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AI_BENCHMARK_HISTORY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.error('Failed to load AI benchmark history', e)
  }
  return []
}

export function saveAIBenchmarkSession(session: AIBenchmarkSession): void {
  try {
    const history = loadAIBenchmarkHistory()
    history.unshift(session)
    localStorage.setItem(STORAGE_KEYS.AI_BENCHMARK_HISTORY, JSON.stringify(history.slice(0, 50)))
  } catch (e) {
    console.error('Failed to save AI benchmark session', e)
  }
}

