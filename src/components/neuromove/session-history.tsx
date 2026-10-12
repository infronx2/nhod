'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Save, RefreshCw, Activity } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type {
  SessionRecord,
  SessionsResponse,
  StatsResponse,
  SaveSessionPayload,
} from '@/components/neuromove/types'

const SESSIONS_URL = '/api/v1/sessions?XTransformPort=8001'
const STATS_URL = '/api/v1/stats?XTransformPort=8001'

interface SessionHistoryProps {
  currentSnapshot: {
    repCount: number
    correctReps: number
    maxAchievedAngle: number
    compensationErrors: number
    score: number
    durationSeconds: number
  }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function SessionHistory({ currentSnapshot }: SessionHistoryProps) {
  const [sessions, setSessions] = React.useState<SessionRecord[]>([])
  const [stats, setStats] = React.useState<StatsResponse | null>(null)
  const [loadingSessions, setLoadingSessions] = React.useState(true)
  const [loadingStats, setLoadingStats] = React.useState(true)
  const [patientId, setPatientId] = React.useState('demo_patient')
  const [saving, setSaving] = React.useState(false)

  const fetchSessions = React.useCallback(async () => {
    setLoadingSessions(true)
    try {
      const res = await fetch(SESSIONS_URL)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as SessionsResponse
      setSessions(json.sessions ?? [])
    } catch (err) {
      console.warn('sessions fetch failed', err)
    } finally {
      setLoadingSessions(false)
    }
  }, [])

  const fetchStats = React.useCallback(async () => {
    setLoadingStats(true)
    try {
      const res = await fetch(STATS_URL)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as StatsResponse
      setStats(json)
    } catch (err) {
      console.warn('stats fetch failed', err)
    } finally {
      setLoadingStats(false)
    }
  }, [])

  // Initial fetch + 10s polling.
  React.useEffect(() => {
    void fetchSessions()
    void fetchStats()
    const id = window.setInterval(() => {
      void fetchSessions()
      void fetchStats()
    }, 10_000)
    return () => window.clearInterval(id)
  }, [fetchSessions, fetchStats])

  const handleSave = async () => {
    if (currentSnapshot.repCount <= 0) {
      toast.warning('No reps to save', {
        description: 'Start a tracking session first to record some reps.',
      })
      return
    }
    setSaving(true)
    try {
      const payload: SaveSessionPayload = {
        patient_id: patientId || 'demo_patient',
        duration_seconds: Math.max(1, Math.round(currentSnapshot.durationSeconds)),
        total_reps: currentSnapshot.repCount,
        correct_reps: currentSnapshot.correctReps,
        max_achieved_angle: Math.round(currentSnapshot.maxAchievedAngle),
        compensation_errors: currentSnapshot.compensationErrors,
        gamification_score: currentSnapshot.score,
      }
      const res = await fetch(SESSIONS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as { ok: boolean; session?: SessionRecord; error?: string }
      if (!json.ok) throw new Error(json.error ?? 'server rejected payload')
      toast.success('Session saved', {
        description: `${payload.total_reps} reps · ${payload.gamification_score} pts → ${payload.patient_id}`,
      })
      await Promise.all([fetchSessions(), fetchStats()])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown'
      toast.error('Save failed', { description: msg })
    } finally {
      setSaving(false)
    }
  }

  const totalReps = stats?.total_reps ?? 0
  const totalCorrect = stats?.total_correct_reps ?? 0
  const totalComp = Math.max(0, totalReps - totalCorrect)
  const accuracy = stats?.accuracy_pct ?? 0

  const pieData = [
    { name: 'Correct', value: totalCorrect, color: '#10b981' },
    { name: 'Compensated', value: totalComp, color: '#f43f5e' },
  ].filter((d) => d.value > 0)

  return (
    <section
      aria-label="Session history"
      className="rounded-xl border border-border/60 bg-card/40 p-4 sm:p-6"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Session History
          </h2>
          <p className="text-sm text-muted-foreground">
            Past sessions fetched from <code className="text-xs">/api/v1/sessions</code> every 10s.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-9 gap-1.5"
          onClick={() => {
            void fetchSessions()
            void fetchStats()
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Sessions table */}
        <Card className="lg:col-span-3">
          <div className="border-b border-border/60 p-3">
            <h3 className="text-sm font-semibold text-foreground">Recent Sessions</h3>
          </div>
          <div className="nm-scroll-thin max-h-96 overflow-y-auto">
            {loadingSessions && sessions.length === 0 ? (
              <div className="p-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="mb-2 h-10 w-full" />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
                <Activity className="h-8 w-8 opacity-50" aria-hidden="true" />
                <p className="text-sm">No sessions yet — start tracking to record one.</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead className="text-xs">ID</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Patient</TableHead>
                    <TableHead className="text-right text-xs">Reps</TableHead>
                    <TableHead className="text-right text-xs">Max°</TableHead>
                    <TableHead className="text-right text-xs">Comp</TableHead>
                    <TableHead className="text-right text-xs">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions
                    .slice()
                    .reverse()
                    .map((s) => (
                      <TableRow key={s.id} className="text-xs">
                        <TableCell className="font-mono">{s.id}</TableCell>
                        <TableCell>{formatDate(s.session_date)}</TableCell>
                        <TableCell className="font-mono">{s.patient_id}</TableCell>
                        <TableCell className="text-right font-mono">{s.total_reps}</TableCell>
                        <TableCell className="text-right font-mono">{s.max_achieved_angle}°</TableCell>
                        <TableCell className="text-right font-mono text-rose-500">
                          {s.compensation_errors}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-emerald-500">
                          {s.gamification_score}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </div>
        </Card>

        {/* Aggregate stats */}
        <Card className="lg:col-span-2">
          <div className="border-b border-border/60 p-3">
            <h3 className="text-sm font-semibold text-foreground">Aggregate Stats</h3>
          </div>
          <div className="p-4">
            {loadingStats && !stats ? (
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <StatBox label="Sessions" value={stats?.count ?? 0} accent="text-sky-400" />
                  <StatBox label="Total reps" value={totalReps} accent="text-teal-400" />
                  <StatBox label="Correct reps" value={totalCorrect} accent="text-emerald-500" />
                  <StatBox label="Total score" value={stats?.total_score ?? 0} accent="text-amber-500" />
                </div>
                <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                  <div className="flex w-full items-center justify-between">
                    <span className="text-xs text-muted-foreground">Accuracy</span>
                    <span className="font-mono text-xl font-bold text-emerald-500">
                      {accuracy.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, accuracy)}%` }}
                      transition={{ duration: 0.4 }}
                    />
                  </div>
                  {pieData.length > 0 && (
                    <div className="mt-2 flex w-full items-center gap-2">
                      <div className="h-24 w-24 shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieData}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={28}
                              outerRadius={42}
                              paddingAngle={2}
                              stroke="none"
                            >
                              {pieData.map((d) => (
                                <Cell key={d.name} fill={d.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                background: 'rgba(15, 23, 42, 0.95)',
                                border: '1px solid rgba(148, 163, 184, 0.3)',
                                borderRadius: 6,
                                fontSize: 11,
                                color: '#e2e8f0',
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-col gap-1 text-xs">
                        {pieData.map((d) => (
                          <div key={d.name} className="flex items-center gap-1.5">
                            <span
                              className="h-2.5 w-2.5 rounded-sm"
                              style={{ background: d.color }}
                              aria-hidden="true"
                            />
                            <span className="text-muted-foreground">{d.name}</span>
                            <span className="ml-auto font-mono font-semibold text-foreground">
                              {d.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Save current session */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/20 p-3">
        <label htmlFor="patient-id" className="text-xs font-medium text-muted-foreground">
          Patient ID
        </label>
        <Input
          id="patient-id"
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          className="h-9 w-44 font-mono text-xs"
          placeholder="demo_patient"
          aria-label="Patient ID for session save"
        />
        <Button
          size="sm"
          className="h-9 gap-1.5"
          disabled={saving}
          onClick={handleSave}
        >
          <Save className="h-3.5 w-3.5" aria-hidden="true" />
          {saving ? 'Saving…' : 'Save current session'}
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">
          Live: {currentSnapshot.repCount} reps · {currentSnapshot.score} pts ·{' '}
          {currentSnapshot.durationSeconds.toFixed(0)}s
        </span>
      </div>
    </section>
  )
}

function StatBox({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent: string
}) {
  return (
    <div className={cn('flex flex-col gap-0.5 rounded-lg border border-border/60 bg-card p-3')}>
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={cn('font-mono text-2xl font-bold tabular-nums', accent)}>
        {value.toLocaleString()}
      </span>
    </div>
  )
}
