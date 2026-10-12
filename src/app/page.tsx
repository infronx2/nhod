'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { Header } from '@/components/neuromove/header'
import { ArchitectureDiagram } from '@/components/neuromove/architecture-diagram'
import {
  TrackingPanel,
  type TrackSnapshot,
} from '@/components/neuromove/tracking-panel'
import { JsonStream } from '@/components/neuromove/json-stream'
import { SessionHistory } from '@/components/neuromove/session-history'
import { BiomechanicsExplainer } from '@/components/neuromove/biomechanics-explainer'
import { ApiReference } from '@/components/neuromove/api-reference'
import { Footer } from '@/components/neuromove/footer'
import { AuthScreen } from '@/components/neuromove/auth-screen'
import { DoctorDashboard } from '@/components/neuromove/doctor-dashboard'
import { PatientHeader } from '@/components/neuromove/patient-header'
import { BadgesPanel } from '@/components/neuromove/badges-panel'
import { ActivityChart } from '@/components/neuromove/activity-chart'
import { AgentChat } from '@/components/neuromove/agent-chat'
import { Card } from '@/components/ui/card'
import { usePoseTracking } from '@/hooks/use-pose-tracking'
import { useAuth, AuthProvider } from '@/hooks/use-auth'
import { apiFetch } from '@/lib/api'
import type {
  V2PatientDetail,
  V2Stats,
} from '@/lib/v2-types'
import { toast } from 'sonner'
import { motion } from 'framer-motion'

/**
 * SectionLabel — small uppercase muted label used as a divider between
 * major sections (per the styling polish spec: "01 · System Architecture",
 * "02 · Live Tracking").
 */
function SectionLabel({
  index,
  children,
}: {
  index: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[10px] font-semibold tracking-widest text-teal-500 uppercase">
        {index}
      </span>
      <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        {children}
      </span>
      <div className="h-px flex-1 bg-gradient-to-r from-border/60 to-transparent" />
    </div>
  )
}

/**
 * PatientDashboard — the authenticated patient's view. Combines the existing
 * tracking panel + JSON stream + history + biomechanics + API ref with the
 * new PatientHeader (active plan + daily-goal progress), the 7-day activity
 * chart, and the earned-badges panel.
 */
function PatientDashboard() {
  const { user } = useAuth()
  const [rtl] = React.useState(false)
  const [goal, setGoal] = React.useState(20)
  const [snapshot, setSnapshot] = React.useState<TrackSnapshot>({
    mode: 'demo',
    running: false,
    durationSeconds: 0,
    repCount: 0,
    correctReps: 0,
    maxAchievedAngle: 0,
    compensationErrors: 0,
    score: 0,
    simulated: true,
  })
  // Bumps whenever a session is saved so SessionHistory re-fetches.
  const [sessionRefreshSignal, setSessionRefreshSignal] = React.useState(0)

  // Patient detail (active plan + earned badges + sessions).
  const [detail, setDetail] = React.useState<V2PatientDetail | null>(null)
  const [detailLoading, setDetailLoading] = React.useState(true)
  const [stats, setStats] = React.useState<V2Stats | null>(null)
  const [statsLoading, setStatsLoading] = React.useState(true)

  // Single shared pose-tracking instance — feeds the header connection
  // pill, the JSON stream panel and the tracking panel itself.
  // The patient_id is passed so the Python pose-server auto-syncs the
  // completed session to the Next.js DB on WS close (no manual Save needed).
  const pose = usePoseTracking({
    limb: 'right',
    target_angle: 90,
    compensation_threshold: 0.05,
    patient_id: user?.id,
  })

  const fetchDetail = React.useCallback(async () => {
    if (!user) return
    setDetailLoading(true)
    try {
      const data = await apiFetch<V2PatientDetail>(
        `/api/v2/patients/${user.id}`,
      )
      setDetail(data)
    } catch {
      /* silent */
    } finally {
      setDetailLoading(false)
    }
  }, [user])

  const fetchStats = React.useCallback(async () => {
    if (!user) return
    setStatsLoading(true)
    try {
      const data = await apiFetch<V2Stats>(
        `/api/v2/stats?patientId=${encodeURIComponent(user.id)}`,
      )
      setStats(data)
    } catch {
      /* silent */
    } finally {
      setStatsLoading(false)
    }
  }, [user])

  React.useEffect(() => {
    if (user) {
      void fetchDetail()
      void fetchStats()
    }
  }, [user, fetchDetail, fetchStats])

  // Edge-trigger WS-state toasts.
  const prevConn = React.useRef(pose.connection)
  React.useEffect(() => {
    if (prevConn.current === pose.connection) return
    prevConn.current = pose.connection
    if (pose.connection === 'Connected') {
      toast.success('Inference server connected')
    } else if (pose.connection === 'Disconnected') {
      toast.info('Inference server disconnected')
    }
  }, [pose.connection])

  const handleSnapshot = React.useCallback((s: TrackSnapshot) => {
    setSnapshot(s)
  }, [])

  const onSessionSaved = React.useCallback(() => {
    void fetchDetail()
    void fetchStats()
    setSessionRefreshSignal((n) => n + 1)
  }, [fetchDetail, fetchStats])

  // Today's reps (from activity7d's last entry, if today exists).
  const todayReps = React.useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return stats?.activity7d?.find((d) => d.day === today)?.reps ?? 0
  }, [stats])

  return (
    <div className="nm-mesh-bg flex min-h-screen flex-col bg-background">
      <Header
        connection={pose.connection}
        rtl={rtl}
        onToggleRtl={() => {
          toast.info('Language toggle', {
            description: 'Full Arabic i18n is coming in a later phase.',
          })
        }}
      />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Active plan + daily goal */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <PatientHeader
            plan={detail?.activePlan ?? null}
            todayReps={todayReps}
            stats={stats}
            loading={detailLoading}
          />
        </motion.div>

        <SectionLabel index="01">Live tracking</SectionLabel>
        <TrackingPanel
          pose={pose}
          goal={goal}
          onGoalChange={setGoal}
          onTrackState={handleSnapshot}
          onSessionSaved={onSessionSaved}
        />

        <SectionLabel index="02">Progress</SectionLabel>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="border-border/40 bg-card/60 p-4 shadow-sm backdrop-blur">
            <ActivityChart data={stats?.activity7d ?? []} loading={statsLoading} />
          </Card>
          <Card className="border-border/40 bg-card/60 p-4 shadow-sm backdrop-blur lg:col-span-2">
            <BadgesPanel
              earnedBadges={detail?.earnedBadges ?? []}
              loading={detailLoading}
            />
          </Card>
        </div>

        <SectionLabel index="03">Live JSON stream</SectionLabel>
        <JsonStream messages={pose.messageLog} onClear={pose.clearLog} />

        <SectionLabel index="04">Session history</SectionLabel>
        <SessionHistory
          currentSnapshot={{
            repCount: snapshot.repCount,
            correctReps: snapshot.correctReps,
            maxAchievedAngle: snapshot.maxAchievedAngle,
            compensationErrors: snapshot.compensationErrors,
            score: snapshot.score,
            durationSeconds: snapshot.durationSeconds,
          }}
          refreshSignal={sessionRefreshSignal}
        />

        <SectionLabel index="05">System architecture</SectionLabel>
        <div id="architecture">
          <ArchitectureDiagram />
        </div>

        <SectionLabel index="06">Biomechanics</SectionLabel>
        <BiomechanicsExplainer />

        <SectionLabel index="07">UE5 integration guide</SectionLabel>
        <ApiReference />
      </main>

      <AgentChat variant="compact" />
      <Footer rtl={rtl} />
    </div>
  )
}

/**
 * DoctorView — the authenticated doctor's view. Wraps DoctorDashboard with
 * the standard header + footer chrome. Doctors have no live tracking panel
 * (they review patients, not their own rehab), so we don't mount the
 * pose-tracking hook here.
 */
function DoctorView() {
  const { user } = useAuth()
  const [rtl] = React.useState(false)

  return (
    <div className="nm-mesh-bg flex min-h-screen flex-col bg-background">
      <Header
        rtl={rtl}
        onToggleRtl={() => {
          toast.info('Language toggle', {
            description: 'Full Arabic i18n is coming in a later phase.',
          })
        }}
      />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <SectionLabel index="01">Doctor dashboard</SectionLabel>
        {user && <DoctorDashboard doctorId={user.id} />}
      </main>
      <AgentChat variant="compact" />
      <Footer rtl={rtl} />
    </div>
  )
}

/**
 * LoadingGate — spinner shown while the auth hook re-validates the persisted
 * JWT on first mount.
 */
function LoadingGate() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
      <p className="text-sm text-muted-foreground">Loading NeuroMove…</p>
    </div>
  )
}

/**
 * Home — root route. Wraps the whole app in <AuthProvider> and routes
 * between the AuthScreen (unauthenticated), the patient dashboard, and the
 * doctor dashboard based on the authenticated user's role.
 */
export default function Home() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  )
}

function Root() {
  const { user, loading } = useAuth()

  if (loading) return <LoadingGate />
  if (!user) return <AuthScreen />
  if (user.role.toUpperCase() === 'DOCTOR' || user.role.toUpperCase() === 'ADMIN') {
    return <DoctorView />
  }
  return <PatientDashboard />
}
