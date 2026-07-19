import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle, Info, FileText, Scale, BookOpen, RefreshCw, CheckCircle2, XCircle, ShieldAlert, Wrench } from 'lucide-react'
import { replayApi } from '../services/api'

interface ReplayChainItem {
  entity_type: string
  label: string
}

interface RegulatoryReplayData {
  id: string
  finding_id: string
  chain_json: ReplayChainItem[]
  explanation: string
  generated_at: string
}

const NODE_CONFIG: Record<string, {
  icon: React.ElementType
  color: string
  labelColor: string
}> = {
  circular:   { icon: FileText,    color: 'text-argus-blue',     labelColor: 'text-argus-blue' },
  obligation: { icon: Scale,       color: 'text-argus-warning',  labelColor: 'text-argus-warning' },
  policy:     { icon: BookOpen,    color: 'text-argus-success',  labelColor: 'text-argus-success' },
  workflow:   { icon: RefreshCw,   color: 'text-argus-blue',     labelColor: 'text-argus-blue' },
  evidence:   { icon: CheckCircle2,color: 'text-argus-success',  labelColor: 'text-argus-success' },
  gap:        { icon: XCircle,     color: 'text-argus-critical', labelColor: 'text-argus-critical' },
  risk:       { icon: ShieldAlert, color: 'text-argus-critical', labelColor: 'text-argus-critical' },
  fix:        { icon: Wrench,      color: 'text-argus-success',  labelColor: 'text-argus-success' },
}

export default function RegulatoryReplayPage() {
  const { findingId } = useParams<{ findingId: string }>()
  const [replay, setReplay] = useState<RegulatoryReplayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    if (!findingId) return
    fetchReplay()
  }, [findingId])

  useEffect(() => {
    if (replay) {
      const timer = setInterval(() => {
        setActiveStep(prev => {
          if (prev >= replay.chain_json.length - 1) return 0
          return prev + 1
        })
      }, 2500)
      return () => clearInterval(timer)
    }
  }, [replay])

  async function fetchReplay() {
    setLoading(true)
    setError('')
    try {
      const res = await replayApi.get(findingId!)
      setReplay(res.data)
    } catch (err: any) {
      setError(err?.message || 'Failed to load replay')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-6">
        <div className="skeleton h-8 w-64 skeleton-shimmer" />
        <div className="panel p-8 space-y-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-6">
              <div className="skeleton w-14 h-14 rounded-xl skeleton-shimmer shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3 w-24 skeleton-shimmer" />
                <div className="skeleton h-4 w-full max-w-md skeleton-shimmer" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error || !replay) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-10 h-10 text-argus-text-faint mx-auto mb-4" />
        <h3 className="font-display text-lg font-medium text-argus-text-secondary">No replay data found</h3>
        <p className="text-sm text-argus-text-faint mt-2">This finding does not have a regulatory replay chain yet.</p>
        {error && <p className="text-sm text-argus-critical mt-2">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-6 p-8 max-w-5xl mx-auto argus-ground">
      <div className="border-b border-argus-line pb-5">
        <p className="eyebrow mb-1">Investigation Trace</p>
        <h2 className="font-display text-2xl font-bold text-argus-text">Regulatory Replay</h2>
        <p className="text-sm text-argus-text-faint mt-1">From regulation to root cause</p>
      </div>

      {/* Investigation Board */}
      <div className="panel p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <span className="badge badge-critical">Active Investigation</span>
            <span className="font-mono text-xs text-argus-text-faint">Finding #{findingId?.slice(0, 8)}</span>
          </div>
          <div className="text-xs text-argus-text-faint">Auto-scrolling · Click any step to pause</div>
        </div>

        <div className="relative">
          {replay.chain_json.map((item, index) => {
            const config = NODE_CONFIG[item.entity_type] || NODE_CONFIG['circular']
            const NodeIcon = config.icon
            const isActive = index === activeStep
            const isPast = index < activeStep
            const isLast = index === replay.chain_json.length - 1

            return (
              <div
                key={index}
                onClick={() => setActiveStep(index)}
                className={`relative flex items-center gap-6 transition-opacity duration-500 cursor-pointer pb-8 last:pb-0 ${
                  isActive ? 'opacity-100' : isPast ? 'opacity-55' : 'opacity-30'
                }`}
              >
                {!isLast && (
                  <div className="absolute left-7 top-16 bottom-0 w-px bg-argus-line z-0">
                    <motion.div
                      className="w-px bg-argus-accent origin-top"
                      style={{ height: '100%' }}
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: isPast || isActive ? 1 : 0 }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                )}

                <div className="relative z-10 flex-shrink-0">
                  <motion.div
                    animate={{ scale: isActive ? 1.1 : 1 }}
                    transition={{ duration: 0.3 }}
                    className={`w-14 h-14 rounded-xl flex items-center justify-center border transition-colors duration-300 ${
                      isActive ? 'bg-argus-bg2 border-argus-accent shadow-glow-accent' : 'bg-argus-bg2 border-argus-line'
                    }`}
                  >
                    <NodeIcon className={`w-6 h-6 ${config.color}`} />
                  </motion.div>
                </div>

                <div className={`flex-1 py-3 transition-transform duration-300 ${isActive ? 'translate-x-1' : ''}`}>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`font-mono text-[11px] font-semibold uppercase tracking-wider ${config.labelColor}`}>{item.entity_type}</span>
                    {item.entity_type === 'gap' && <span className="badge badge-critical">Gap Detected</span>}
                    {item.entity_type === 'risk' && <span className="badge badge-critical">High Severity</span>}
                    {item.entity_type === 'fix' && <span className="badge badge-success">Recommended</span>}
                    {isActive && <span className="badge badge-accent">▶ Current Step</span>}
                  </div>
                  <p className={`text-sm font-medium leading-relaxed ${isActive ? 'text-argus-text' : 'text-argus-text-faint'}`}>{item.label}</p>

                  {item.entity_type === 'gap' && isActive && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-4 rounded-xl border border-argus-critical/30 bg-argus-critical/[0.05]">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="space-y-2">
                          <h4 className="eyebrow">What the Circular Required</h4>
                          <div className="p-3 bg-white/[0.02] border border-argus-line rounded-lg">
                            <p className="text-sm text-argus-text-secondary italic">
                              "{replay.chain_json.find(x => x.entity_type === 'obligation')?.label || 'Missing Obligation'}"
                            </p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <h4 className="eyebrow">What Internal Policy Covered</h4>
                          <div className="p-3 bg-white/[0.02] border border-argus-line rounded-lg">
                            <p className="text-sm text-argus-text-secondary italic">
                              "{replay.chain_json.find(x => x.entity_type === 'policy')?.label || 'No matching policy found'}"
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="pt-3 border-t border-argus-critical/20">
                        <h4 className="eyebrow !text-argus-critical mb-1">The Gap</h4>
                        <p className="text-sm text-argus-text font-medium">{item.label}</p>
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-semibold transition-colors ${
                  isActive ? 'bg-argus-accent text-argus-bg' : isPast ? 'bg-white/10 text-argus-text-secondary' : 'bg-argus-bg2 text-argus-text-faint border border-argus-line'
                }`}>
                  {index + 1}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-4 flex items-center gap-2">
          {replay.chain_json.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveStep(i)}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === activeStep ? 'w-8 bg-argus-accent' : i < activeStep ? 'w-3 bg-argus-accent/40' : 'w-3 bg-argus-line'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Explanation Card */}
      <div className="panel p-6 border-l-2 border-l-argus-accent">
        <div className="flex items-start gap-4">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center border border-argus-accent/40 bg-argus-accent/10 flex-shrink-0">
            <Info className="w-4 h-4 text-argus-accent" />
          </div>
          <div>
            <p className="eyebrow mb-2">Argus Advisor Analysis</p>
            <p className="text-sm text-argus-text-secondary leading-relaxed whitespace-pre-wrap">{replay.explanation}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <button className="btn-primary">Add to Action Plan</button>
        <button className="btn-secondary">Upload Evidence</button>
      </div>
    </div>
  )
}
