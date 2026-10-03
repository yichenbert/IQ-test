import React, { useState, useRef, useEffect } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { THEME_OPTIONS, type ThemeMode } from '../types/theme'
import { Palette, Check, ChevronDown } from 'lucide-react'

export const ThemeSwitcher: React.FC = () => {
  const { theme, setTheme, currentThemeOption } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium theme-switcher-btn border transition-all"
        title="切换主题风格"
      >
        <span className="text-base">{currentThemeOption.icon}</span>
        <span className="hidden md:inline font-semibold">{currentThemeOption.name}</span>
        <ChevronDown className={`w-3.5 h-3.5 opacity-70 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl theme-dropdown-panel shadow-2xl p-2 z-50 animate-fadeIn border">
          <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider theme-dropdown-label flex items-center justify-between border-b pb-2 mb-1">
            <span className="flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5" />
              界面主题风格
            </span>
            <span className="text-[10px] opacity-70">支持 4 种风格</span>
          </div>

          <div className="space-y-1">
            {THEME_OPTIONS.map(opt => {
              const isSelected = opt.id === theme
              return (
                <button
                  key={opt.id}
                  onClick={() => {
                    setTheme(opt.id as ThemeMode)
                    setIsOpen(false)
                  }}
                  className={`w-full text-left p-2.5 rounded-xl flex items-center justify-between transition-all ${
                    isSelected
                      ? 'theme-option-selected font-semibold'
                      : 'theme-option-hover opacity-85 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {/* Color Swatch Circle */}
                    <div
                      className="w-6 h-6 rounded-full border shadow-sm flex items-center justify-center shrink-0 relative overflow-hidden"
                      style={{ backgroundColor: opt.previewBg }}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: opt.previewAccent }}
                      />
                    </div>

                    <div>
                      <div className="text-xs flex items-center gap-1.5">
                        <span>{opt.name}</span>
                        {opt.id === 'parchment' && (
                          <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-[#D97757]/15 text-[#D97757] font-bold border border-[#D97757]/30">
                            Claude 质感
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] opacity-60 leading-tight">
                        {opt.subtitle}
                      </div>
                    </div>
                  </div>

                  {isSelected && <Check className="w-4 h-4 text-[#D97757] shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
