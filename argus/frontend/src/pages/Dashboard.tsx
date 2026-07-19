import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle, Info, TrendingUp, TrendingDown, ShieldAlert, ListTodo, FileWarning, ArrowUpRight } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { dashboardApi, circularsApi, readinessApi, findingsApi } from '../services/api'
import WhyModal from '../components/WhyModal'
import { useLanguage } from '../context/LanguageContext'

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('argus_user') || '{}')
  } catch { return {} }
}

// Custom SVG radial gauge for the RRI score — the dashboard's signature element.
function RRIGauge({ value }: { value: number }) {
  const radius = 72
  const stroke = 10
  const normalized = Math.max(0, Math.min(100, value))
  const circumference = 2 * Math.PI * radius
  const arcFraction = 0.75 // 270-degree gauge
  const arcLength = circumference * arcFraction
  const offset = arcLength - (normalized / 100) * arcLength
  const color = normalized >= 80 ? '#3AA187' : normalized >= 60 ? '#D89B3C' : '#C9684A'

  return (
    <div className="relative w-44 h-44 flex items-center justify-center shrink-0">
      <svg width="176" height="176" viewBox="0 0 176 176" className="-rotate-[135deg]">
        <circle
          cx="88" cy="88" r={radius}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeLinecap="round"
        />
        <motion.circle
          cx="88" cy="88" r={radius}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeLinecap="round"
          initial={{ strokeDashoffset: arcLength }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: `drop-shadow(0 0 8px ${color}66)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-4xl font-bold text-argus-text tabular-nums">{normalized.toFixed(0)}</span>
        <span className="eyebrow mt-0.5">RRI Score</span>
      </div>
    </div>
  )
}

function KPICardSkeleton() {
  return (
    <div className="kpi-card">
      <div className="skeleton h-3 w-20 mb-3 skeleton-shimmer" />
      <div className="skeleton h-8 w-14 skeleton-shimmer" />
    </div>
  )
}

export default function Dashboard() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [stats, setStats] = useState<any>(null)
  const [rriData, setRriData] = useState<any[]>([])
  const [circulars, setCirculars] = useState<any[]>([])
  const [findings, setFindings] = useState<any[]>([])
  const [whyModalOpen, setWhyModalOpen] = useState(false)
  const [whyComponent, setWhyComponent] = useState({ name: '', score: 0, weight: 0 })
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({})

  const user = getUser()
  const orgId = user?.org_id

  const openWhy = (name: string, score: number, weight: number) => {
    setWhyComponent({ name, score, weight })
    setWhyModalOpen(true)
  }

  useEffect(() => {
    if (!orgId) {
      setLoading(false)
      return
    }
    fetchAll()
  }, [orgId])

  async function fetchAll() {
    setLoading(true)
    setError('')
    setSectionErrors({})

    const [statsRes, rriRes, circRes, findRes] = await Promise.allSettled([
      dashboardApi.getStats(orgId),
      readinessApi.getTrend(orgId, 30),
      circularsApi.list(orgId),
      findingsApi.list(orgId),
    ])

    const errors: Record<string, string> = {}

    if (statsRes.status === 'fulfilled') {
      setStats(statsRes.value.data)
    } else {
      setStats(null)
      errors.stats = 'Unable to load RRI summary'
    }

    if (rriRes.status === 'fulfilled') {
      setRriData(rriRes.value.data.map((s: any) => ({
        date: new Date(s.computed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        rri: parseFloat(s.overall_score)
      })).reverse())
    } else {
      setRriData([])
      errors.trend = 'Unable to load RRI trend'
    }

    if (circRes.status === 'fulfilled') {
      setCirculars(circRes.value.data.slice(0, 5))
    } else {
      setCirculars([])
      errors.circulars = 'Unable to load circulars'
    }

    if (findRes.status === 'fulfilled') {
      setFindings(findRes.value.data)
    } else {
      setFindings([])
      errors.findings = 'Unable to load findings'
    }

    setSectionErrors(errors)
    // Only block the whole page for a total network/auth failure (every section failed);
    // partial failures are shown per-section instead so real data isn't hidden behind
    // one unrelated endpoint going down.
    if (Object.keys(errors).length === 4) {
      setError('Unable to reach the server. Please check your connection and try again.')
    }
    setLoading(false)
  }

  const currentRRI = stats?.current_rri ? parseFloat(stats.current_rri) : 0
  const previousRRI = rriData.length > 1 ? rriData[rriData.length - 2]?.rri : currentRRI
  const rriChange = currentRRI - previousRRI

  const highRiskCount = findings.filter((f: any) => f.severity === 'high').length
  const totalFindings = findings.length

  const rriComponents = stats?.rri_components ? [
    { name: t('policy_alignment' as any), score: stats.rri_components.policy_alignment, weight: 25 },
    { name: t('control_coverage' as any), score: stats.rri_components.control_coverage, weight: 25 },
    { name: t('evidence_completeness' as any), score: stats.rri_components.evidence_completeness, weight: 20 },
    { name: t('workflow_readiness' as any), score: stats.rri_components.workflow_readiness, weight: 15 },
    { name: t('employee_readiness' as any), score: stats.rri_components.employee_readiness, weight: 15 },
  ] : []

  const highRiskFindings = findings.filter((f: any) => f.severity === 'high').slice(0, 3)

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'stress_tested': return 'badge-warning'
      case 'mapped': return 'badge-info'
      case 'uploaded': return 'badge-neutral'
      default: return 'badge-neutral'
    }
  }

  if (loading) {
    return (
      <div className="p-8 max-w-[1600px] mx-auto space-y-8 argus-ground">
        <div className="skeleton h-10 w-72 skeleton-shimmer" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="panel p-6 flex items-center justify-center"><div className="skeleton w-32 h-32 rounded-full skeleton-shimmer" /></div>
          <div className="md:col-span-3 grid grid-cols-2 gap-4">
            <KPICardSkeleton /><KPICardSkeleton /><KPICardSkeleton /><KPICardSkeleton />
          </div>
        </div>
        <div className="skeleton h-64 w-full skeleton-shimmer" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-left py-12 px-8 max-w-2xl">
        <div className="panel p-8">
          <AlertTriangle className="w-8 h-8 text-argus-critical mb-4" />
          <p className="text-argus-text font-medium mb-1">Unable to load dashboard</p>
          <p className="text-sm text-argus-text-secondary">{error}</p>
          <button onClick={fetchAll} className="mt-5 btn-primary">Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8 relative z-10 argus-ground">
      {/* Page header */}
      <div className="flex items-center justify-between border-b border-argus-line pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="live-dot" />
            <p className="eyebrow">Live · Executive Overview</p>
          </div>
          <h1 className="font-display text-2xl font-bold text-argus-text tracking-tight">{t('executive_summary' as any)}</h1>
        </div>
        <span className="font-mono text-xs text-argus-text-faint">{t('updated' as any)} {new Date().toLocaleDateString()}</span>
      </div>

      {Object.keys(sectionErrors).length > 0 && Object.keys(sectionErrors).length < 4 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-argus-warning/30 bg-argus-warning/[0.06] text-sm text-argus-warning">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Some data couldn't be loaded ({Object.values(sectionErrors).join(', ')}). Figures shown below are real; affected sections are marked.</span>
          <button onClick={fetchAll} className="ml-auto underline hover:text-argus-text shrink-0">Retry all</button>
        </div>
      )}

      {/* RRI Gauge + KPIs */}
      <section className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="lg:col-span-1 panel p-6 flex flex-col items-center justify-center gap-3"
        >
          {sectionErrors.stats ? (
            <div className="w-44 h-44 flex flex-col items-center justify-center gap-2 text-center">
              <AlertTriangle className="w-6 h-6 text-argus-text-faint" />
              <p className="text-xs text-argus-text-faint">{sectionErrors.stats}</p>
            </div>
          ) : (
            <>
              <RRIGauge value={currentRRI} />
              <div className={`flex items-center gap-1.5 text-sm font-medium ${rriChange >= 0 ? 'text-argus-success' : 'text-argus-critical'}`}>
                {rriChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {Math.abs(rriChange).toFixed(1)} pts <span className="text-argus-text-faint font-normal">{t('from_last' as any)}</span>
              </div>
            </>
          )}
        </motion.div>

        <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: t('high_risks' as any), value: sectionErrors.findings ? null : highRiskCount, icon: ShieldAlert, tone: 'critical' as const },
            { label: t('open_obligations' as any), value: sectionErrors.stats ? null : (stats?.total_obligations ?? 0), icon: FileWarning, tone: 'warning' as const },
            { label: t('total_findings' as any), value: sectionErrors.findings ? null : totalFindings, icon: AlertTriangle, tone: 'info' as const },
            { label: t('action_items' as any), value: sectionErrors.stats ? null : (stats?.total_action_items ?? 0), icon: ListTodo, tone: 'accent' as const },
          ].map((kpi, i) => {
            const toneMap = {
              critical: { border: 'border-l-argus-critical', icon: 'text-argus-critical' },
              warning: { border: 'border-l-argus-warning', icon: 'text-argus-warning' },
              info: { border: 'border-l-argus-blue', icon: 'text-argus-blue' },
              accent: { border: 'border-l-argus-accent', icon: 'text-argus-accent' },
            }
            const tone = toneMap[kpi.tone]
            return (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className={`kpi-card border-l-2 ${tone.border}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <p className="eyebrow">{kpi.label}</p>
                  <kpi.icon className={`w-4 h-4 ${tone.icon}`} />
                </div>
                <p className={`font-display text-3xl font-bold tabular-nums ${kpi.value === null ? 'text-argus-text-faint' : 'text-argus-text'}`}>
                  {kpi.value === null ? '—' : kpi.value}
                </p>
              </motion.div>
            )
          })}

          {/* RRI component breakdown, spans full width of KPI area */}
          <div className="col-span-2 md:col-span-4 panel p-6">
            <h3 className="eyebrow mb-5">{t('regulatory_readiness_index' as any)}</h3>
            {sectionErrors.stats ? (
              <div className="flex items-center gap-3 py-6 text-argus-text-faint">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">{sectionErrors.stats}. <button onClick={fetchAll} className="text-argus-accent hover:underline">Retry</button></span>
              </div>
            ) : rriComponents.length === 0 ? (
              <div className="py-6 text-sm text-argus-text-faint">No RRI breakdown available yet.</div>
            ) : (
            <div className="space-y-4">
              {rriComponents.map((comp, i) => (
                <motion.div
                  key={comp.name}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.05 }}
                  className="flex items-center gap-4"
                >
                  <div className="w-40 shrink-0 flex justify-between items-center">
                    <span className="text-sm text-argus-text-secondary font-medium truncate">{comp.name}</span>
                    <button onClick={() => openWhy(comp.name, comp.score, comp.weight)} className="text-argus-text-faint hover:text-argus-accent transition-colors ml-2 shrink-0" title="Details">
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex-1 flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full relative overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${comp.score}%` }}
                        transition={{ duration: 0.8, delay: 0.2 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                        className={`absolute top-0 left-0 h-full rounded-full ${comp.score >= 80 ? 'bg-argus-success' : comp.score >= 60 ? 'bg-argus-warning' : 'bg-argus-critical'}`}
                      />
                    </div>
                    <span className="font-mono text-sm font-semibold text-argus-text w-8 text-right tabular-nums">{comp.score}</span>
                  </div>
                </motion.div>
              ))}
            </div>
            )}
          </div>
        </div>
      </section>

      {/* At Risk Callout */}
      {highRiskFindings.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="panel border-l-2 border-l-argus-critical p-6"
        >
          <div className="flex items-start justify-between mb-4">
            <h3 className="font-display text-base font-semibold text-argus-text flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-argus-critical" />
              {t('at_risk_obligations' as any)}
            </h3>
            <button onClick={() => navigate('/findings')} className="btn-ghost text-argus-critical text-sm !px-2 !py-1">
              {t('view_all_high_risk' as any)} <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-3">
            {highRiskFindings.map((finding: any) => (
              <div key={finding.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 border-b border-argus-line last:border-0 pb-3 last:pb-0">
                <p className="text-sm font-medium text-argus-text-secondary flex-1">{finding.description}</p>
                <span className="badge badge-critical">
                  {finding.department_id ? 'Assigned' : 'Unassigned'} · {t('action_required' as any)}
                </span>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Charts & Circulars */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="panel p-6">
          <h3 className="eyebrow mb-5">{t('rri_trend' as any)}</h3>
          <div className="h-64">
            {rriData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rriData} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorRri" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#B32A63" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#B32A63" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(233,215,224,0.06)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8A7D86' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[70, 90]} tick={{ fontSize: 11, fill: '#8A7D86' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#22111E', borderRadius: '8px', border: '1px solid rgba(233,215,224,0.1)', fontSize: '12px', color: '#FBF7F9' }} formatter={(value: number) => [`${value}`, 'RRI']} />
                  <Area type="monotone" dataKey="rri" stroke="#B32A63" strokeWidth={2} fillOpacity={1} fill="url(#colorRri)" activeDot={{ r: 5, fill: '#B32A63', stroke: '#0F0810', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : sectionErrors.trend ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-sm text-argus-text-faint">
                <AlertTriangle className="w-4 h-4" />
                <span>{sectionErrors.trend}</span>
                <button onClick={fetchAll} className="text-argus-accent hover:underline text-xs">Retry</button>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-argus-text-faint">{t('no_trend_data' as any)}</div>
            )}
          </div>
        </div>

        <div className="panel p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="eyebrow">{t('recent_circulars' as any)}</h3>
            <button onClick={() => navigate('/circulars')} className="text-xs font-medium text-argus-accent hover:text-argus-text transition-colors flex items-center gap-1">
              {t('upload_new_circular' as any)} <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-1">
            {circulars.length > 0 ? circulars.map((circular: any) => (
              <div key={circular.id} onClick={() => navigate(`/circulars/${circular.id}/obligations`)}
                className="p-3 rounded-lg flex items-start justify-between border border-transparent hover:border-argus-line hover:bg-white/[0.03] transition-all cursor-pointer group">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-argus-text-secondary group-hover:text-argus-text transition-colors truncate">{circular.title}</p>
                  <p className="font-mono text-xs text-argus-text-faint mt-1">{circular.effective_date || 'No date'}</p>
                </div>
                <span className={`badge ${getStatusBadge(circular.status)} shrink-0 ml-3`}>
                  {circular.status.replace('_', ' ')}
                </span>
              </div>
            )) : sectionErrors.circulars ? (
              <div className="py-8 flex flex-col items-center gap-2 text-sm text-argus-text-faint text-center">
                <AlertTriangle className="w-4 h-4" />
                <span>{sectionErrors.circulars}</span>
                <button onClick={fetchAll} className="text-argus-accent hover:underline text-xs">Retry</button>
              </div>
            ) : (
              <div className="py-8 text-sm text-argus-text-faint text-center">{t('no_circulars' as any)}</div>
            )}
          </div>
        </div>
      </section>

      {whyModalOpen && (
        <WhyModal
          component={whyComponent.name}
          score={whyComponent.score}
          weight={whyComponent.weight}
          onClose={() => setWhyModalOpen(false)}
        />
      )}
    </div>
  )
}
