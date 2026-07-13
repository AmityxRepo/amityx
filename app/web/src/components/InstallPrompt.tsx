import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import Button from './ui/Button'

/** Minimal shape of the non-standard `beforeinstallprompt` event. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Defers the browser's install banner and shows our own icon+label button instead
 * (D-012 P.9: icon+label buttons, no browser chrome as the only affordance).
 * Renders nothing when the browser hasn't fired the event (already installed,
 * unsupported browser, or criteria not yet met) — never a placeholder gap.
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [])

  if (!deferred) return null

  return (
    <div className="fixed bottom-20 right-4 z-40">
      <Button
        icon={Download}
        className="shadow-dialog"
        onClick={async () => {
          await deferred.prompt()
          await deferred.userChoice
          setDeferred(null)
        }}
      >
        Install Amityx
      </Button>
    </div>
  )
}
