import React, { createContext, useContext, useState, useEffect } from 'react'
import { type ThemeMode, THEME_OPTIONS, type ThemeOption } from '../types/theme'

interface ThemeContextType {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  currentThemeOption: ThemeOption
}

const THEME_STORAGE_KEY = 'ai_iq_theme_v2'

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY)
      if (saved && (saved === 'parchment' || saved === 'dark-matrix' || saved === 'midnight-parchment' || saved === 'academic-paper')) {
        return saved as ThemeMode
      }
    } catch {}
    // Default to Claude parchment!
    return 'parchment'
  })

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {}

    const option = THEME_OPTIONS.find(t => t.id === theme) || THEME_OPTIONS[0]
    const root = document.documentElement

    // Set data-theme attribute
    root.setAttribute('data-theme', theme)

    // Toggle dark class
    if (option.isDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }

    // Set background color on body
    document.body.style.backgroundColor = option.previewBg
  }, [theme])

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme)
  }

  const currentThemeOption = THEME_OPTIONS.find(t => t.id === theme) || THEME_OPTIONS[0]

  return (
    <ThemeContext.Provider value={{ theme, setTheme, currentThemeOption }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
