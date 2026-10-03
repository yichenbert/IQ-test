export type ThemeMode = 'parchment' | 'dark-matrix' | 'midnight-parchment' | 'academic-paper'

export interface ThemeOption {
  id: ThemeMode
  name: string
  subtitle: string
  icon: string
  previewBg: string
  previewAccent: string
  isDark: boolean
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'parchment',
    name: 'Claude 羊皮纸',
    subtitle: '温润米黄纸张 · 陶土暖褐 · 典雅衬线',
    icon: '📜',
    previewBg: '#FBF9F5',
    previewAccent: '#D97757',
    isDark: false,
  },
  {
    id: 'midnight-parchment',
    name: '墨香夜读',
    subtitle: '暖调炭黑 · 琥珀陶土 · 沉浸护眼',
    icon: '☕',
    previewBg: '#181716',
    previewAccent: '#D97757',
    isDark: true,
  },
  {
    id: 'dark-matrix',
    name: '深空矩阵',
    subtitle: '科技深蓝 · 极光青蓝 · 赛博暗黑',
    icon: '🌌',
    previewBg: '#0B0F19',
    previewAccent: '#6366F1',
    isDark: true,
  },
  {
    id: 'academic-paper',
    name: '博雅白卷',
    subtitle: '学者纯白 · 牛津深蓝 · 极简学风',
    icon: '🏛️',
    previewBg: '#F8FAFC',
    previewAccent: '#2563EB',
    isDark: false,
  },
]
