import type { Question, QuestionType, Category, Difficulty, OptionItem, LLMConfig } from '../types'

export interface VisionRecognitionParams {
  imageBase64?: string
  rawText?: string
  userRawNotes?: string
  config: LLMConfig
  signal?: AbortSignal
}

export interface PolishAnswerParams {
  title: string
  description?: string
  type: QuestionType
  userRawNotes: string
  config: LLMConfig
  signal?: AbortSignal
}

function cleanBaseUrl(url: string): string {
  let cleaned = (url || 'https://api.openai.com/v1').trim()
  if (cleaned.endsWith('/')) {
    cleaned = cleaned.slice(0, -1)
  }
  return cleaned
}

function extractJsonFromResponse(raw: string): Record<string, unknown> {
  const trimmed = raw.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    // Try extract from ```json ... ``` or first { ... }
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1].trim())
      } catch {}
    }

    const firstBrace = trimmed.indexOf('{')
    const lastBrace = trimmed.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonSub = trimmed.slice(firstBrace, lastBrace + 1)
      return JSON.parse(jsonSub)
    }
    throw new Error('未能从模型返回中解析出结构化 JSON，请检查模型输出')
  }
}

/**
 * 图像/文本题目智能识别与自动分类解析
 */
export async function recognizeQuestionWithAI({
  imageBase64,
  rawText,
  userRawNotes,
  config,
  signal,
}: VisionRecognitionParams): Promise<Question> {
  const endpoint = `${cleanBaseUrl(config.baseURL)}/chat/completions`

  const systemPrompt = `你是一位高阶数理竞赛、几何逻辑与智能体 IQ 测试题目的数字化整理专家。
你的任务是将用户提供的题目（图片或文本）高精度还原为结构化数据，并重点满足以下要求：
1. 【题型识别 (type)】：
   - 若题目原卷带有明确备选项（如 A/B/C/D），设为 "single-choice"（单选）或 "multiple-choice"（多选）；
   - 若为填空求值题，设为 "fill-blank"；
   - 若为解答题、证明大题、数学分析求解题，绝不要硬造 A/B/C/D 选项！必须设为 "free-response"！
2. 【分类 (category)】：只能从以下枚举中选取其一：
   - "math" (高阶代数/分析/微积分)
   - "logic" (离散数理与纯逻辑)
   - "spatial" (拓扑几何与空间几何)
   - "probability" (概率分布与马尔可夫链)
   - "algorithm" (图论计算与算法复杂度)
   - "deduction" (信息熵与逆向演绎)
3. 【难度 (difficulty)】：从 "easy", "medium", "hard", "genius" 中评估选取。
4. 【LaTeX 公式规范】：题目描述 (description) 与解析 (explanation) 中的所有数学符号与表达式必须使用纯正标准的 LaTeX 语法：
   - 行内公式使用 $...$，例如 $\\lim_{n \\to \\infty} \\frac{1}{n} = 0$
   - 独立行公式使用 $$...$$
5. 【答案与推导整理】：
   - 如果用户输入了粗略答案或推导思路草稿，请优先参考提炼其结论，并将其补充扩展为层次清晰、推导严密的标准 LaTeX 官方证明/题解 (explanation)；
   - 如果用户未提供草稿，请你给出正确的标准答案与严密推导。

必须严格输出纯 JSON 对象，格式如下：
{
  "title": "简明题目标题（如：2024阿赛真题：非对称硬币极限定理）",
  "category": "math" | "logic" | "spatial" | "probability" | "algorithm" | "deduction",
  "difficulty": "easy" | "medium" | "hard" | "genius",
  "type": "single-choice" | "multiple-choice" | "fill-blank" | "free-response",
  "description": "完整题干说明（含标准 LaTeX 公式）",
  "options": [
    { "label": "A", "text": "选项文本（支持LaTeX）" },
    { "label": "B", "text": "..." }
  ] | null,
  "answer": "核心答案或结论表达式（如 C，或 1/2，或 \\\\lfloor (d+2)/2 \\\\rfloor - j）",
  "explanation": "详细完整推导过程与严密数学证明（含步骤与 LaTeX 公式）",
  "tags": ["微积分", "几何数论", "2024阿赛"]
}`

  const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = []

  let userTextPrompt = '请仔细解析所给题目并输出标准 JSON 格式。'
  if (rawText && rawText.trim()) {
    userTextPrompt += `\n\n【用户输入的题目原文本】：\n${rawText.trim()}`
  }
  if (userRawNotes && userRawNotes.trim()) {
    userTextPrompt += `\n\n【用户手动输入的简要答案或推导草稿（请予以参考并规范排版推导过程）】：\n${userRawNotes.trim()}`
  }

  userContent.push({
    type: 'text',
    text: userTextPrompt,
  })

  if (imageBase64) {
    userContent.push({
      type: 'image_url',
      image_url: {
        url: imageBase64,
      },
    })
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model || 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: config.temperature ?? 0.2,
    }),
    signal,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`AI 接口响应失败 (HTTP ${response.status}): ${errorText.slice(0, 300)}`)
  }

  const data = await response.json()
  const rawContent = data.choices?.[0]?.message?.content || ''
  const parsed = extractJsonFromResponse(rawContent)

  // Validate and normalize
  const validCategories: Category[] = ['math', 'logic', 'spatial', 'probability', 'algorithm', 'deduction']
  const validDifficulties: Difficulty[] = ['easy', 'medium', 'hard', 'genius']
  const validTypes: QuestionType[] = ['single-choice', 'multiple-choice', 'fill-blank', 'free-response']

  const category = validCategories.includes(parsed.category as Category)
    ? (parsed.category as Category)
    : 'math'

  const difficulty = validDifficulties.includes(parsed.difficulty as Difficulty)
    ? (parsed.difficulty as Difficulty)
    : 'hard'

  const type = validTypes.includes(parsed.type as QuestionType)
    ? (parsed.type as QuestionType)
    : 'free-response'

  let options: OptionItem[] | undefined = undefined
  if ((type === 'single-choice' || type === 'multiple-choice') && Array.isArray(parsed.options) && parsed.options.length > 0) {
    options = parsed.options.map((opt: { label?: string; text?: string }, idx: number) => ({
      id: `opt-${idx + 1}`,
      label: opt.label || String.fromCharCode(65 + idx),
      text: opt.text || '',
    }))
  }

  let answer: string | string[] = ''
  if (Array.isArray(parsed.answer)) {
    answer = parsed.answer.map(String)
  } else if (parsed.answer !== undefined && parsed.answer !== null) {
    answer = String(parsed.answer)
  } else {
    answer = '待定'
  }

  const question: Question = {
    id: `q-ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : '未命名 AI 导入题目',
    description: typeof parsed.description === 'string' ? parsed.description : '',
    category,
    difficulty,
    type,
    options,
    answer,
    explanation: typeof parsed.explanation === 'string' ? parsed.explanation : '暂无详细推导过程',
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : ['AI导入'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  return question
}

/**
 * 仅对用户手动输入的简要答案/草稿思路进行 AI 整理排版与 LaTeX 公式化
 */
export async function polishAnswerAndProofWithAI({
  title,
  description,
  type,
  userRawNotes,
  config,
  signal,
}: PolishAnswerParams): Promise<{ answer: string | string[]; explanation: string }> {
  const endpoint = `${cleanBaseUrl(config.baseURL)}/chat/completions`

  const prompt = `你是一位高阶数理专家与 LaTeX 排版名师。
请针对以下题目以及用户手动输入的简要答案/解题思路草稿，完成：
1. 提炼出标准统一的核心答案表达式 (answer)。
2. 将用户草稿扩充并排版为步骤严谨、逻辑闭环、富含标准 LaTeX 数学公式（行内使用 $...$，独立行使用 $$...$$）的权威详细推导与证明过程 (explanation)。

【题目标题】：${title}
【题型】：${type}
${description ? `【题目内容】：\n${description}` : ''}

【用户手动输入的简要答案或推导思路草稿】：
${userRawNotes}

请严格按以下 JSON 格式返回：
{
  "answer": "提炼出的最终核心答案结论",
  "explanation": "经过严密推演、精细排版、公式完备的详细题解与证明步骤"
}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert mathematical typesetter and theorem prover. Output strictly valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: config.temperature ?? 0.2,
    }),
    signal,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`排版接口响应失败 (HTTP ${response.status}): ${errorText.slice(0, 300)}`)
  }

  const data = await response.json()
  const rawContent = data.choices?.[0]?.message?.content || ''
  const parsed = extractJsonFromResponse(rawContent)

  return {
    answer: Array.isArray(parsed.answer)
      ? parsed.answer.map(String)
      : String(parsed.answer || userRawNotes),
    explanation: String(parsed.explanation || '未能生成完整推导'),
  }
}
