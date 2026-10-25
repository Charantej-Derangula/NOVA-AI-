import React from 'react'
import novaMarkPng from '../assets/nova-logo-mark.png'
import novaFullPng from '../assets/nova-logo-full.png'

export interface NovaLogoProps {
  size?: number
  variant?: 'mark' | 'full' | 'horizontal'
  showTagline?: boolean
  className?: string
  markClassName?: string
}

/**
 * Authoritative NOVA brand mark and lockup matching the exact approved brand logo.
 * Features the distinctive angular, flowing violet N symbol and balanced typography.
 */
export const NovaLogo: React.FC<NovaLogoProps> = ({
  size = 32,
  variant = 'mark',
  showTagline = true,
  className = '',
  markClassName = '',
}) => {
  // Mark aspect ratio is 141x120 (~1.175)
  const markWidth = Math.round(size * 1.175)

  const mark = (
    <div
      style={{ height: `${size}px`, width: `${markWidth}px` }}
      className={`relative inline-flex items-center justify-center shrink-0 ${markClassName} ${className}`.trim()}
      aria-label="NOVA"
      role="img"
    >
      <img
        src={novaMarkPng}
        alt=""
        width={markWidth}
        height={size}
        style={{
          height: `${size}px`,
          width: 'auto',
          maxHeight: `${size}px`,
          maxWidth: `${Math.round(size * 1.25)}px`,
        }}
        className="shrink-0 object-contain select-none transition-transform duration-300 pointer-events-none"
        draggable={false}
      />
    </div>
  )

  if (variant === 'mark') {
    return mark
  }

  if (variant === 'horizontal') {
    return (
      <div className={`flex items-center gap-3 select-none ${className}`}>
        {mark}
        <div className="flex flex-col">
          <span className="font-sans font-medium tracking-[0.35em] text-white text-sm leading-none">
            NOVA
          </span>
          {showTagline && (
            <span className="text-[9px] tracking-[0.25em] text-neutral-400 uppercase mt-1 leading-none">
              PERSONAL AI
            </span>
          )}
        </div>
      </div>
    )
  }

  // variant === 'full' (centered stack matching authoritative reference lockup)
  return (
    <div className={`flex flex-col select-none ${className}`}>
      <img
        src={novaFullPng}
        alt="NOVA — Personal AI"
        style={{
          width: `${Math.round(size * 2.8)}px`,
          maxWidth: '100%',
          height: 'auto',
        }}
        className="shrink-0 select-none pointer-events-none"
        draggable={false}
      />
    </div>
  )
}
