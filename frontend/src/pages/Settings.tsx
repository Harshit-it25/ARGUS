import { Building2, Users, Shield, FileText } from 'lucide-react'

export default function Settings() {
  return (
    <div className="space-y-6 p-8 max-w-[1600px] mx-auto argus-ground">
      <div className="border-b border-argus-line pb-5">
        <p className="eyebrow mb-1">Platform Configuration</p>
        <h2 className="font-display text-2xl font-bold text-argus-text">Settings</h2>
        <p className="text-sm text-argus-text-faint mt-1">Manage organization, users, and policy corpus</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="panel p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center border border-argus-line bg-white/[0.02]">
              <Building2 className="w-4 h-4 text-argus-text-secondary" />
            </div>
            <h3 className="font-display text-lg font-semibold text-argus-text">Organization</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-argus-text-secondary mb-1.5">Organization Name</label>
              <input type="text" defaultValue="Team Rocket Securities Ltd." className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-argus-text-secondary mb-1.5">Industry</label>
              <input type="text" defaultValue="Financial Services" className="input-field" />
            </div>
            <button className="btn-primary text-sm">Save Changes</button>
          </div>
        </div>

        <div className="panel p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center border border-argus-line bg-white/[0.02]">
              <Users className="w-4 h-4 text-argus-text-secondary" />
            </div>
            <h3 className="font-display text-lg font-semibold text-argus-text">Departments</h3>
          </div>
          <div className="space-y-1">
            {['Risk Management', 'IT Security', 'Compliance', 'Operations', 'Human Resources'].map((dept) => (
              <div key={dept} className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors">
                <span className="text-sm text-argus-text-secondary">{dept}</span>
                <button className="text-xs text-argus-accent hover:text-argus-text transition-colors">Edit</button>
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center border border-argus-line bg-white/[0.02]">
              <Shield className="w-4 h-4 text-argus-text-secondary" />
            </div>
            <h3 className="font-display text-lg font-semibold text-argus-text">Team &amp; Roles</h3>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors">
              <div>
                <p className="text-sm font-medium text-argus-text-secondary">admin@argus.demo</p>
                <p className="text-xs text-argus-text-faint">Admin</p>
              </div>
              <span className="badge badge-critical">Admin</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors">
              <div>
                <p className="text-sm font-medium text-argus-text-secondary">compliance@argus.demo</p>
                <p className="text-xs text-argus-text-faint">Compliance</p>
              </div>
              <span className="badge badge-neutral">Compliance Officer</span>
            </div>
          </div>
        </div>

        <div className="panel p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center border border-argus-line bg-white/[0.02]">
              <FileText className="w-4 h-4 text-argus-text-secondary" />
            </div>
            <h3 className="font-display text-lg font-semibold text-argus-text">Policy Corpus</h3>
          </div>
          <div className="space-y-1">
            {[
              'Risk Management Policy v2.1',
              'Cybersecurity Framework SOP',
              'Employee Trading Disclosure Policy',
              'KYC Onboarding Workflow',
              'AML Monitoring Procedure',
              'Insider Trading Prevention Policy',
            ].map((policy) => (
              <div key={policy} className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors">
                <span className="text-sm text-argus-text-secondary">{policy}</span>
                <button className="text-xs text-argus-accent hover:text-argus-text transition-colors">View</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
