import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Lock, Mail, ShieldCheck, AlertTriangle } from 'lucide-react'
import { authApi } from '../services/api'

interface LoginProps {
  onLogin: () => void
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      const res = await authApi.login(email, password)
      localStorage.setItem('access_token', res.data.access_token)
      localStorage.setItem('argus_user', JSON.stringify(res.data.user))
      onLogin()
    } catch (err: any) {
      const msg = !err.response
        ? 'Unable to reach the server. Please check your connection and try again.'
        : err.response.status === 401
          ? 'Incorrect email or password.'
          : err.response.data?.detail || 'Sign in failed. Please try again.'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-argus-bg argus-ground">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md p-8 sm:p-10 panel"
      >
        <div className="flex flex-col items-center mb-8">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="w-16 h-16 rounded-2xl bg-argus-accent/10 border border-argus-accent/30 flex items-center justify-center mb-5"
          >
            <ShieldCheck className="w-8 h-8 text-argus-accent" />
          </motion.div>
          <h1 className="font-display text-3xl font-bold text-argus-text tracking-tight">ARGUS</h1>
          <p className="eyebrow mt-2">Regulatory Intelligence Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-argus-critical/30 bg-argus-critical/[0.08] text-sm text-argus-critical">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div className="space-y-4">
            <div className="relative group">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-argus-text-faint group-focus-within:text-argus-accent transition-colors" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="input-field pl-10"
              />
            </div>
            <div className="relative group">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-argus-text-faint group-focus-within:text-argus-accent transition-colors" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="input-field pl-10"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" className="rounded border-argus-line bg-white/[0.03] text-argus-accent focus:ring-argus-accent focus:ring-offset-0" />
              <span className="text-argus-text-secondary group-hover:text-argus-text transition-colors">Remember me</span>
            </label>
            <a href="#" className="text-argus-accent hover:text-argus-text transition-colors">Forgot password?</a>
          </div>

          <button type="submit" disabled={isLoading} className="btn-primary w-full py-3">
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-argus-bg/30 border-t-argus-bg rounded-full animate-spin" />
            ) : (
              <>
                Sign in
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-argus-text-faint">
          Secure access portal for compliance officers. SOC 2 Type II certified infrastructure.
        </p>
      </motion.div>
    </div>
  )
}
