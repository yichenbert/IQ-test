import type { Category, Difficulty } from '../types'

export const CATEGORY_LABELS: Record<Category, { label: string; icon: string; color: string }> = {
  math: { label: '数理逻辑与微积分', icon: '∑', color: 'from-blue-500 to-indigo-600' },
  logic: { label: '数理逻辑与公理', icon: '∧', color: 'from-violet-500 to-purple-600' },
  spatial: { label: '空间拓扑与几何结构', icon: '◬', color: 'from-emerald-500 to-teal-600' },
  probability: { label: '贝叶斯与随机过程', icon: 'Ω', color: 'from-amber-500 to-orange-600' },
  algorithm: { label: '信息论与动力系统', icon: '⚡', color: 'from-cyan-500 to-blue-600' },
  deduction: { label: '多智能体与归纳博弈', icon: '♟', color: 'from-rose-500 to-pink-600' },
}

export const DIFFICULTY_LABELS: Record<Difficulty, { label: string; badge: string; weight: number }> = {
  easy: { label: '基础 (Easy)', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', weight: 1 },
  medium: { label: '中等 (Medium)', badge: 'bg-blue-500/10 text-blue-400 border-blue-500/30', weight: 1.5 },
  hard: { label: '高难 (Hard)', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30', weight: 2.2 },
  genius: { label: '天才 (Genius)', badge: 'bg-rose-500/10 text-rose-400 border-rose-500/30', weight: 3.0 },
}

export function calculateEstimatedIQ(correctWeightScore: number, totalWeightScore: number): number {
  if (totalWeightScore === 0) return 100
  const ratio = correctWeightScore / totalWeightScore
  
  let estimated = 85 + ratio * 60
  if (ratio > 0.8) {
    estimated += (ratio - 0.8) * 40
  }
  return Math.min(160, Math.max(70, Math.round(estimated)))
}

export function getIQEvaluationTitle(iq: number): { title: string; color: string; desc: string } {
  if (iq >= 145) {
    return {
      title: '高智商突破 (Genius Level)',
      color: 'text-rose-400',
      desc: '超越 99.8% 的测试者，具备卓越的抽象数学逻辑与高维空间建模推演能力！',
    }
  }
  if (iq >= 130) {
    return {
      title: '极高智力 (Superior / Mensa Range)',
      color: 'text-amber-400',
      desc: '位列前 2% 门萨高智商精英区间，能敏锐洞察复杂规律与贝叶斯信息量！',
    }
  }
  if (iq >= 115) {
    return {
      title: '优秀分析者 (High Average)',
      color: 'text-cyan-400',
      desc: '高于常模平均水平，具备优秀的逻辑推论与数理运算推导功底。',
    }
  }
  if (iq >= 90) {
    return {
      title: '稳健思辨者 (Average)',
      color: 'text-blue-400',
      desc: '处于标准正态分布常规模间，思维严密，具备健全的基础逻辑分析能力。',
    }
  }
  return {
    title: '潜力探索者 (Developing)',
    color: 'text-slate-400',
    desc: '建议针对微积分极限与贝叶斯概率论基础深入强化训练。',
  }
}

