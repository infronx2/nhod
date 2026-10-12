'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { GitCompare, X, Users, Activity, Target, Flame, TrendingUp, Trophy } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { GradientAvatar } from '@/components/neuromove/gradient-avatar'
import { cn } from '@/lib/utils'
import { apiFetch } from '@/lib/api'
import type { V2PatientSummary } from '@/lib/v2-types'

interface PatientCompareProps {
  patients: V2PatientSummary[]
}

interface ComparisonStats {
  patientId: string
  sessionsCount: number
  accuracy: number
  latestMaxAngle: number
  streak: number
  totalReps: number
}

/**
 * PatientCompare — a doctor-facing card that compares two patients
 * side-by-side across key metrics (sessions, accuracy, max ROM, streak, reps).
 * The doctor picks two patients from the roster; the component fetches each
 * patient's stats and shows a winner-highlighted comparison row per metric.
 */
export function PatientCompare({ patients }: PatientCompareProps) {
  const [aId, setAId] = React.useState<string | undefined>(undefined)
  const [bId, setBId] = React.useState<string | undefined>(undefined)
  const [statsA, setStatsA] = React.useState<ComparisonStats | null>(null)
  const [statsB, setStatsB] = React.useState<ComparisonStats | null>(null)
  const [loading, setLoading] = React.useState(false)

  // Default to the first two patients.
  React.useEffect(() => {
    if (patients.length >= 2 && !aId && !bId) {
      setAId(patients[0].id)
      setBId(patients[1].id)
    }
  }, [patients, aId, bId])

  const fetchStats = React.useCallback(async (patientId: string): Promise<ComparisonStats | null> => {
    try {
      const [detail, streakRes] = await Promise.all([
        apiFetch<{ ok: boolean; aggregate: { totalSessions: number; totalReps: number; accuracyPct: number; maxAngleOverall: number } }>(
          `/api/v2/patients/${patientId}`,
        ),
        apiFetch<{ ok: boolean; streak: { current: number } }>(
          `/api/v2/streak?userId=${patientId}`,
        ),
      ])
      return {
        patientId,
        sessionsCount: detail.aggregate?.totalSessions ?? 0,
        accuracy: detail.aggregate?.accuracyPct ?? 0,
        latestMaxAngle: detail.aggregate?.maxAngleOverall ?? 0,
        streak: streakRes.streak?.current ?? 0,
        totalReps: detail.aggregate?.totalReps ?? 0,
      }
    } catch {
      return null
    }
  }, [])

  React.useEffect(() => {
    if (!aId || !bId) return
    let cancelled = false
    setLoading(true)
    Promise.all([fetchStats(aId), fetchStats(bId)]).then(([a, b]) => {
      if (cancelled) return
      setStatsA(a)
      setStatsB(b)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [aId, bId, fetchStats])

  const patientA = patients.find((p) => p.id === aId)
  const patientB = patients.find((p) => p.id === bId)

  const METRICS = [
    { key: 'sessionsCount', label: 'Sessions', icon: Activity, fmt: (v: number) => String(v) },
    { key: 'totalReps', label: 'Total reps', icon: Target, fmt: (v: number) => String(v) },
    { key: 'accuracy', label: 'Accuracy', icon: TrendingUp, fmt: (v: number) => `${v.toFixed(0)}%` },
    { key: 'latestMaxAngle', label: 'Max ROM', icon: Trophy, fmt: (v: number) => `${v.toFixed(0)}°` },
    { key: 'streak', label: 'Streak', icon: Flame, fmt: (v: number) => `${v}d` },
  ] as const

  return (
    <Card className="nm-glass border-border/40 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <GitCompare className="h-4 w-4 text-teal-500" />
        <h3 className="text-sm font-semibold">Patient comparison</h3>
      </div>

      {/* Patient pickers */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-teal-500">Patient A</span>
          <Select value={aId} onValueChange={setAId}>
            <SelectTrigger className="h-8 w-full text-xs">
              <SelectValue placeholder="Select patient A" />
            </SelectTrigger>
            <SelectContent>
              {patients.map((p) => (
                <SelectItem key={p.id} value={p.id} disabled={p.id === bId}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-amber-500">Patient B</span>
          <Select value={bId} onValueChange={setBId}>
            <SelectTrigger className="h-8 w-full text-xs">
              <SelectValue placeholder="Select patient B" />
            </SelectTrigger>
            <SelectContent>
              {patients.map((p) => (
                <SelectItem key={p.id} value={p.id} disabled={p.id === aId}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Comparison rows */}
      {loading || !statsA || !statsB || !patientA || !patientB ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {METRICS.map((m, i) => {
            const valA = statsA[m.key]
            const valB = statsB[m.key]
            const aWins = valA > valB
            const bWins = valB > valA
            const Icon = m.icon
            return (
              <motion.div
                key={m.key}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: i * 0.05 }}
                className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg border border-border/30 bg-card/40 p-2"
              >
                {/* A value */}
                <div className={cn(
                  'flex items-center justify-end gap-1.5 font-mono text-sm font-bold',
                  aWins ? 'text-emerald-500' : 'text-muted-foreground',
                )}>
                  {m.fmt(valA)}
                  {aWins && <span className="text-[10px]">▲</span>}
                </div>
                {/* Label */}
                <div className="flex flex-col items-center gap-0.5 px-2">
                  <Icon className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[9px] text-muted-foreground">{m.label}</span>
                </div>
                {/* B value */}
                <div className={cn(
                  'flex items-center justify-start gap-1.5 font-mono text-sm font-bold',
                  bWins ? 'text-emerald-500' : 'text-muted-foreground',
                )}>
                  {bWins && <span className="text-[10px]">▲</span>}
                  {m.fmt(valB)}
                </div>
              </motion.div>
            )
          })}

          {/* Summary footers */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-teal-500/30 bg-teal-500/5 p-2">
              <GradientAvatar seed={patientA.avatarSeed} name={patientA.name} size="h-8 w-8" />
              <div className="flex flex-col">
                <span className="text-xs font-semibold">{patientA.name}</span>
                <span className="text-[10px] text-muted-foreground">{patientA.affectedSide} affected</span>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2">
              <GradientAvatar seed={patientB.avatarSeed} name={patientB.name} size="h-8 w-8" />
              <div className="flex flex-col">
                <span className="text-xs font-semibold">{patientB.name}</span>
                <span className="text-[10px] text-muted-foreground">{patientB.affectedSide} affected</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
