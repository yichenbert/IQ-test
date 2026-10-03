import * as pdfjsLib from 'pdfjs-dist'
import type { Question, Category, Difficulty, QuestionType, OptionItem, LLMConfig } from '../types'

// Configure pdfjs worker: Vite dynamic import with fallback
if (typeof window !== 'undefined') {
  try {
    // Try using cdnjs matching pdfjs version for bulletproof cross-origin & static GitHub Pages support
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
  } catch (err) {
    console.warn('PDF Worker setup note:', err)
  }
}

export interface PdfParsedPage {
  pageNum: number
  text: string
  thumbnailUrl?: string
}

export interface PdfParseResult {
  fileName: string
  pageCount: number
  fullText: string
  pages: PdfParsedPage[]
}

/**
 * 客户端纯前端解析 PDF 文档：提取全文与各页文本、生成各页预览缩略图
 */
export async function parsePdfDocument(
  file: File,
  maxPages = 20,
  onProgress?: (curr: number, total: number) => void
): Promise<PdfParseResult> {
  const arrayBuffer = await file.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
    cMapPacked: true,
  })

  const pdf = await loadingTask.promise
  const totalPages = Math.min(pdf.numPages, maxPages)
  const pages: PdfParsedPage[] = []
  let fullText = ''

  for (let i = 1; i <= totalPages; i++) {
    onProgress?.(i, totalPages)
    const page = await pdf.getPage(i)
    
    // 1. 提取文本内容
    const textContent = await page.getTextContent()
    const pageText = textContent.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    
    fullText += `\n--- 第 ${i} 页 ---\n` + pageText

    // 2. 渲染缩略图（便于用户核对试卷样式，特别是包含几何图或排版图的文档）
    let thumbnailUrl: string | undefined = undefined
    try {
      const viewport = page.getViewport({ scale: 1.0 })
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      if (context) {
        canvas.width = viewport.width
        canvas.height = viewport.height
        await page.render({
          canvasContext: context,
          viewport,
          canvas,
        }).promise
        thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8)
      }
    } catch (e) {
      console.warn(`第 ${i} 页渲染缩略图跳过`, e)
    }

    pages.push({
      pageNum: i,
      text: pageText,
      thumbnailUrl,
    })
  }

  return {
    fileName: file.name,
    pageCount: pdf.numPages,
    fullText: fullText.trim(),
    pages,
  }
}

/**
 * 将大模型返回内容中的 JSON 数据块提取出来
 */
function extractJsonArray(raw: string): any[] {
  const trimmed = raw.trim()
  try {
    const direct = JSON.parse(trimmed)
    if (Array.isArray(direct)) return direct
    if (direct && Array.isArray(direct.questions)) return direct.questions
  } catch {}

  // 尝试匹配 ```json ... ```
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1].trim())
      if (Array.isArray(parsed)) return parsed
      if (parsed && Array.isArray(parsed.questions)) return parsed.questions
    } catch {}
  }

  // 尝试定位首个 [ 与 最后一个 ]
  const firstBracket = trimmed.indexOf('[')
  const lastBracket = trimmed.lastIndexOf(']')
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    try {
      const jsonSub = trimmed.slice(firstBracket, lastBracket + 1)
      const parsed = JSON.parse(jsonSub)
      if (Array.isArray(parsed)) return parsed
    } catch {}
  }

  // 尝试定位 { "questions": [...] }
  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const jsonSub = trimmed.slice(firstBrace, lastBrace + 1)
      const parsed = JSON.parse(jsonSub)
      if (parsed && Array.isArray(parsed.questions)) return parsed.questions
    } catch {}
  }

  throw new Error('未能从模型返回中提取出题目数组 JSON，请检查模型输出')
}

export interface BatchPdfRecognitionParams {
  pdfResult: PdfParseResult
  targetCategoryName: string // 合并归纳的分类项名称
  config: LLMConfig
  userNotes?: string
  signal?: AbortSignal
}

/**
 * 调用大模型批量识别 PDF 试卷中的题目并统一合并到指定分类项
 */
export async function batchExtractQuestionsFromPdfWithAI({
  pdfResult,
  targetCategoryName,
  config,
  userNotes,
  signal,
}: BatchPdfRecognitionParams): Promise<Question[]> {
  let cleanBaseUrl = (config.baseURL || 'https://api.openai.com/v1').trim()
  if (cleanBaseUrl.endsWith('/')) {
    cleanBaseUrl = cleanBaseUrl.slice(0, -1)
  }
  const endpoint = `${cleanBaseUrl}/chat/completions`

  const systemPrompt = `你是一位高阶学术竞赛与试卷数字化整理专家。
用户提供了一份 PDF 试卷或文档的提取内容。你的核心任务是：
1. 识别并拆分出文档中的【全部独立题目】（单选、多选、填空、证明大题）。
2. 【统一分类】：用户已将这批题目指定合并为一个专属分类项，所有题目的 category 字段必须统一设为：${JSON.stringify(targetCategoryName)}。
3. 【无答案处理】：试卷原稿若未附带答案或答案缺失，请将 answer 设为 "待补充答案"，并在 explanation 中注明 "原稿未附带答案，导入后可在题库中心点击编辑，通过 AI 识别草稿一键排版"。若原稿有答案，请准确提取。
4. 【LaTeX 公式规范】：题干 (description)、选项 (options) 及推导 (explanation) 中的所有数学公式必须规范使用 LaTeX：
   - 行内公式使用 $...$，例如 $\\lim_{n \\to \\infty} \\frac{1}{n} = 0$
   - 独立公式使用 $$...$$
5. 【题型原生研判】：如果是证明题或解答题，绝不要硬造 A/B/C/D 选项，设为 "free-response"。

必须严格输出 JSON 数组，格式为：
[
  {
    "title": "简明标题（如：第1题-欧拉示性数分析）",
    "category": ${JSON.stringify(targetCategoryName)},
    "difficulty": "easy" | "medium" | "hard" | "genius",
    "type": "single-choice" | "multiple-choice" | "fill-blank" | "free-response",
    "description": "完整题干内容（含规范 LaTeX 公式）",
    "options": [
      { "label": "A", "text": "选项文本" },
      { "label": "B", "text": "..." }
    ] | null,
    "answer": "答案（若无则填：待补充答案）",
    "explanation": "详细解析（若无则填：原稿未附带答案，可后续点击编辑使用 AI 识别草稿排版）",
    "tags": ["PDF导入", ${JSON.stringify(targetCategoryName)}]
  }
]`

  let userPrompt = `【PDF文档名称】：${pdfResult.fileName}\n`
  userPrompt += `【已提取的文档内容（共 ${pdfResult.pageCount} 页）】：\n`
  userPrompt += pdfResult.fullText.slice(0, 15000) // 防止单次超出上下文

  if (userNotes && userNotes.trim()) {
    userPrompt += `\n\n【用户补充的试卷备注或说明】：\n${userNotes.trim()}`
  }

  // 针对包含扫描图/几何图的页面，附带前 3 页代表性图片（如果有）
  const contentItems: any[] = [{ type: 'text', text: userPrompt }]
  const sampleImages = pdfResult.pages
    .filter(p => Boolean(p.thumbnailUrl))
    .slice(0, 3)
  for (const p of sampleImages) {
    if (p.thumbnailUrl) {
      contentItems.push({
        type: 'image_url',
        image_url: { url: p.thumbnailUrl },
      })
    }
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
        { role: 'user', content: contentItems },
      ],
      temperature: config.temperature ?? 0.2,
    }),
    signal,
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`PDF 识别接口响应失败 (HTTP ${response.status}): ${errText.slice(0, 300)}`)
  }

  const data = await response.json()
  const rawContent = data.choices?.[0]?.message?.content || ''
  const parsedQuestions = extractJsonArray(rawContent)

  const timestamp = Date.now()
  const validDifficulties: Difficulty[] = ['easy', 'medium', 'hard', 'genius']
  const validTypes: QuestionType[] = ['single-choice', 'multiple-choice', 'fill-blank', 'free-response']

  return parsedQuestions.map((q: any, idx: number) => {
    const diff = validDifficulties.includes(q.difficulty) ? (q.difficulty as Difficulty) : 'hard'
    const qType = validTypes.includes(q.type) ? (q.type as QuestionType) : 'free-response'

    let options: OptionItem[] | undefined = undefined
    if ((qType === 'single-choice' || qType === 'multiple-choice') && Array.isArray(q.options) && q.options.length > 0) {
      options = q.options.map((opt: any, optIdx: number) => ({
        id: `opt-${optIdx + 1}`,
        label: opt.label || String.fromCharCode(65 + optIdx),
        text: opt.text || '',
      }))
    }

    let answer: string | string[] = '待补充答案'
    if (Array.isArray(q.answer)) {
      answer = q.answer.map(String)
    } else if (q.answer !== undefined && q.answer !== null && String(q.answer).trim()) {
      answer = String(q.answer).trim()
    }

    return {
      id: `q-pdf-${timestamp}-${idx + 1}-${Math.random().toString(36).slice(2, 6)}`,
      title: q.title || `${targetCategoryName} 第 ${idx + 1} 题`,
      description: q.description || '',
      category: targetCategoryName as Category,
      difficulty: diff,
      type: qType,
      options,
      answer,
      explanation: q.explanation || '原稿未附带答案，可在题库中心点击编辑，通过 AI 识别草稿排版补充。',
      tags: Array.isArray(q.tags) ? q.tags.map(String) : ['PDF导入', targetCategoryName],
      createdAt: timestamp,
      updatedAt: timestamp,
    } as Question
  })
}
