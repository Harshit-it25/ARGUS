import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, X, Send, Bot, User, Sparkles } from 'lucide-react'
import { advisorApi } from '../services/api'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: string[]
}

const SUGGESTED_QUESTIONS = [
  'What is our current RRI score?',
  'Which findings are high severity?',
  'What obligations are unmapped?',
]

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-1">
      {[0, 1, 2].map(i => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-argus-text-faint"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  )
}

export default function AdvisorPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! I am Argus Advisor. I can answer questions about your regulatory readiness, findings, and compliance gaps. What would you like to know?',
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
  useEffect(() => { scrollToBottom() }, [messages, isLoading])

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMessage: ChatMessage = { id: Date.now().toString(), role: 'user', content: text }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const user = JSON.parse(localStorage.getItem('argus_user') || '{}')
      const res = await advisorApi.query(text, user?.org_id)
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.data?.answer || 'I apologize, I could not process that request.',
        sources: res.data?.sources || ['circular_chunks', 'policy_chunks'],
      }
      setMessages(prev => [...prev, assistantMessage])
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSend = () => sendMessage(input)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const showSuggestions = messages.length === 1

  return (
    <>
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close Argus Advisor' : 'Open Argus Advisor'}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center transition-colors border-2 shadow-elevate-lg ${
          isOpen ? 'bg-argus-bg2 border-argus-critical text-argus-critical' : 'bg-argus-accent border-argus-accent text-argus-bg hover:brightness-110'
        }`}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-24 right-6 z-50 w-96 h-[520px] panel-solid flex flex-col overflow-hidden"
          >
            <div className="h-14 bg-argus-bg2 px-4 flex items-center gap-3 border-b border-argus-line shrink-0">
              <div className="w-8 h-8 rounded-lg bg-argus-accent/15 border border-argus-accent/30 flex items-center justify-center">
                <Bot className="w-4 h-4 text-argus-accent" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-argus-text">Argus Advisor</h3>
                <p className="eyebrow">RAG-powered compliance assistant</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
                  className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${
                    msg.role === 'user' ? 'bg-white/[0.03] border-argus-line' : 'bg-argus-accent/10 border-argus-accent/30'
                  }`}>
                    {msg.role === 'user' ? <User className="w-4 h-4 text-argus-text-secondary" /> : <Bot className="w-4 h-4 text-argus-accent" />}
                  </div>
                  <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                    msg.role === 'user' ? 'bg-argus-accent text-argus-bg font-medium' : 'bg-white/[0.03] text-argus-text-secondary border border-argus-line'
                  }`}>
                    <p className="whitespace-pre-line">{msg.content}</p>
                    {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-argus-line">
                        <p className="eyebrow mb-1.5">Sources</p>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.sources.map((src, i) => (
                            <span key={i} className="inline-block px-2 py-1 bg-white/[0.03] border border-argus-line rounded-md font-mono text-[10px] text-argus-text-faint truncate max-w-[150px]" title={src}>
                              {src}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}

              {showSuggestions && !isLoading && (
                <div className="space-y-2 pt-2">
                  <p className="eyebrow flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> Suggested questions</p>
                  {SUGGESTED_QUESTIONS.map(q => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="w-full text-left px-3 py-2 rounded-lg border border-argus-line bg-white/[0.02] hover:bg-white/[0.05] hover:border-argus-accent/30 transition-colors text-xs text-argus-text-secondary"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {isLoading && (
                <div className="flex gap-2">
                  <div className="w-8 h-8 rounded-lg bg-argus-accent/10 border border-argus-accent/30 flex items-center justify-center flex-shrink-0"><Bot className="w-4 h-4 text-argus-accent" /></div>
                  <div className="bg-white/[0.03] border border-argus-line rounded-xl px-4 py-2.5"><TypingDots /></div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-argus-line shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about RRI, risks, or gaps…"
                  className="input-field flex-1"
                />
                <button onClick={handleSend} disabled={isLoading || !input.trim()} aria-label="Send message" className="btn-primary !px-3 !py-0 w-10 h-10 shrink-0">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
