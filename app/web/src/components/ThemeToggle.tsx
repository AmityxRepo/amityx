import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import Button from './ui/Button'

const STORAGE_KEY = 'amityx-theme'

function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  localStorage.setItem(STORAGE_KEY, theme)
}

/** Light/dark switch. Icon + label per P.9 rule 5 — reused wherever a theme
 * switch is needed (kitchen sink today; a future "More" settings screen later). */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>(
    () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'),
  )

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const next = theme === 'light' ? 'dark' : 'light'

  return (
    <Button
      variant="outline"
      size="sm"
      icon={theme === 'light' ? Moon : Sun}
      onClick={() => setTheme(next)}
    >
      {theme === 'light' ? 'Dark mode' : 'Light mode'}
    </Button>
  )
}
