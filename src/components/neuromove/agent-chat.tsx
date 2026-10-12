'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Send, Sparkles, X, Trash2, Loader2, User, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  ts: number
  toolsUsed?: string[]
}

interface AgentChatProps {
  /** For doctors: the patientId to coach. For patients, omit (uses self). */
  patientId?: string
  patientName?: string
  /**
   * compact = floating button + slide-in fixed panel (default).
   * full = larger fixed panel.
   * embedded = inline panel rendered in the page flow (no floating button,
   *           always open, no fixed positioning). Use this when the parent
   *           already provides its own toggle (e.g. the doctor's
   *           patient-detail "Coach patient" button).
   */
  variant?: 'compact' | 'full' | 'embedded'
}

const SUGGESTED_PROMPTS = [
  { en: 'How am I doing this week?', ar: 'كيف أدائي هذا الأسبوع؟' },
  { en: "I'm tired, can I rest today?", ar: 'أنا متعب، هل أقدر أرتاح اليوم؟' },
  { en: 'Why do I keep shrugging my shoulder?', ar: 'ليش أرفع كتفك بدون ما أحس؟' },
  { en: 'What exercise should I do next?', ar: 'أيش التمرين اللي أأسوي بعده؟' },
  { en: 'Am I close to my daily goal?', ar: 'هل قريب من هدفي اليومي؟' },
]

/**
 * AgentChat — the NeuroMove AI Rehab Coach chat panel.
 *
 * Calls POST /api/v2/agent/chat with the user's message. The backend fetches
 * the patient's real clinical context (active plan, stats, sessions, badges,
 * exercises) and injects it into the LLM system prompt — the "agentic" pattern
 * without native function-calling.
 *
 * The panel shows a typing indicator while waiting, suggested prompts to
 * lower the barrier to start, and renders Arabic text RTL automatically.
 */
export function AgentChat({ patientId, patientName, variant = 'full' }: AgentChatProps) {
  const { user } = useAuth()
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [input, setInput] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  // For the embedded variant, the panel is always "open" and there's no
  // floating button — the parent controls visibility by mounting/unmounting.
  const embedded = variant === 'embedded'

  // Auto-scroll to the latest message.
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  const send = React.useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || loading) return
      setInput('')
      const userMsg: ChatMessage = { role: 'user', content: trimmed, ts: Date.now() }
      setMessages((prev) => [...prev, userMsg])
      setLoading(true)
      try {
        const res = await apiFetch<{ ok: boolean; reply: string; toolsUsed?: string[]; error?: string }>(
          '/api/v2/agent/chat',
          {
            method: 'POST',
            body: JSON.stringify({ message: trimmed, patientId }),
          },
        )
        if (!res.ok) throw new Error(res.error || 'chat failed')
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: res.reply, ts: Date.now(), toolsUsed: res.toolsUsed },
        ])
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown error'
        toast.error('Coach unavailable', { description: msg })
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Sorry, I couldn't respond right now (${msg}).`, ts: Date.now() },
        ])
      } finally {
        setLoading(false)
      }
    },
    [loading, patientId],
  )

  const clearChat = React.useCallback(async () => {
    setMessages([])
    try {
      await apiFetch(`/api/v2/agent/chat${patientId ? `?patientId=${patientId}` : ''}`, { method: 'DELETE' })
      toast.success('Conversation cleared')
    } catch {
      /* silent */
    }
  }, [patientId])

  const isRTL = (text: string) => /[\u0600-\u06FF]/.test(text)

  // The panel content — shared between the floating (compact/full) and the
  // inline (embedded) variants.
  const panel = (
    <>
      {/* Messages */}
      <div ref={scrollRef} className="nm-scroll-thin flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-500/10">
              <MessageSquare className="h-6 w-6 text-teal-500" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Ask your AI Rehab Coach</p>
              <p className="text-xs text-muted-foreground">
                I know your plan, stats, and progress. Ask me anything.
              </p>
            </div>
            <div className="flex w-full flex-col gap-1.5">
              {SUGGESTED_PROMPTS.slice(0, 4).map((p) => (
                <button
                  key={p.en}
                  onClick={() => send(p.en)}
                  className="rounded-lg border border-border/50 bg-card/60 px-3 py-2 text-left text-xs text-foreground/80 transition-colors hover:border-teal-500/40 hover:bg-teal-500/5"
                >
                  {p.en}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              'flex gap-2',
              m.role === 'user' ? 'justify-end' : 'justify-start',
            )}
          >
            {m.role === 'assistant' && (
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 text-white">
                <Bot className="h-3.5 w-3.5" />
              </div>
            )}
            <div
              className={cn(
                'max-w-[80%] rounded-2xl px-3 py-2 text-sm',
                m.role === 'user'
                  ? 'bg-teal-500 text-teal-50'
                  : 'bg-card border border-border/40 text-foreground',
              )}
              dir={isRTL(m.content) ? 'rtl' : 'ltr'}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
              {m.toolsUsed && m.toolsUsed.length > 0 && m.toolsUsed[0] !== 'fallback_summary' && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {m.toolsUsed.slice(0, 3).map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-teal-500/10 px-1.5 py-0.5 text-[9px] font-medium text-teal-500"
                    >
                      {t.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {m.role === 'user' && (
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <User className="h-3.5 w-3.5" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 text-white">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="flex items-center gap-1 rounded-2xl bg-card border border-border/40 px-3 py-3">
              <span className="h-2 w-2 animate-bounce rounded-full bg-teal-500 [animation-delay:-0.3s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-teal-500 [animation-delay:-0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-teal-500" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border/40 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send(input)
              }
            }}
            placeholder="Type your question…  (Enter to send)"
            rows={1}
            className="nm-scroll-thin max-h-24 flex-1 resize-none rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/30"
            disabled={loading}
          />
          <Button
            size="icon"
            onClick={() => void send(input)}
            disabled={!input.trim() || loading}
            className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white hover:from-teal-600 hover:to-emerald-700"
            aria-label="Send message"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground/60">
          The coach knows your real rehab data · context-aware responses
        </p>
      </div>
    </>
  )

  // ---- Embedded variant: inline in the page flow, no floating button ----
  if (embedded) {
    return (
      <div className="flex h-[28rem] flex-col rounded-2xl border border-border/60 bg-card/95 shadow-lg shadow-black/20 backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-border/40 bg-gradient-to-r from-teal-500/10 to-emerald-500/10 p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 text-white">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-foreground">AI Rehab Coach</span>
              <span className="text-[10px] text-muted-foreground">
                {patientName ? `Coaching ${patientName}` : user?.name || 'Your assistant'}
              </span>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={clearChat}
            aria-label="Clear conversation"
            disabled={messages.length === 0}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        {panel}
      </div>
    )
  }

  // ---- Floating variants (compact / full) ----
  return (
    <>
      {/* Trigger button (floating, bottom-right) */}
      {!open && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-lg shadow-teal-500/30 ring-2 ring-teal-400/40"
          aria-label="Open AI Rehab Coach"
        >
          <Sparkles className="h-6 w-6" aria-hidden="true" />
          <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/70" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
          </span>
        </motion.button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'fixed z-50 flex flex-col rounded-2xl border border-border/60 bg-card/95 shadow-2xl shadow-black/40 backdrop-blur-xl',
              variant === 'compact'
                ? 'bottom-6 right-6 h-[28rem] w-[22rem]'
                : 'inset-x-4 bottom-4 top-4 sm:inset-x-auto sm:right-6 sm:top-20 sm:bottom-6 sm:h-[36rem] sm:w-[24rem]',
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 border-b border-border/40 bg-gradient-to-r from-teal-500/10 to-emerald-500/10 p-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 text-white">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-semibold text-foreground">AI Rehab Coach</span>
                  <span className="text-[10px] text-muted-foreground">
                    {patientName ? `Coaching ${patientName}` : user?.name || 'Your assistant'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={clearChat}
                  aria-label="Clear conversation"
                  disabled={messages.length === 0}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setOpen(false)}
                  aria-label="Close coach"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {panel}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
