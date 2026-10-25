import { useEffect, useRef } from 'react'
import { Image, Sparkles, X } from 'lucide-react'
import { WikimediaImageSearch } from './WikimediaImageSearch'
import { AiPresentationStudio } from './AiPresentationStudio'
import { DevAssistantStudio } from './DevAssistantStudio'

export type CapabilityId = 'image' | 'presentation' | 'developer'

interface ToolStudioModalProps {
  capability: CapabilityId | null
  onClose: () => void
}

export function ToolStudioModal({ capability, onClose }: ToolStudioModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (capability && !dialog.open) {
      dialog.showModal()
    } else if (!capability && dialog.open) {
      dialog.close()
    }
  }, [capability])

  return (
    <dialog
      ref={dialogRef}
      className={`tool-studio-dialog tool-studio-dialog--split ${
        capability === 'image' ? 'tool-studio-dialog--image-search' : ''
      }`}
      aria-labelledby={capability ? 'tool-studio-title' : undefined}
      aria-describedby={capability ? 'tool-studio-description' : undefined}
      onCancel={(event) => {
        event.preventDefault()
        if (capability) onClose()
      }}
      onClose={() => {
        if (capability) onClose()
      }}
    >
      {capability === 'presentation' && <AiPresentationStudio onClose={onClose} />}
      {capability === 'developer' && <DevAssistantStudio onClose={onClose} />}
      {capability === 'image' && (
        <div className="tool-studio tool-studio--image">
          <header className="tool-studio-header">
            <span className="tool-studio-mark" aria-hidden="true">
              <Image size={20} />
            </span>
            <div>
              <p>WIKIMEDIA COMMONS</p>
              <h2 id="tool-studio-title">Wikimedia Image Search</h2>
            </div>
            <button className="tool-studio-close" type="button" onClick={onClose} aria-label="Close studio">
              <X size={19} />
            </button>
          </header>
          <p className="tool-studio-description" id="tool-studio-description">
            Find authentic Creative Commons and public domain photographs, media, and artwork directly via the official Wikimedia Commons API.
          </p>
          <div className="tool-studio-status">
            <Sparkles size={14} className="shrink-0" />
            <span>Live Wikimedia Commons Action API · Official File Namespace Search · Public Domain & Creative Commons</span>
          </div>
          <WikimediaImageSearch />
        </div>
      )}
    </dialog>
  )
}
