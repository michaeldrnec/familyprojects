import type { ReactNode } from 'react'
import './ui.css'

// The inline "solved it!" banner, with an optional follow-up button.
export default function WinBanner({ children, action }: { children: ReactNode; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="win-banner" role="status">
      <span>{children}</span>
      {action && (
        <button type="button" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  )
}
