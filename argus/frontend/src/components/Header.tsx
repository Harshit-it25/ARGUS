import { useState, useRef, useEffect } from 'react'
import { Bell, Menu, Globe, ChevronDown, UserCircle, LogOut, Search, Activity } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'

interface HeaderProps {
  toggleSidebar: () => void
  onLogout?: () => void | Promise<void>
  currentRRI?: number
}

export default function Header({ toggleSidebar, onLogout, currentRRI }: HeaderProps) {
  const { language, setLanguage, t } = useLanguage()
  const [langDropdownOpen, setLangDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setLangDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="h-16 bg-argus-bg2/60 backdrop-blur-xl border-b border-argus-line flex items-center justify-between px-5 shrink-0 z-20 sticky top-0 gap-4">
      <div className="flex items-center gap-4 min-w-0">
        <button
          onClick={toggleSidebar}
          className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors text-argus-text-secondary hover:text-argus-text shrink-0"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h2 className="font-display text-base font-semibold text-argus-text tracking-tight hidden sm:block truncate">{t('dashboard' as any)}</h2>
      </div>

      {/* Search */}
      <div className="hidden md:flex items-center flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-argus-text-faint" />
          <input
            type="text"
            placeholder="Search circulars, findings, obligations…"
            className="w-full bg-white/[0.03] border border-argus-line rounded-lg py-2 pl-9 pr-4 text-sm text-argus-text placeholder-argus-text-faint focus:outline-none focus:border-argus-accent/50 focus:bg-white/[0.05] transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-1 md:gap-2 shrink-0">
        {/* Current RRI indicator */}
        {typeof currentRRI === 'number' && (
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-argus-line mr-1">
            <Activity className="w-3.5 h-3.5 text-argus-accent" />
            <span className="eyebrow !text-argus-text-faint">RRI</span>
            <span className="font-display text-sm font-semibold text-argus-text">{currentRRI.toFixed(0)}</span>
          </div>
        )}

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setLangDropdownOpen(!langDropdownOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-white/[0.06] rounded-lg transition-colors text-argus-text-secondary hover:text-argus-text border border-transparent hover:border-argus-line"
          >
            <Globe className="w-4 h-4 text-argus-accent" />
            <span className="font-mono text-xs font-medium uppercase tracking-wider">{language === 'hi' ? 'हिं' : 'EN'}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${langDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {langDropdownOpen && (
            <div className="absolute top-full right-0 mt-2 w-36 panel-solid py-1 z-50 overflow-hidden">
              <button
                onClick={() => { setLanguage('en'); setLangDropdownOpen(false); }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${language === 'en' ? 'font-medium text-argus-accent bg-white/[0.04]' : 'text-argus-text-secondary hover:bg-white/[0.04] hover:text-argus-text'}`}
              >
                English (EN)
              </button>
              <button
                onClick={() => { setLanguage('hi'); setLangDropdownOpen(false); }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${language === 'hi' ? 'font-medium text-argus-accent bg-white/[0.04]' : 'text-argus-text-secondary hover:bg-white/[0.04] hover:text-argus-text'}`}
              >
                हिन्दी (HI)
              </button>
            </div>
          )}
        </div>

        <button className="relative p-2 hover:bg-white/[0.06] rounded-lg transition-colors text-argus-text-secondary hover:text-argus-text" aria-label="Notifications">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-argus-critical rounded-full" />
        </button>

        <div className="w-px h-6 bg-argus-line mx-1" />

        {onLogout && (
          <button onClick={onLogout} className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors text-argus-text-secondary hover:text-argus-text group" title="Sign out">
            <LogOut className="w-5 h-5 group-hover:text-argus-critical transition-colors" />
          </button>
        )}

        <button className="flex items-center gap-2 p-1 pl-2 hover:bg-white/[0.06] rounded-full transition-colors border border-transparent hover:border-argus-line">
          <span className="text-sm font-medium text-argus-text-secondary hidden sm:block">Team Rocket</span>
          <UserCircle className="w-7 h-7 text-argus-accent" />
        </button>
      </div>
    </header>
  )
}
