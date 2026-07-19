import { FileOutput, Download, Calendar, FileText } from 'lucide-react'

interface Report {
  id: string
  title: string
  generatedAt: string
  generatedBy: string
  type: string
  status: 'ready' | 'generating'
}

const reports: Report[] = [
  { id: '1', title: 'Q2 2025 Regulatory Readiness Report', generatedAt: '2025-06-15', generatedBy: 'Compliance Officer', type: 'Quarterly', status: 'ready' },
  { id: '2', title: 'SEBI Circular CIR/ISD/2025/045 - Stress Test Results', generatedAt: '2025-06-15', generatedBy: 'Compliance Officer', type: 'Circular-specific', status: 'ready' },
  { id: '3', title: 'Executive Summary - Board Meeting', generatedAt: '2025-06-10', generatedBy: 'Admin', type: 'Executive', status: 'ready' },
]

export default function Reports() {
  return (
    <div className="space-y-6 p-8 max-w-[1600px] mx-auto argus-ground">
      <div className="flex items-center justify-between border-b border-argus-line pb-5">
        <div>
          <p className="eyebrow mb-1">Audit Package Center</p>
          <h2 className="font-display text-2xl font-bold text-argus-text">Reports</h2>
          <p className="text-sm text-argus-text-faint mt-1">Generate and download audit-ready compliance reports</p>
        </div>
        <button className="btn-primary">
          <FileOutput className="w-4 h-4" />
          Generate New Report
        </button>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full data-table">
            <thead>
              <tr>
                <th>Report</th>
                <th className="w-32">Type</th>
                <th className="w-32">Generated</th>
                <th className="w-32">By</th>
                <th className="w-24">Status</th>
                <th className="w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report, i) => (
                <tr key={report.id} className="group">
                  <td>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-argus-text-faint">{String(i + 1).padStart(2, '0')}</span>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-argus-line bg-white/[0.02]">
                        <FileText className="w-4 h-4 text-argus-text-secondary" />
                      </div>
                      <span className="text-sm font-medium text-argus-text-secondary group-hover:text-argus-text transition-colors">{report.title}</span>
                    </div>
                  </td>
                  <td><span className="badge badge-neutral">{report.type}</span></td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-argus-text-faint" />
                      <span className="font-mono text-sm text-argus-text-secondary">{report.generatedAt}</span>
                    </div>
                  </td>
                  <td className="text-sm text-argus-text-secondary">{report.generatedBy}</td>
                  <td><span className={`badge ${report.status === 'ready' ? 'badge-success' : 'badge-warning'}`}>{report.status === 'ready' ? 'Ready' : 'Generating'}</span></td>
                  <td>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-argus-accent hover:bg-argus-accent/10 rounded-lg transition-colors">
                      <Download className="w-3.5 h-3.5" />
                      PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
