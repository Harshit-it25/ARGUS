import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LayoutDashboard, FileText, AlertTriangle, ListChecks, FileOutput, Settings, ShieldCheck, ChevronsLeft, ChevronsRight, Building2, ChevronDown } from 'lucide-react'

interface SidebarProps {
  isOpen: boolean
}

const menuItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/circulars', label: 'Circulars', icon: FileText },
  { path: '/findings', label: 'Findings', icon: AlertTriangle },
  { path: '/action-plan', label: 'Action Plan', icon: ListChecks },
  { path: '/reports', label: 'Reports', icon: FileOutput },
  { path: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar({ isOpen }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const expanded = isOpen && !collapsed

  return (
    <motion.aside
      animate={{ width: isOpen ? (collapsed ? 76 : 264) : 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="bg-argus-bg2/60 backdrop-blur-xl border-r border-argus-line overflow-hidden flex flex-col shrink-0 relative z-30"
    >
      <div className="h-16 flex items-center px-4 border-b border-argus-line shrink-0 gap-3">
        <div className="w-9 h-9 rounded-lg bg-argus-accent/10 border border-argus-accent/30 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-argus-accent" />
        </div>
        {expanded && (
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-base font-semibold text-argus-text leading-none tracking-tight">ARGUS</h1>
            <p className="eyebrow mt-1 truncate">Regulatory Intelligence</p>
          </div>
        )}
      </div>

      {/* Organization selector */}
      {expanded && (
        <button className="mx-3 mt-3 flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-argus-line hover:bg-white/[0.06] transition-colors text-left group">
          <Building2 className="w-4 h-4 text-argus-text-faint shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-argus-text truncate">Team Rocket Securities</p>
            <p className="text-[10px] text-argus-text-faint">Financial Services</p>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-argus-text-faint shrink-0" />
        </button>
      )}

      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto overflow-x-hidden">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            title={!expanded ? item.label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 relative group ${
                isActive
                  ? 'bg-argus-accent/10 text-argus-text border border-argus-accent/25'
                  : 'text-argus-text-secondary hover:text-argus-text hover:bg-white/[0.05] border border-transparent'
              } ${!expanded ? 'justify-center' : ''}`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-argus-accent' : ''}`} />
                {expanded && <span className="font-medium truncate">{item.label}</span>}
                {isActive && expanded && (
                  <motion.span layoutId="active-nav-dot" className="ml-auto w-1.5 h-1.5 rounded-full bg-argus-accent shrink-0" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={() => setCollapsed(c => !c)}
        className="mx-3 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg text-argus-text-faint hover:text-argus-text hover:bg-white/[0.05] transition-colors text-xs"
      >
        {collapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
        {expanded && <span>Collapse</span>}
      </button>

      <div className="p-3 border-t border-argus-line shrink-0">
        <div className={`flex items-center gap-3 px-1 py-1 ${!expanded ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-argus-accent/30 to-argus-blue/20 border border-argus-line flex items-center justify-center text-argus-text text-xs font-display font-semibold shrink-0">
            TR
          </div>
          {expanded && (
            <div className="min-w-0">
              <p className="text-sm font-medium text-argus-text truncate">Team Rocket</p>
              <p className="text-[10px] text-argus-text-faint uppercase tracking-wide">Compliance Officer</p>
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  )
}
