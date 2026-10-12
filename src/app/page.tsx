'use client'

import * as React from 'react'
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
import { usePoseTracking } from '@/hooks/use-pose-tracking'
import { toast } from 'sonner'

export default function Home() {
  const [rtl, setRtl] = React.useState(false)
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

  // Single shared pose-tracking instance — feeds the header connection
  // pill, the JSON stream panel and the tracking panel itself.
  const pose = usePoseTracking({
    limb: 'right',
    target_angle: 90,
    compensation_threshold: 0.05,
  })

  // Edge-trigger WS-state toasts at the page level (the hook also toasts
  // connect / disconnect, but this makes the UX explicit on top).
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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header
        connection={pose.connection}
        rtl={rtl}
        onToggleRtl={() => {
          setRtl((r) => !r)
          toast.success(`Language: ${!rtl ? 'Arabic (RTL)' : 'English (LTR)'}`, {
            description: 'Full i18n lands in a later phase.',
          })
        }}
      />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div id="architecture">
          <ArchitectureDiagram />
        </div>

        <TrackingPanel
          pose={pose}
          goal={goal}
          onGoalChange={setGoal}
          onTrackState={handleSnapshot}
        />

        <JsonStream messages={pose.messageLog} onClear={pose.clearLog} />

        <SessionHistory
          currentSnapshot={{
            repCount: snapshot.repCount,
            correctReps: snapshot.correctReps,
            maxAchievedAngle: snapshot.maxAchievedAngle,
            compensationErrors: snapshot.compensationErrors,
            score: snapshot.score,
            durationSeconds: snapshot.durationSeconds,
          }}
        />

        <BiomechanicsExplainer />
        <ApiReference />
      </main>

      <Footer rtl={rtl} />
    </div>
  )
}
