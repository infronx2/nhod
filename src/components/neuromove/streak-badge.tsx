'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Flame, Snowflake } from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'

interface StreakInfo {
  currentStreak: number
  longestStreak: number
  freezesLeft: number
  lastSessionDate: string | null
}

/**
 * StreakBadge — a compact flame badge showing the patient's current
 * consecutive-day streak + freeze count. Used on the patient dashboard
 * header. Animated flame scales with the streak length.
 */
export function StreakBadge() {
  const { user } = useAuth()
  const [streak, setStreak] = React.useState<StreakInfo | null>(null)

  React.useEffect(() => {
    if (!user) return
    apiFetch<{ ok: boolean; streak: StreakInfo }>('/api/v2/streak')
      .then((d) => { if (d.ok) setStreak(d.streak) })
      .catch(() => {})
  }, [user])

  if (!streak || streak.currentStreak === 0) return null

  const intensity = Math.min(streak.currentStreak / 7, 1) // 0..1 over a week
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1"
      title={`Current streak: ${streak.currentStreak} days · Longest: ${streak.longestStreak} days`}
    >
      <motion.div
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{ filter: `brightness(${1 + intensity * 0.3})` }}
      >
        <Flame
          className={cn(
            'h-3.5 w-3.5',
            streak.currentStreak >= 7 ? 'text-rose-500' : 'text-amber-500',
          )}
          fill="currentColor"
        />
      </motion.div>
      <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
        {streak.currentStreak}
      </span>
      <span className="text-[10px] text-muted-foreground">day streak</span>
      {streak.freezesLeft > 0 && (
        <span className="ml-1 flex items-center gap-0.5 text-[10px] text-sky-500" title={`${streak.freezesLeft} streak freeze(s) available`}>
          <Snowflake className="h-2.5 w-2.5" />
          {streak.freezesLeft}
        </span>
      )}
    </motion.div>
  )
}
