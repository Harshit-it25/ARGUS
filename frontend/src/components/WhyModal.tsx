import { motion, AnimatePresence } from 'framer-motion'
import { X, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react'

interface WhyModalProps {
  component: string
  score: number
  weight: number
  onClose: () => void
}

const BREAKDOWNS: Record<string, {
  title: string
  formula: string
  steps: { label: string; value: string; status: 'ok' | 'warning' | 'critical' }[]
  impact: string
  recommendation: string
}> = {
  'Policy Alignment': {
    title: 'Why is Policy Alignment 85%?',
    formula: '(mapped obligations / total obligations) × 100',
    steps: [
      { label: 'Total obligations in circular', value: '8', status: 'ok' },
      { label: 'Obligations with policy mapping', value: '6', status: 'ok' },
      { label: 'Unmapped obligations', value: '2', status: 'critical' },
      { label: 'Raw calculation', value: '6 / 8 = 0.75', status: 'ok' },
      { label: 'Bonus: high-confidence mappings', value: '+10 pts', status: 'ok' },
    ],
    impact: 'Each unmapped obligation reduces Policy Alignment by 12.5 points.',
    recommendation: 'Map the 2 unmapped obligations (vendor cybersecurity, training) or create new policies.',
  },
  'Control Coverage': {
    title: 'Why is Control Coverage 80%?',
    formula: '(obligations without unimplemented finding / total) × 100',
    steps: [
      { label: 'Total obligations', value: '8', status: 'ok' },
      { label: 'Unimplemented findings', value: '1', status: 'critical' },
      { label: 'Covered obligations', value: '7', status: 'ok' },
      { label: 'Raw calculation', value: '7 / 8 = 0.875', status: 'ok' },
      { label: 'Weight in RRI', value: '25%', status: 'ok' },
    ],
    impact: 'The unimplemented vendor cybersecurity policy reduces Control Coverage by 12.5 points.',
    recommendation: 'Create a Third-Party Vendor Security Policy to cover the gap.',
  },
  'Evidence Completeness': {
    title: 'Why is Evidence Completeness 78%?',
    formula: '(present evidence items / total evidence required) × 100',
    steps: [
      { label: 'Total evidence required', value: '5', status: 'ok' },
      { label: 'Present evidence', value: '2', status: 'warning' },
      { label: 'Missing evidence', value: '2', status: 'critical' },
      { label: 'Stale evidence', value: '1', status: 'warning' },
      { label: 'Raw calculation', value: '2 / 5 = 0.40', status: 'ok' },
    ],
    impact: 'Missing evidence for 2 high-priority findings reduces this score significantly.',
    recommendation: 'Upload training completion records and vendor security assessment.',
  },
  'Workflow Readiness': {
    title: 'Why is Workflow Readiness 88%?',
    formula: '(obligations without workflow gap / total) × 100',
    steps: [
      { label: 'Total obligations', value: '8', status: 'ok' },
      { label: 'Workflow gaps detected', value: '1', status: 'warning' },
      { label: 'Workflow-ready obligations', value: '7', status: 'ok' },
      { label: 'Raw calculation', value: '7 / 8 = 0.875', status: 'ok' },
      { label: 'Weight in RRI', value: '15%', status: 'ok' },
    ],
    impact: 'KYC Onboarding Workflow missing quarterly reporting step.',
    recommendation: 'Add the quarterly cybersecurity reporting step to the KYC workflow.',
  },
  'Employee Readiness': {
    title: 'Why is Employee Readiness 75%?',
    formula: '(departments with training evidence / affected departments) × 100',
    steps: [
      { label: 'Departments affected', value: '4', status: 'ok' },
      { label: 'Departments with training evidence', value: '3', status: 'warning' },
      { label: 'Missing training: HR', value: 'No records Q1-Q2', status: 'critical' },
      { label: 'Raw calculation', value: '3 / 4 = 0.75', status: 'ok' },
    ],
    impact: 'HR department lacks documented cybersecurity training for Q1-Q2 2025.',
    recommendation: 'Schedule training and upload completion certificates for all affected departments.',
  },
}

export default function WhyModal({ component, score, weight, onClose }: WhyModalProps) {
  const breakdown = BREAKDOWNS[component] || {
    title: `Why is ${component} ${score}%?`,
    formula: 'Weighted calculation',
    steps: [{ label: 'Data', value: 'Loading...', status: 'ok' as const }],
    impact: 'Detailed breakdown coming from backend.',
    recommendation: 'Review the associated findings.',
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        role="dialog" aria-modal="true" aria-labelledby="why-modal-title"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="panel-solid max-w-lg w-full overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-argus-bg2/60 px-6 py-4 flex items-center justify-between border-b border-argus-line">
            <div>
              <p className="eyebrow mb-1">Score Breakdown</p>
              <h3 id="why-modal-title" className="font-display text-lg font-semibold text-argus-text">{breakdown.title}</h3>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors" aria-label="Close">
              <X className="w-5 h-5 text-argus-text-secondary" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            <div className="p-3 bg-white/[0.03] rounded-lg border border-argus-line">
              <p className="eyebrow mb-1">Formula</p>
              <p className="text-sm font-mono text-argus-text">{breakdown.formula}</p>
            </div>

            <div className="space-y-2">
              <p className="eyebrow">Calculation Steps</p>
              {breakdown.steps.map((step, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-lg border border-argus-line">
                  <div className="flex items-center gap-2">
                    {step.status === 'critical' ? (
                      <AlertTriangle className="w-4 h-4 text-argus-critical" />
                    ) : step.status === 'warning' ? (
                      <TrendingDown className="w-4 h-4 text-argus-warning" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-argus-success" />
                    )}
                    <span className="text-sm text-argus-text-secondary">{step.label}</span>
                  </div>
                  <span className={`text-sm font-mono font-semibold ${
                    step.status === 'critical' ? 'text-argus-critical' :
                    step.status === 'warning' ? 'text-argus-warning' : 'text-argus-success'
                  }`}>
                    {step.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-lg border border-argus-critical/30 bg-argus-critical/[0.06]">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-argus-critical mt-0.5 flex-shrink-0" />
                <div>
                  <p className="eyebrow !text-argus-critical">Impact on RRI</p>
                  <p className="text-sm text-argus-text-secondary mt-1">{breakdown.impact}</p>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-argus-success/30 bg-argus-success/[0.06]">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-argus-success mt-0.5 flex-shrink-0" />
                <div>
                  <p className="eyebrow !text-argus-success">Recommended Fix</p>
                  <p className="text-sm text-argus-text-secondary mt-1">{breakdown.recommendation}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-argus-bg2/60 border-t border-argus-line flex justify-between items-center">
            <span className="text-xs text-argus-text-faint">Weight: {weight}% of overall RRI · Calculation based on live data</span>
            <button onClick={onClose} className="btn-primary !py-2 !px-4 text-sm">
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
