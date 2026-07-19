import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Check, Trash2, Plus, Edit2, Save, X, Activity, Loader2, AlertTriangle } from 'lucide-react'
import { obligationsApi, circularsApi, findingsApi } from '../services/api'

interface Obligation {
  id: string
  circular_id: string
  description: string
  deadline: string | null
  applicability: string | null
  source_ref: string | null
  status: 'ai_extracted' | 'confirmed' | 'edited' | 'manually_added'
}

const statusBadge: Record<string, string> = {
  confirmed: 'badge-success',
  edited: 'badge-warning',
  manually_added: 'badge-neutral',
  ai_extracted: 'badge-info',
}
const statusLabel: Record<string, string> = {
  confirmed: 'Confirmed', edited: 'Edited', manually_added: 'Manually Added', ai_extracted: 'AI Extracted',
}

export default function Obligations() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [obligations, setObligations] = useState<Obligation[]>([])
  const [circular, setCircular] = useState<any>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Obligation>>({})

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isStressTesting, setIsStressTesting] = useState(false)
  const [isConfirmingAll, setIsConfirmingAll] = useState(false)

  const tableParentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (id) {
      fetchData()
    }
  }, [id])

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const [oblRes, circRes] = await Promise.all([
        obligationsApi.list(id!),
        circularsApi.get(id!)
      ])
      setObligations(oblRes.data)
      setCircular(circRes.data)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to load obligations')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (obligation: Obligation) => {
    setEditingId(obligation.id)
    setEditForm({ ...obligation })
  }

  const handleSave = async () => {
    if (editingId && editForm) {
      try {
        await obligationsApi.update(editingId, {
          description: editForm.description,
          deadline: editForm.deadline || undefined,
          applicability: editForm.applicability || undefined,
          source_ref: editForm.source_ref || undefined,
          status: 'edited'
        })
        setEditingId(null)
        setEditForm({})
        await fetchData()
      } catch (err: any) {
        setError('Failed to save obligation')
      }
    }
  }

  const handleDelete = async (obligationId: string) => {
    if (window.confirm('Are you sure you want to delete this obligation?')) {
      try {
        await obligationsApi.delete(obligationId)
        await fetchData()
      } catch (err: any) {
        setError('Failed to delete obligation')
      }
    }
  }

  const handleAdd = async () => {
    try {
      await obligationsApi.create({
        circular_id: id!,
        description: 'New obligation requirement description',
        deadline: new Date().toISOString().split('T')[0],
        applicability: 'All MIIs',
        source_ref: 'Section 1.1'
      })
      await fetchData()
    } catch (err: any) {
      setError('Failed to add obligation')
    }
  }

  const handleConfirmAll = async () => {
    setIsConfirmingAll(true)
    try {
      const aiExtracted = obligations.filter(o => o.status === 'ai_extracted')
      await Promise.all(
        aiExtracted.map(o => obligationsApi.update(o.id, { status: 'confirmed' }))
      )
      await fetchData()
    } catch (err: any) {
      setError('Failed to confirm obligations')
    } finally {
      setIsConfirmingAll(false)
    }
  }

  const handleRunStressTest = async () => {
    setIsStressTesting(true)
    setError('')
    try {
      const aiExtracted = obligations.filter(o => o.status === 'ai_extracted')
      if (aiExtracted.length > 0) {
        await Promise.all(
          aiExtracted.map(o => obligationsApi.update(o.id, { status: 'confirmed' }))
        )
      }
      await findingsApi.runStressTest(id!)
      navigate('/findings')
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to run stress test')
    } finally {
      setIsStressTesting(false)
    }
  }

  // Row virtualization for the enterprise data grid — matters once an org accumulates
  // obligations across many circulars; harmless overhead for small lists too.
  const rowVirtualizer = useVirtualizer({
    count: obligations.length,
    getScrollElement: () => tableParentRef.current,
    estimateSize: () => 56,
    overscan: 8,
  })

  return (
    <div className="space-y-6 p-8 max-w-[1600px] mx-auto argus-ground">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-argus-line pb-5">
        <div>
          <p className="eyebrow mb-1">Enterprise Data Grid</p>
          <h2 className="font-display text-2xl font-bold text-argus-text">Obligations</h2>
          {circular && (
            <p className="text-sm text-argus-text-faint mt-1">
              Reviewing: <span className="font-medium text-argus-text-secondary">{circular.title}</span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleAdd} disabled={loading} className="btn-secondary text-sm">
            <Plus className="w-4 h-4" />
            Add Obligation
          </button>
          <button
            onClick={handleConfirmAll}
            disabled={loading || isConfirmingAll || obligations.filter(o => o.status === 'ai_extracted').length === 0}
            className="inline-flex items-center justify-center gap-2 bg-argus-success/15 border border-argus-success/30 text-argus-success font-medium rounded-lg px-4 py-2.5 transition-all hover:bg-argus-success/25 disabled:opacity-40 disabled:pointer-events-none text-sm"
          >
            {isConfirmingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Confirm All
          </button>
          <button
            onClick={handleRunStressTest}
            disabled={loading || isStressTesting || obligations.length === 0}
            className="btn-primary text-sm"
          >
            {isStressTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
            Run Stress Test
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-argus-critical/[0.08] border border-argus-critical/30 rounded-lg flex items-center gap-3 text-argus-critical">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      <div className="panel overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-10 w-full skeleton-shimmer" />)}
          </div>
        ) : obligations.length > 0 ? (
          <div>
            {/* Sticky header */}
            <table className="w-full data-table">
              <thead>
                <tr>
                  <th className="w-8">#</th>
                  <th>Description</th>
                  <th className="w-36">Deadline</th>
                  <th className="w-48">Applicability</th>
                  <th className="w-32">Source Ref</th>
                  <th className="w-32">Status</th>
                  <th className="w-24">Actions</th>
                </tr>
              </thead>
            </table>

            {/* Virtualized scroll body */}
            <div ref={tableParentRef} className="overflow-y-auto" style={{ maxHeight: '640px' }}>
              <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                <table className="w-full absolute top-0 left-0 data-table">
                  <tbody>
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const obligation = obligations[virtualRow.index]
                      const index = virtualRow.index
                      return (
                        <tr
                          key={obligation.id}
                          style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualRow.start}px)` }}
                          className="hover:bg-white/[0.02] transition-colors"
                        >
                          {editingId === obligation.id ? (
                            <>
                              <td className="font-mono">{index + 1}</td>
                              <td>
                                <textarea
                                  value={editForm.description || ''}
                                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                  className="input-field !py-1.5 text-sm"
                                  rows={2}
                                />
                              </td>
                              <td>
                                <input type="date" value={editForm.deadline || ''} onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })} className="input-field !py-1.5 text-sm" />
                              </td>
                              <td>
                                <input type="text" value={editForm.applicability || ''} onChange={(e) => setEditForm({ ...editForm, applicability: e.target.value })} className="input-field !py-1.5 text-sm" />
                              </td>
                              <td>
                                <input type="text" value={editForm.source_ref || ''} onChange={(e) => setEditForm({ ...editForm, source_ref: e.target.value })} className="input-field !py-1.5 text-sm" />
                              </td>
                              <td><span className="badge badge-warning">editing</span></td>
                              <td>
                                <div className="flex gap-1">
                                  <button onClick={handleSave} className="p-1.5 text-argus-success hover:bg-argus-success/10 rounded-md"><Save className="w-4 h-4" /></button>
                                  <button onClick={() => setEditingId(null)} className="p-1.5 text-argus-text-faint hover:bg-white/10 rounded-md"><X className="w-4 h-4" /></button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="font-mono">{String(index + 1).padStart(2, '0')}</td>
                              <td className="text-argus-text font-medium">{obligation.description}</td>
                              <td className="font-mono">{obligation.deadline ? new Date(obligation.deadline).toLocaleDateString() : 'N/A'}</td>
                              <td>{obligation.applicability || 'N/A'}</td>
                              <td className="font-mono text-argus-text-faint">{obligation.source_ref || 'N/A'}</td>
                              <td><span className={`badge ${statusBadge[obligation.status] || 'badge-neutral'}`}>{statusLabel[obligation.status] || obligation.status}</span></td>
                              <td>
                                <div className="flex gap-1">
                                  <button onClick={() => handleEdit(obligation)} className="p-1.5 text-argus-text-faint hover:text-argus-accent hover:bg-white/10 rounded-md" title="Edit"><Edit2 className="w-4 h-4" /></button>
                                  <button onClick={() => handleDelete(obligation.id)} className="p-1.5 text-argus-text-faint hover:text-argus-critical hover:bg-white/10 rounded-md" title="Delete"><Trash2 className="w-4 h-4" /></button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-12 text-center text-argus-text-faint">
            No obligations found for this circular.
          </div>
        )}
      </div>
    </div>
  )
}
