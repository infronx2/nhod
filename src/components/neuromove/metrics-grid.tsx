'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  Pause,
  Check,
  AlertTriangle,
  ScanFace,
  Repeat,
  Trophy,
  Maximize2,
  Timer,
  Gauge,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WsCommand } from '@/components/neuromove/types'

const ICONS: Record<WsCommand, React.ComponentType<{ className?: string }>> = {
  KEEP_GOING: Activity,
  HOLD: Pause,
  TARGET_HIT: Check,
  CORRECT_POSTURE: AlertTriangle,
  NO_POSE: ScanFace,
}

interface SparklineProps {
  data: number[]
  color?: string
  width?: number
  height?: number
  max?: number
  min?: number
}

export function Sparkline({
  data,
  color = '#14b8a6',
  width = 80,
  height = 24,
  max,
  min,
}: SparklineProps) {
  if (data.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        className="opacity-30"
        aria-hidden="true"
      >
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="currentColor"
          strokeDasharray="2 2"
          strokeWidth={1}
        />
      </svg>
    )
  }
  const xs = data.length - 1
  const dMax = max ?? Math.max(...data)
  const dMin = min ?? Math.min(...data)
  const range = dMax - dMin || 1
  const points = data
    .map((v, i) => {
      const x = (i / xs) * width
      const y = height - ((v - dMin) / range) * height
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg width={width} height={height} aria-hidden="true">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
}

export interface MetricCardProps {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  accent: string
  spark?: { data: number[]; color?: string }
  simulated?: boolean
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  accent,
  spark,
  simulated = false,
}: MetricCardProps) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="flex flex-col gap-1 rounded-lg border border-border/60 bg-card p-3 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className={cn('h-3.5 w-3.5', accent)} aria-hidden="true" />
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
        </div>
        {spark && spark.data.length > 1 && (
          <Sparkline
            data={spark.data}
            color={spark.color ?? accent}
            width={56}
            height={16}
          />
        )}
      </div>
      <div className="flex items-end justify-between">
        <div className="font-mono text-2xl font-bold tabular-nums leading-none text-foreground">
          {value}
        </div>
        {simulated && (
          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-500">
            sim
          </span>
        )}
      </div>
    </motion.div>
  )
}

interface MetricsGridProps {
  repCount: number
  score: number
  maxAngle: number
  compensationErrors: number
  latencyMs: number
  fpsAvg: number
  latencyHistory: number[]
  angleHistory: number[]
  fpsHistory: number[]
  goal: number
  onGoalChange?: (n: number) => void
  simulated: boolean
  command: WsCommand
}

export function MetricsGrid({
  repCount,
  score,
  maxAngle,
  compensationErrors,
  latencyMs,
  fpsAvg,
  latencyHistory,
  angleHistory,
  fpsHistory,
  goal,
  onGoalChange,
  simulated,
  command,
}: MetricsGridProps) {
  // For the live-camera mode, the displayed values come straight from the
  // server's tracking message. In demo mode, `simulated` is true and the
  // angle/score/rep values are computed client-side (the backend will be
  // sending NO_POSE for the synthetic stick figure).
  const Icon = ICONS[command]
  const goalPct = goal > 0 ? Math.min(100, (repCount / goal) * 100) : 0

  const cards: MetricCardProps[] = [
    {
      label: 'Reps',
      value: repCount,
      icon: Repeat,
      accent: 'text-teal-500',
    },
    {
      label: 'Score',
      value: score,
      icon: Trophy,
      accent: 'text-emerald-500',
    },
    {
      label: 'Max ROM',
      value: `${maxAngle.toFixed(0)}°`,
      icon: Maximize2,
      accent: 'text-sky-400',
      spark: { data: angleHistory, color: '#14b8a6', max: 180, min: 0 },
      simulated,
    },
    {
      label: 'Comp. Errors',
      value: compensationErrors,
      icon: AlertTriangle,
      accent: 'text-rose-500',
    },
    {
      label: 'Latency',
      value: `${latencyMs.toFixed(0)} ms`,
      icon: Timer,
      accent: 'text-amber-500',
      spark: { data: latencyHistory, color: '#f59e0b' },
    },
    {
      label: 'FPS',
      value: fpsAvg.toFixed(0),
      icon: Gauge,
      accent: 'text-violet-400',
      spark: { data: fpsHistory, color: '#a78bfa' },
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <MetricCard key={c.label} {...c} />
        ))}
      </div>

      {/* Daily goal progress */}
      <div className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-card p-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 text-teal-500" aria-hidden="true" />
            <span className="font-medium text-muted-foreground">
              Daily goal progress
            </span>
          </div>
          <div className="font-mono text-xs font-semibold text-foreground">
            {repCount} / {goal} reps
          </div>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500"
            initial={{ width: 0 }}
            animate={{ width: `${goalPct}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
        {onGoalChange && (
          <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>Goal:</span>
            <input
              type="number"
              min={1}
              max={500}
              value={goal}
              onChange={(e) => onGoalChange(Math.max(1, Number(e.target.value) || 1))}
              className="w-16 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-xs text-foreground"
              aria-label="Daily rep goal"
            />
            <span>reps</span>
          </div>
        )}
      </div>
    </div>
  )
}
