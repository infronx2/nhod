'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Target, Trophy, Plus, Loader2, Check, Flame, Activity, Gauge } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'

interface Goal {
  id: string
  type: string
  title: string
  targetValue: number
  currentValue: number
  achieved: boolean
  achievedAt: string | null
  targetDate: string | null
  createdAt: string
}

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  rom_target: Flame,
  rep_count: Activity,
  accuracy: Gauge,
  streak: Trophy,
}

const TYPE_UNIT: Record<string, string> = {
  rom_target: '°',
  rep_count: ' reps',
  accuracy: '%',
  streak: ' days',
}

/**
 * GoalsTracker — shows the patient's active + achieved rehabilitation
 * goals with animated progress bars. Achieved goals get a celebratory
 * checkmark + trophy.
 */
export function GoalsTracker() {
  const { user } = useAuth()
  const [goals, setGoals] = React.useState<Goal[]>([])
  const [loading, setLoading] = React.useState(true)

  const fetchGoals = React.useCallback(async () => {
    if (!user) return
    try {
      const data = await apiFetch<{ ok: boolean; goals: Goal[] }>('/api/v2/goals')
      if (data.ok) setGoals(data.goals)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [user])

  React.useEffect(() => { void fetchGoals() }, [fetchGoals])

  if (loading) {
    return (
      <Card className="border-border/40 bg-card/60 p-4 backdrop-blur">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-teal-500" />
          <h3 className="text-sm font-semibold">Goals</h3>
        </div>
        <div className="mt-3 space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </Card>
    )
  }

  if (goals.length === 0) {
    return null // Don't show an empty card — goals are doctor-set.
  }

  return (
    <Card className="border-border/40 bg-card/60 p-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-teal-500" />
          <h3 className="text-sm font-semibold">Rehabilitation goals</h3>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {goals.filter((g) => g.achieved).length}/{goals.length} achieved
        </span>
      </div>

      <div className="mt-3 space-y-2.5">
        <AnimatePresence mode="popLayout">
          {goals.map((g, i) => {
            const Icon = TYPE_ICON[g.type] ?? Target
            const unit = TYPE_UNIT[g.type] ?? ''
            const pct = Math.min(100, (g.currentValue / g.targetValue) * 100)
            return (
              <motion.div
                key={g.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.05 }}
                className={cn(
                  'rounded-lg border p-2.5',
                  g.achieved
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : 'border-border/40 bg-card/40',
                )}
              >
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full',
                    g.achieved ? 'bg-emerald-500/15 text-emerald-500' : 'bg-muted text-muted-foreground',
                  )}>
                    {g.achieved ? <Check className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-foreground">{g.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {g.currentValue.toFixed(0)}{unit} / {g.targetValue}{unit}
                    </p>
                  </div>
                  {g.achieved && <Trophy className="h-3.5 w-3.5 text-amber-500" />}
                </div>

                {/* Progress bar */}
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
                  <motion.div
                    className={cn(
                      'h-full rounded-full',
                      g.achieved
                        ? 'bg-gradient-to-r from-emerald-400 to-teal-500'
                        : 'bg-gradient-to-r from-teal-400 to-emerald-500',
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, delay: i * 0.05 + 0.1 }}
                  />
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </Card>
  )
}
