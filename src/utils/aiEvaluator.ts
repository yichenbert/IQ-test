import type { Question, LLMConfig, AIEvalItemResult } from '../types'

export function buildQuestionPrompt(q: Question): string {
  let prompt = `你正在参加一项高难度专业智商与高等数学能力测试（涵盖微积分、李代数、拓扑几何、动力系统与概率论）。请仔细审题并给出严密、详尽的推导过程。\n\n`
  prompt += `【题目】: ${q.title}\n`
  if (q.description) {
    prompt += `${q.description}\n\n`
  }

  if (q.type === 'free-response') {
    prompt += `【题目类型】: 解答题 / 证明大题\n`
    prompt += `【回答要求】:\n`
    prompt += `1. 请给出完整严密、推导连贯的数学解答或形式化证明步骤，运用 LaTeX 书写所有数学公式。\n`
    prompt += `2. 在回答的末尾，若有问题结论或最终数值/表达式，请以单独一行清晰标出：\n`
    prompt += `FINAL_CONCLUSION: [核心结论、极限值、数量级或证明完成]\n`
  } else if (q.options && q.options.length > 0) {
    prompt += `【选项】:\n`
    q.options.forEach(opt => {
      prompt += `${opt.label}. ${opt.text}\n`
    })
    prompt += `\n`
    prompt += `【回答要求】:\n`
    prompt += `1. 运用严谨的数学推导与逻辑分析，逐步解构问题。\n`
    prompt += `2. 在输出的最后一行，必须严格按照此格式输出最终答案：\n`
    prompt += `FINAL_ANSWER: [你的答案字母，例如: FINAL_ANSWER: B]\n`
  } else {
    prompt += `【回答要求】:\n`
    prompt += `1. 给出推导过程。\n`
    prompt += `2. 在最后一行输出最终数值或答案：FINAL_ANSWER: [你的答案]\n`
  }

  return prompt
}

export function extractAnswerFromAIResponse(text: string): string {
  if (!text) return ''

  // 1. Look for FINAL_CONCLUSION: X
  const conclusionMatch = text.match(/(?:FINAL_CONCLUSION|核心结论|结论)\s*[:：]\s*[*_`]*([^\n]+)[*_`]*/i)
  if (conclusionMatch && conclusionMatch[1]) {
    return conclusionMatch[1].trim()
  }

  // 2. Look for FINAL_ANSWER: X or ANSWER: X
  const finalAnswerMatch = text.match(/(?:FINAL_ANSWER|ANSWER|最终答案|答案)\s*[:：]\s*[*_`]*([A-Za-z0-9_\-./]+)[*_`]*/i)
  if (finalAnswerMatch && finalAnswerMatch[1]) {
    return finalAnswerMatch[1].trim().toUpperCase()
  }

  // 3. Look for "故选 B" or "因此选 A"
  const guxuanMatch = text.match(/(?:故选|因此选|选择|答案是|正确答案是)\s*[*_`]*([A-D])[*_`]*/i)
  if (guxuanMatch && guxuanMatch[1]) {
    return guxuanMatch[1].trim().toUpperCase()
  }

  // 4. Fallback: check last non-empty line
  const lines = text.trim().split('\n').filter(l => l.trim().length > 0)
  if (lines.length > 0) {
    const lastLine = lines[lines.length - 1]
    const singleLetter = lastLine.match(/\b([A-D])\b/)
    if (singleLetter) {
      return singleLetter[1].toUpperCase()
    }
  }

  return '已生成证明与推导'
}

export function checkAnswerCorrectness(userOrAIAnswer: string, correctAnswer: string | string[]): boolean {
  if (!userOrAIAnswer) return false
  const cleanAns = userOrAIAnswer.trim().toLowerCase()

  if (Array.isArray(correctAnswer)) {
    return correctAnswer.map(c => c.trim().toLowerCase()).includes(cleanAns)
  }

  const cleanCorrect = correctAnswer.trim().toLowerCase()
  if (cleanAns === cleanCorrect) return true

  // For free-response or proofs
  if (cleanAns.includes(cleanCorrect) || cleanCorrect.includes(cleanAns)) return true

  // If both contain key math symbols e.g. 1/2, 1/16, pi/4
  if (cleanCorrect.replace(/\s+/g, '') === cleanAns.replace(/\s+/g, '')) return true

  return false
}

export async function evaluateQuestionWithAI(
  q: Question,
  config: LLMConfig,
  signal?: AbortSignal
): Promise<AIEvalItemResult> {
  const startTime = Date.now()
  const prompt = buildQuestionPrompt(q)

  let cleanBaseUrl = (config.baseURL || 'https://api.openai.com/v1').trim()
  if (cleanBaseUrl.endsWith('/')) {
    cleanBaseUrl = cleanBaseUrl.slice(0, -1)
  }
  const endpoint = `${cleanBaseUrl}/chat/completions`

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`
    }

    const payload = {
      model: config.model || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an elite reasoning intelligence and grandmaster in mathematics, logic, probability, and spatial science. Analyze problems rigorously with formal proofs.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: config.temperature ?? 0.1,
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal,
    })

    const latencyMs = Date.now() - startTime

    if (!response.ok) {
      const errText = await response.text()
      return {
        questionId: q.id,
        questionTitle: q.title,
        correctAnswer: q.answer,
        aiRawResponse: '',
        extractedAnswer: 'ERROR',
        isCorrect: false,
        latencyMs,
        error: `HTTP ${response.status}: ${errText.slice(0, 300)}`,
      }
    }

    const data = await response.json()
    const choice = data.choices?.[0]
    const content = choice?.message?.content || ''
    const reasoning = choice?.message?.reasoning_content || ''

    let parsedContent = content
    let finalReasoning = reasoning
    const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/)
    if (thinkMatch) {
      finalReasoning = thinkMatch[1].trim()
      parsedContent = content.replace(/<think>[\s\S]*?<\/think>/, '').trim()
    }

    const extracted = extractAnswerFromAIResponse(parsedContent || content)
    const isCorrect = checkAnswerCorrectness(extracted, q.answer)

    return {
      questionId: q.id,
      questionTitle: q.title,
      correctAnswer: q.answer,
      aiRawResponse: parsedContent || content,
      aiReasoning: finalReasoning || undefined,
      extractedAnswer: extracted,
      isCorrect,
      latencyMs,
    }
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime
    const message = err instanceof Error ? err.message : String(err)
    return {
      questionId: q.id,
      questionTitle: q.title,
      correctAnswer: q.answer,
      aiRawResponse: '',
      extractedAnswer: 'REQUEST_FAILED',
      isCorrect: false,
      latencyMs,
      error: message,
    }
  }
}

