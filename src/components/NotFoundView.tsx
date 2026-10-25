import React from 'react'
import { Home } from 'lucide-react'
import { NovaLogo } from './NovaLogo'

interface NotFoundViewProps {
  onReturnHome: () => void
}

export const NotFoundView: React.FC<NotFoundViewProps> = ({ onReturnHome }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none animate-fadeIn">
      <div className="w-16 h-16 rounded-3xl bg-violet-950/40 border border-violet-500/30 flex items-center justify-center mb-6 shadow-[0_0_32px_rgba(168,85,247,0.25)]">
        <NovaLogo size={36} />
      </div>
      <span className="text-xs font-semibold tracking-widest text-[#a78bfa] uppercase mb-2">404 Error</span>
      <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">Page Not Found</h1>
      <p className="text-sm text-[#9f94b3] max-w-md mb-8 leading-relaxed">
        The destination you are trying to reach does not exist or has been moved. Return to the home dashboard to continue.
      </p>
      <button
        type="button"
        onClick={onReturnHome}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-all shadow-[0_0_20px_rgba(139,92,246,0.35)] active:scale-95"
      >
        <Home size={16} />
        <span>Return to Home</span>
      </button>
    </div>
  )
}
