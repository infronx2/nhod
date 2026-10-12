'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  Target,
  Calendar,
  Activity,
  ClipboardList,
  Stethoscope,
  Sparkles,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { V2TreatmentPlan, V2Stats } from '@/lib/v2-types'

interface PatientHeaderProps {
  plan: V2TreatmentPlan | null
  /** Used for the "reps today vs daily goal" progress bar. */
  todayReps?: number
  stats?: V2Stats | null
  loading?: boolean
}

/**
 * PatientHeader — prominent banner card showing the authenticated patient's
 * active treatment plan (title, target angle, sessions/week, daily rep goal,
 * prescriber) with a progress bar of today's reps vs daily goal.
 *
 * Renders a tasteful "no active plan" empty state when no plan is found.
 */
export function PatientHeader({ plan, todayReps = 0, loading }: PatientHeaderProps) {
  if (loading && !plan) {
    return (
      <Card className="border-border/40 bg-card/60 p-4 shadow-lg shadow-black/20 backdrop-blur sm:p-6">
        <Skeleton className="h-24 w-full" />
      </Card>
    )
  }

  if (!plan) {
    return (
      <Card className="border-dashed border-border/60 bg-card/40 p-6 shadow-sm backdrop-blur">
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <ClipboardList className="h-10 w-10 text-muted-foreground/60" aria-hidden="true" />
          <p className="text-sm font-medium text-muted-foreground">
            No active treatment plan
          </p>
          <p className="text-xs text-muted-foreground">
            Your clinician can prescribe a rehab plan from the doctor dashboard.
          </p>
        </div>
      </Card>
    )
  }

  const dailyGoal = Math.max(1, plan.dailyRepGoal)
  const pct = Math.min(100, Math.round((todayReps / dailyGoal) * 100))
  const limbLabel =
    plan.targetLimb === 'upper_left'
      ? 'Left upper limb'
      : plan.targetLimb === 'bilateral'
        ? 'Bilateral'
        : 'Right upper limb'

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="relative overflow-hidden border-border/40 bg-gradient-to-br from-teal-500/10 via-card/60 to-emerald-500/5 p-4 shadow-lg shadow-black/20 backdrop-blur sm:p-6">
        {/* subtle radial glow */}
        <div
          className="pointer-events-none absolute -top-12 -right-12 h-48 w-48 rounded-full opacity-40 blur-3xl"
          style={{
            background:
              'radial-gradient(circle at center, rgba(20,184,166,0.5), transparent 70%)',
          }}
          aria-hidden="true"
        />
        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-teal-500" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                  Active treatment plan
                </span>
              </div>
              <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                {plan.title}
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="gap-1 border-border/60 px-2 py-0.5 font-normal">
                  <Stethoscope className="h-3 w-3" />
                  {plan.doctor?.name ?? 'Prescribed clinician'}
                </Badge>
                <Badge variant="outline" className="gap-1 border-border/60 px-2 py-0.5 font-normal">
                  {limbLabel}
                </Badge>
                {plan.notes && (
                  <Badge variant="outline" className="gap-1 border-border/60 px-2 py-0.5 font-normal">
                    <ClipboardList className="h-3 w-3" />
                    Notes
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <PlanStat icon={Target} label="Target angle" value={`${plan.targetAngle}°`} accent="text-amber-500" />
              <PlanStat icon={Calendar} label="Sessions/wk" value={plan.sessionsPerWeek} accent="text-teal-500" />
              <PlanStat icon={Activity} label="Daily goal" value={plan.dailyRepGoal} accent="text-emerald-500" />
            </div>
          </div>

          {plan.notes && (
            <p className="rounded-md border border-border/40 bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground">
              {plan.notes}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground">Today's reps</span>
              <span className="font-mono font-semibold">
                <span className={cn(pct >= 100 ? 'text-emerald-500' : 'text-foreground')}>
                  {todayReps}
                </span>
                <span className="text-muted-foreground"> / {plan.dailyRepGoal}</span>
                <span className="ml-2 text-muted-foreground">{pct}%</span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <motion.div
                className={cn(
                  'h-full rounded-full',
                  pct >= 100
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                    : 'bg-gradient-to-r from-teal-500 to-emerald-500',
                )}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            {pct >= 100 && (
              <div className="text-xs font-medium text-emerald-500">
                ✓ Daily goal reached — great work!
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

function PlanStat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: React.ReactNode
  accent: string
}) {
  return (
    <div className="flex min-w-[88px] flex-col gap-0.5 rounded-lg border border-border/40 bg-card/60 px-3 py-2 backdrop-blur">
      <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </span>
      <span className={cn('font-mono text-lg font-bold', accent)}>{value}</span>
    </div>
  )
}
