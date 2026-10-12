'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Trophy, Medal, Award, ChevronUp, ChevronDown, Crown } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { GradientAvatar } from '@/components/neuromove/gradient-avatar'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/api'
import type { V2PatientSummary } from '@/lib/v2-types'

type SortKey = 'accuracy' | 'reps' | 'streak' | 'sessions'

interface LeaderboardEntry {
  patient: V2PatientSummary
  accuracy: number
  reps: number
  streak: number
  sessions: number
}

interface ClinicLeaderboardProps {
  patients: V2PatientSummary[]
  onPatientClick?: (patientId: string) => void
}

const SORT_OPTIONS: Array<{ key: SortKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'accuracy', label: 'Accuracy', icon: Trophy },
  { key: 'reps', label: 'Reps', icon: Medal },
  { key: 'streak', label: 'Streak', icon: Crown },
  { key: 'sessions', label: 'Sessions', icon: Award },
]

const RANK_STYLES = [
  'border-amber-500/40 bg-amber-500/5', // gold
  'border-slate-400/40 bg-slate-400/5', // silver
  'border-orange-700/40 bg-orange-700/5', // bronze
]

/**
 * ClinicLeaderboard — a ranked table of patients by a chosen metric
 * (accuracy, reps, streak, sessions). Top 3 get medal-colored rows.
 * The doctor can toggle the sort metric; clicking a patient opens their
 * detail.
 */
export function ClinicLeaderboard({ patients, onPatientClick }: ClinicLeaderboardProps) {
  const [sortKey, setSortKey] = React.useState<SortKey>('accuracy')
  const [entries, setEntries] = React.useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = React.useState(true)

  // Fetch each patient's streak to enrich the leaderboard.
  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all(
      patients.map(async (p) => {
        try {
          const streakRes = await apiFetch<{ ok: boolean; streak: { current: number } }>(
            `/api/v2/streak?userId=${p.id}`,
          )
          return {
            patient: p,
            accuracy: p.latestSession ? Math.round((p.latestSession.correctReps / Math.max(1, p.latestSession.totalReps)) * 1000) / 10 : 0,
            reps: p.latestSession?.gamificationScore ?? 0,
            streak: streakRes.streak?.current ?? 0,
            sessions: p.sessionsCount,
          } as LeaderboardEntry
        } catch {
          return {
            patient: p,
            accuracy: 0,
            reps: 0,
            streak: 0,
            sessions: p.sessionsCount,
          } as LeaderboardEntry
        }
      }),
    ).then((all) => {
      if (cancelled) return
      setEntries(all)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [patients])

  const sorted = React.useMemo(() => {
    return [...entries].sort((a, b) => {
      // Handle streak specially (tie-break by accuracy)
      if (sortKey === 'streak') {
        if (b.streak !== a.streak) return b.streak - a.streak
        return b.accuracy - a.accuracy
      }
      if (sortKey === 'accuracy') return b.accuracy - a.accuracy
      if (sortKey === 'reps') return b.reps - a.reps
      return b.sessions - a.sessions
    })
  }, [entries, sortKey])

  const getMetricValue = (e: LeaderboardEntry, key: SortKey): string => {
    if (key === 'accuracy') return `${e.accuracy.toFixed(1)}%`
    if (key === 'reps') return String(e.reps)
    if (key === 'streak') return `${e.streak}d`
    return String(e.sessions)
  }

  return (
    <Card className="nm-glass border-border/40 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-semibold">Clinic leaderboard</h3>
        </div>
        {/* Sort toggles */}
        <div className="flex gap-1">
          {SORT_OPTIONS.map((opt) => {
            const Icon = opt.icon
            const active = sortKey === opt.key
            return (
              <Button
                key={opt.key}
                size="sm"
                variant={active ? 'default' : 'outline'}
                className={cn(
                  'h-7 gap-1 px-2 text-[11px]',
                  active && 'bg-gradient-to-r from-amber-500 to-orange-600 text-white',
                )}
                onClick={() => setSortKey(opt.key)}
              >
                <Icon className="h-3 w-3" />
                {opt.label}
              </Button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No patients yet.</p>
      ) : (
        <div className="space-y-1.5">
          {sorted.map((e, i) => {
            const rank = i
            const rankStyle = rank < 3 ? RANK_STYLES[rank] : 'border-border/40 bg-card/40'
            const MedalIcon = rank === 0 ? Crown : rank === 1 ? Medal : rank === 2 ? Award : null
            return (
              <motion.div
                key={e.patient.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.04 }}
                whileHover={{ x: 2 }}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-2.5 transition-colors cursor-pointer',
                  rankStyle,
                )}
                onClick={() => onPatientClick?.(e.patient.id)}
                role="button"
                tabIndex={0}
              >
                {/* Rank */}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                  {MedalIcon ? (
                    <MedalIcon className={cn(
                      'h-5 w-5',
                      rank === 0 ? 'text-amber-500' : rank === 1 ? 'text-slate-400' : 'text-orange-700',
                    )} />
                  ) : (
                    <span className="font-mono text-sm font-bold text-muted-foreground">{rank + 1}</span>
                  )}
                </div>

                {/* Avatar + name */}
                <GradientAvatar seed={e.patient.avatarSeed} name={e.patient.name} size="h-9 w-9" />
                <div className="flex flex-1 flex-col">
                  <span className="text-xs font-semibold text-foreground">{e.patient.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {e.patient.sessionsCount} sessions · {e.patient.affectedSide} side
                  </span>
                </div>

                {/* Metric value */}
                <div className="flex flex-col items-end">
                  <span className="font-mono text-sm font-bold text-foreground">
                    {getMetricValue(e, sortKey)}
                  </span>
                  <span className="text-[9px] text-muted-foreground capitalize">{sortKey}</span>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
