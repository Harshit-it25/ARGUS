import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Filter, Shield, FileText, Activity, Clock, Loader2, ArrowUpDown, CheckSquare, X, ArrowUpRight, User, Link2 } from 'lucide-react'
import { findingsApi } from '../services/api'

interface Finding {
  id: string
  type: string
  severity: string
  description: string
  department: string
  obligation: string
  status: string
}

const typeConfig: Record<string, { icon: React.ElementType; label: string }> = {
  unimplemented: { icon: Shield, label: 'Unimplemented' },
  outdated_procedure: { icon: Clock, label: 'Outdated Procedure' },
  policy_conflict: { icon: FileText, label: 'Policy Conflict' },
  workflow_gap: { icon: Activity, label: 'Workflow Gap' },
  missing_evidence: { icon: FileText, label: 'Missing Evidence' },
}

const severityBadge: Record<string, string> = { high: 'badge-critical', medium: 'badge-warning', low: 'badge-success' }
const statusBadge: Record<string, string> = { open: 'badge-critical', in_progress: 'badge-warning', closed: 'badge-success', resolved: 'badge-success' }

function getUser() {
  try { return JSON.parse(localStorage.getItem('argus_user') || '{}') } catch { return {} }
}

function FindingsSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="panel p-5 flex items-center gap-4">
          <div className="skeleton w-10 h-10 rounded-lg skeleton-shimmer shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-32 skeleton-shimmer" />
            <div className="skeleton h-4 w-full max-w-md skeleton-shimmer" />
          </div>
          <div className="skeleton h-6 w-20 rounded-md skeleton-shimmer" />
        </div>
      ))}
    </div>
  )
}

export default function Findings() {
  const navigate = useNavigate()
  const [filterSeverity, setFilterSeverity] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('severity')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkStatus, setBulkStatus] = useState<string>('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [findings, setFindings] = useState<Finding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeFinding, setActiveFinding] = useState<Finding | null>(null)

  const user = getUser()
  const orgId = user?.org_id

  useEffect(() => {
    if (!orgId) return
    fetchFindings()
  }, [orgId])

  async function fetchFindings() {
    setLoading(true)
    try {
      const params: any = {}
      if (filterSeverity !== 'all') params.severity = filterSeverity
      if (filterType !== 'all') params.type = filterType
      const res = await findingsApi.list(orgId, params)
      setFindings(res.data.map((f: any) => ({
        id: f.id,
        type: f.type,
        severity: f.severity,
        description: f.description,
        department: 'TBD',
        obligation: f.obligation_id?.slice(0, 8) || 'Unknown',
        status: f.status
      })))
    } catch (err: any) {
      setError(err?.message || 'Failed to load findings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (orgId) fetchFindings()
  }, [filterSeverity, filterType])

  const toggleSelect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const handleBulkUpdate = async () => {
    if (!bulkStatus || selectedIds.length === 0) return
    setBulkLoading(true)
    try {
      await Promise.all(selectedIds.map(id => findingsApi.update(id, { status: bulkStatus })))
      await fetchFindings()
      setSelectedIds([])
      setBulkStatus('')
    } catch (err: any) {
      alert("Failed to update findings: " + err.message)
    } finally {
      setBulkLoading(false)
    }
  }

  const sortedFindings = [...findings].sort((a, b) => {
    if (sortBy === 'severity') {
      const val: any = { high: 3, medium: 2, low: 1 }
      return sortOrder === 'desc' ? val[a.severity] - val[b.severity] : val[b.severity] - val[a.severity]
    }
    if (sortBy === 'status') {
      return sortOrder === 'asc' ? a.status.localeCompare(b.status) : b.status.localeCompare(a.status)
    }
    return 0
  })

  const highCount = findings.filter(f => f.severity === 'high').length
  const mediumCount = findings.filter(f => f.severity === 'medium').length
  const lowCount = findings.filter(f => f.severity === 'low').length

  if (error) {
    return (
      <div className="p-8 max-w-2xl">
        <div className="panel p-8">
          <AlertTriangle className="w-8 h-8 text-argus-critical mb-4" />
          <p className="text-argus-text font-medium mb-1">Unable to load findings</p>
          <p className="text-sm text-argus-text-secondary">{error}</p>
          <button onClick={fetchFindings} className="mt-5 btn-primary">Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 relative z-10 p-8 max-w-[1600px] mx-auto argus-ground">
      <div className="flex items-center justify-between border-b border-argus-line pb-5">
        <div>
          <p className="eyebrow mb-1">Investigation Center</p>
          <h2 className="font-display text-2xl font-bold text-argus-text tracking-tight">Findings &amp; Gaps</h2>
        </div>
        <p className="text-sm text-argus-text-faint">Results from Regulatory Stress Test</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="kpi-card border-l-2 border-l-argus-critical">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow mb-2">High Severity</p>
              <p className="font-display text-3xl font-bold text-argus-critical tabular-nums">{loading ? '–' : highCount}</p>
            </div>
            <AlertTriangle className="w-6 h-6 text-argus-critical/60" />
          </div>
        </div>
        <div className="kpi-card border-l-2 border-l-argus-warning">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow mb-2">Medium Severity</p>
              <p className="font-display text-3xl font-bold text-argus-warning tabular-nums">{loading ? '–' : mediumCount}</p>
            </div>
            <AlertTriangle className="w-6 h-6 text-argus-warning/60" />
          </div>
        </div>
        <div className="kpi-card border-l-2 border-l-argus-success">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow mb-2">Low Severity</p>
              <p className="font-display text-3xl font-bold text-argus-success tabular-nums">{loading ? '–' : lowCount}</p>
            </div>
            <AlertTriangle className="w-6 h-6 text-argus-success/60" />
          </div>
        </div>
      </div>

      <div className="panel p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-argus-text-faint" />
          <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)} className="input-field !py-2 !w-auto text-sm">
            <option value="all">All Severities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="input-field !py-2 !w-auto text-sm">
            <option value="all">All Types</option>
            <option value="unimplemented">Unimplemented</option>
            <option value="outdated_procedure">Outdated</option>
            <option value="policy_conflict">Conflict</option>
            <option value="workflow_gap">Workflow</option>
            <option value="missing_evidence">Evidence</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-argus-text-faint" />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="input-field !py-2 !w-auto text-sm">
            <option value="severity">Sort by Severity</option>
            <option value="status">Sort by Status</option>
          </select>
          <button onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} className="btn-ghost !px-2.5">
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="bg-argus-accent/[0.08] border border-argus-accent/30 rounded-xl p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <CheckSquare className="w-4 h-4 text-argus-accent" />
              <span className="font-medium text-argus-text">{selectedIds.length} findings selected</span>
            </div>
            <div className="flex items-center gap-3">
              <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)} className="input-field !py-2 !w-auto text-sm">
                <option value="">Update Status…</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="closed">Closed</option>
                <option value="resolved">Resolved</option>
              </select>
              <button onClick={handleBulkUpdate} disabled={!bulkStatus || bulkLoading} className="btn-primary !py-2 text-sm">
                {bulkLoading && <Loader2 className="w-3 h-3 animate-spin" />} Apply
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <FindingsSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {sortedFindings.length > 0 ? sortedFindings.map((finding, i) => {
            const typeInfo = typeConfig[finding.type] || { icon: FileText, label: finding.type }
            const TypeIcon = typeInfo.icon
            const isSelected = selectedIds.includes(finding.id)
            return (
              <motion.div
                key={finding.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
                onClick={() => setActiveFinding(finding)}
                className={`panel p-5 transition-colors cursor-pointer group flex items-start gap-4 hover:border-white/20 ${isSelected ? '!border-argus-accent/50' : ''}`}
              >
                <div onClick={(e) => toggleSelect(e, finding.id)} className={`mt-0.5 shrink-0 w-5 h-5 rounded-md border flex items-center justify-center cursor-pointer transition-colors ${isSelected ? 'bg-argus-accent border-argus-accent' : 'border-argus-line hover:border-argus-accent'}`}>
                  {isSelected && <CheckSquare className="w-3.5 h-3.5 text-argus-bg" />}
                </div>

                <div className="w-10 h-10 rounded-lg flex items-center justify-center border border-argus-line bg-white/[0.02] shrink-0"><TypeIcon className="w-5 h-5 text-argus-text-secondary" /></div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`badge ${severityBadge[finding.severity] || 'badge-neutral'}`}>{finding.severity}</span>
                    <span className="badge badge-neutral">{typeInfo.label}</span>
                  </div>
                  <p className="text-sm font-medium text-argus-text-secondary group-hover:text-argus-text transition-colors leading-relaxed">{finding.description}</p>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <span className={`badge ${statusBadge[finding.status] || 'badge-neutral'}`}>{finding.status.replace('_', ' ')}</span>
                  <ArrowUpRight className="w-4 h-4 text-argus-text-faint group-hover:text-argus-accent transition-colors" />
                </div>
              </motion.div>
            )
          }) : (
            <div className="text-center py-20 text-argus-text-faint panel">No findings yet. Run a stress test on a circular.</div>
          )}
        </div>
      )}

      {/* Premium side drawer */}
      <AnimatePresence>
        {activeFinding && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setActiveFinding(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-argus-bg2 border-l border-argus-line z-50 overflow-y-auto shadow-elevate-lg"
            >
              <div className="p-6 border-b border-argus-line flex items-center justify-between sticky top-0 bg-argus-bg2/95 backdrop-blur-xl z-10">
                <div>
                  <p className="eyebrow mb-1">Finding Detail</p>
                  <h3 className="font-display text-lg font-semibold text-argus-text">#{activeFinding.id.slice(0, 8)}</h3>
                </div>
                <button onClick={() => setActiveFinding(null)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-argus-text-secondary" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex items-center gap-2">
                  <span className={`badge ${severityBadge[activeFinding.severity] || 'badge-neutral'}`}>{activeFinding.severity} severity</span>
                  <span className={`badge ${statusBadge[activeFinding.status] || 'badge-neutral'}`}>{activeFinding.status.replace('_', ' ')}</span>
                </div>

                <div>
                  <p className="eyebrow mb-2">Description</p>
                  <p className="text-sm text-argus-text leading-relaxed">{activeFinding.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="panel p-4">
                    <p className="eyebrow mb-2 flex items-center gap-1.5"><User className="w-3 h-3" /> Owner</p>
                    <p className="text-sm text-argus-text-secondary">{activeFinding.department}</p>
                  </div>
                  <div className="panel p-4">
                    <p className="eyebrow mb-2 flex items-center gap-1.5"><Link2 className="w-3 h-3" /> Obligation</p>
                    <p className="text-sm font-mono text-argus-text-secondary">{activeFinding.obligation}</p>
                  </div>
                </div>

                <div>
                  <p className="eyebrow mb-2">Type</p>
                  <span className="badge badge-neutral">{(typeConfig[activeFinding.type] || { label: activeFinding.type }).label}</span>
                </div>

                <button
                  onClick={() => navigate(`/findings/${activeFinding.id}/replay`)}
                  className="btn-primary w-full"
                >
                  Open Full Regulatory Replay <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
