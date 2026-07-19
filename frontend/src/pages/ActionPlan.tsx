import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, User, LayoutGrid, List } from 'lucide-react'

interface ActionItem {
  id: string
  finding: string
  description: string
  owner: string
  department: string
  priority: 'high' | 'medium' | 'low'
  deadline: string
  status: 'not_started' | 'in_progress' | 'done'
}

const actionItems: ActionItem[] = [
  { id: '1', finding: 'Unimplemented obligation', description: 'Draft and approve Third-Party Vendor Security Policy', owner: 'IT Security', department: 'IT Security', priority: 'high', deadline: '2025-08-30', status: 'not_started' },
  { id: '2', finding: 'Missing evidence', description: 'Schedule cybersecurity training and upload completion certificates', owner: 'HR', department: 'Human Resources', priority: 'high', deadline: '2025-08-15', status: 'not_started' },
  { id: '3', finding: 'Outdated procedure', description: 'Update incident response playbooks to align with SEBI Circular 2025/045', owner: 'Risk Team', department: 'Risk Management', priority: 'medium', deadline: '2025-09-15', status: 'not_started' },
  { id: '4', finding: 'Workflow gap', description: 'Add quarterly cybersecurity reporting step to KYC Onboarding Workflow', owner: 'Ops Team', department: 'Operations', priority: 'medium', deadline: '2025-09-30', status: 'not_started' },
  { id: '5', finding: 'Missing evidence', description: 'Create formal audit trail for SOC 24/7 monitoring coverage', owner: 'IT Security', department: 'IT Security', priority: 'low', deadline: '2025-10-15', status: 'in_progress' },
]

const priorityBadge: Record<string, string> = { high: 'badge-critical', medium: 'badge-warning', low: 'badge-neutral' }
const statusBadge: Record<string, string> = { done: 'badge-success', in_progress: 'badge-warning', not_started: 'badge-neutral' }
const statusLabel: Record<string, string> = { done: 'Done', in_progress: 'In Progress', not_started: 'Not Started' }

const columns: { key: ActionItem['status']; label: string }[] = [
  { key: 'not_started', label: 'Not Started' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Done' },
]

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function ProgressRing({ status }: { status: ActionItem['status'] }) {
  const pct = status === 'done' ? 100 : status === 'in_progress' ? 50 : 5
  const radius = 14
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference
  const color = status === 'done' ? '#3AA187' : status === 'in_progress' ? '#D89B3C' : '#8A7D86'
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" className="-rotate-90 shrink-0">
      <circle cx="17" cy="17" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
      <circle cx="17" cy="17" r={radius} fill="none" stroke={color} strokeWidth="3" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
    </svg>
  )
}

export default function ActionPlan() {
  const [view, setView] = useState<'table' | 'kanban'>('kanban')

  return (
    <div className="space-y-6 animate-fade-in relative z-10 p-8 max-w-[1600px] mx-auto argus-ground">
      <div className="flex items-center justify-between border-b border-argus-line pb-5">
        <div>
          <p className="eyebrow mb-1">Remediation Tracker</p>
          <h2 className="font-display text-2xl font-bold text-argus-text tracking-tight">Action Plan</h2>
          <p className="text-sm text-argus-text-faint mt-1">Auto-generated remediation tasks from stress test findings</p>
        </div>
        <div className="flex items-center gap-1 p-1 bg-white/[0.03] border border-argus-line rounded-lg">
          <button onClick={() => setView('kanban')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'kanban' ? 'bg-argus-accent text-argus-bg' : 'text-argus-text-secondary hover:text-argus-text'}`}>
            <LayoutGrid className="w-3.5 h-3.5" /> Kanban
          </button>
          <button onClick={() => setView('table')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'table' ? 'bg-argus-accent text-argus-bg' : 'text-argus-text-secondary hover:text-argus-text'}`}>
            <List className="w-3.5 h-3.5" /> Table
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {view === 'kanban' ? (
          <motion.div key="kanban" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {columns.map(col => {
              const items = actionItems.filter(i => i.status === col.key)
              return (
                <div key={col.key} className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="eyebrow">{col.label}</h3>
                    <span className="text-xs font-mono text-argus-text-faint">{items.length}</span>
                  </div>
                  <div className="space-y-3 min-h-[120px]">
                    {items.map((item, i) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.05 }}
                        className="panel p-4 hover:border-white/20 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`badge ${priorityBadge[item.priority]}`}>{item.priority}</span>
                          <ProgressRing status={item.status} />
                        </div>
                        <p className="text-sm font-medium text-argus-text leading-snug mb-3">{item.description}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-full bg-argus-accent/15 border border-argus-accent/30 flex items-center justify-center text-[10px] font-semibold text-argus-accent">
                              {initials(item.owner)}
                            </div>
                            <span className="text-xs text-argus-text-secondary">{item.owner}</span>
                          </div>
                          <div className="flex items-center gap-1 text-argus-text-faint">
                            <Calendar className="w-3 h-3" />
                            <span className="font-mono text-[11px]">{item.deadline}</span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                    {items.length === 0 && (
                      <div className="text-xs text-argus-text-faint text-center py-8 border border-dashed border-argus-line rounded-lg">No tasks</div>
                    )}
                  </div>
                </div>
              )
            })}
          </motion.div>
        ) : (
          <motion.div key="table" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            className="panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full data-table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th className="w-40">Finding</th>
                    <th className="w-36">Owner</th>
                    <th className="w-20">Progress</th>
                    <th className="w-24">Priority</th>
                    <th className="w-32">Deadline</th>
                    <th className="w-32">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {actionItems.map((item, i) => (
                    <tr key={item.id} className="group">
                      <td>
                        <div className="flex items-start gap-3">
                          <span className="font-mono text-xs text-argus-text-faint mt-0.5">{String(i + 1).padStart(2, '0')}</span>
                          <p className="text-sm font-medium text-argus-text-secondary group-hover:text-argus-text transition-colors">{item.description}</p>
                        </div>
                      </td>
                      <td><span className="badge badge-neutral">{item.finding}</span></td>
                      <td>
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-argus-text-faint" />
                          <span className="text-sm text-argus-text-secondary">{item.owner}</span>
                        </div>
                      </td>
                      <td><ProgressRing status={item.status} /></td>
                      <td><span className={`badge ${priorityBadge[item.priority]}`}>{item.priority}</span></td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-argus-text-faint" />
                          <span className="font-mono text-sm text-argus-text-secondary">{item.deadline}</span>
                        </div>
                      </td>
                      <td><span className={`badge ${statusBadge[item.status]}`}>{statusLabel[item.status]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
