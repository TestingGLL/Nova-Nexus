import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

interface ThemeContextType {
  accentColor: string
  setAccentColor: (color: string) => void
  darkMode: boolean
  setDarkMode: (dark: boolean) => void
}

const ThemeContext = createContext<ThemeContextType>({
  accentColor: '#38bdf8',
  setAccentColor: () => {},
  darkMode: false,
  setDarkMode: () => {},
})

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [accentColor, setAccentColor] = useState(() => {
    return localStorage.getItem('nn-accent') || '#38bdf8'
  })
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('nn-dark-mode')
    return saved !== null ? saved === 'true' : false
  })

  useEffect(() => {
    const { r, g, b } = hexToRgb(accentColor)
    document.documentElement.style.setProperty('--accent', accentColor)
    document.documentElement.style.setProperty('--accent-soft', `rgba(${r}, ${g}, ${b}, 0.08)`)
    document.documentElement.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, 0.15)`)
    localStorage.setItem('nn-accent', accentColor)
  }, [accentColor])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('nn-dark-mode', String(darkMode))
  }, [darkMode])

  return (
    <ThemeContext.Provider value={{ accentColor, setAccentColor, darkMode, setDarkMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
