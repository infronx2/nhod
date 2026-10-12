'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Play, Square, Camera, ScanFace, RotateCcw, Save, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { usePoseTracking, type PoseTrackingApi } from '@/hooks/use-pose-tracking'
import { useDemoSimulator, synthElbowAngleAt } from '@/hooks/use-demo-simulator'
import { AngleGauge } from '@/components/neuromove/angle-gauge'
import { CommandBanner } from '@/components/neuromove/command-banner'
import { MetricsGrid } from '@/components/neuromove/metrics-grid'
import { ExercisePicker, type ExercisePickerValue } from '@/components/neuromove/exercise-picker'
import { useAuth } from '@/hooks/use-auth'
import { apiFetch } from '@/lib/api'
import type { V2SaveSessionResponse } from '@/lib/v2-types'
import type { WsCommand, PoseLandmarks } from '@/components/neuromove/types'

type Mode = 'live' | 'demo'

interface TrackingPanelProps {
  goal: number
  onGoalChange: (n: number) => void
  onTrackState?: (snap: TrackSnapshot) => void
  /**
   * The pose-tracking hook instance, owned by the page so that the
   * header connection pill, the JSON stream panel and this panel all
   * share a single WebSocket. Pass `usePoseTracking(...)` from the page.
   */
  pose: PoseTrackingApi
  /**
   * Optional callback invoked after a session is successfully persisted to
   * /api/v2/sessions. Parents can use this to refresh charts/history.
   * Receives the saved session's goal achievements (if any) so the parent
   * can fire a celebration.
   */
  onSessionSaved?: (goalAchievements?: Array<{ title: string; currentValue: number; targetValue: number }>) => void
}

export interface TrackSnapshot {
  mode: Mode
  running: boolean
  durationSeconds: number
  repCount: number
  correctReps: number
  maxAchievedAngle: number
  compensationErrors: number
  score: number
  simulated: boolean
}

const FRAME_RATE_TARGET = 10
const DEMO_FRAME_INTERVAL = 1000 / FRAME_RATE_TARGET

interface DemoMetrics {
  angle: number
  maxAngle: number
  reps: number
  correctReps: number
  score: number
  compensationErrors: number
  startedAt: number
  lastFlexedHigh: boolean
  lastFlexedLow: boolean
}

const DEMO_INITIAL: DemoMetrics = {
  angle: 0,
  maxAngle: 0,
  reps: 0,
  correctReps: 0,
  score: 0,
  compensationErrors: 0,
  startedAt: 0,
  lastFlexedHigh: false,
  lastFlexedLow: true,
}

/**
 * TrackingPanel — the headline feature of the dashboard.
 *
 * Left column: a canvas showing either the live webcam frame (with
 * skeleton overlay from server landmarks) OR the demo stick figure.
 * A control bar above lets the user switch mode, start/stop, change
 * limb, and tune target/threshold sliders — each sends a config
 * message over the WebSocket.
 *
 * Right column: live biomechanics readout (gauge + command banner +
 * metrics grid + progress).
 *
 * In demo mode the metrics are computed client-side because MediaPipe
 * will return NO_POSE for the synthetic stick figure. This keeps the
 * dashboard demonstrable without a webcam (e.g. agent-browser).
 */
export function TrackingPanel({ goal, onGoalChange, onTrackState, pose, onSessionSaved }: TrackingPanelProps) {
  const { user } = useAuth()
  const [mode, setMode] = React.useState<Mode>('demo')
  const [running, setRunning] = React.useState(false)
  const [limb, setLimb] = React.useState<'right' | 'left'>('right')
  const [targetAngle, setTargetAngle] = React.useState(90)
  const [compensationThreshold, setCompensationThreshold] = React.useState(0.05)
  const [mirror, setMirror] = React.useState(true)
  const [cameraError, setCameraError] = React.useState<string | null>(null)
  const [demoMetrics, setDemoMetrics] = React.useState<DemoMetrics>(DEMO_INITIAL)
  const [exercise, setExercise] = React.useState<ExercisePickerValue>({
    slug: 'custom',
    targetAngle: 90,
    limb: 'right',
    description: null,
    difficulty: null,
  })
  const [savingSession, setSavingSession] = React.useState(false)

  // Rolling buffer of elbow-angle samples for the session's angleTimeline
  // field (POSTed to /api/v2/sessions on save). Capped at 500 to match the
  // server-side clamp.
  const angleTimelineRef = React.useRef<number[]>([])

  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const rafRef = React.useRef<number | null>(null)
  const lastFrameTsRef = React.useRef(0)
  const streamRef = React.useRef<MediaStream | null>(null)
  const demoStartRef = React.useRef(0)

  // When the exercise preset changes, sync its target angle + limb into
  // the local control state (this fires sendConfig via the effect below).
  // 'custom' leaves the slider value alone.
  React.useEffect(() => {
    if (exercise.slug === 'custom') return
    setTargetAngle(exercise.targetAngle)
    setLimb(exercise.limb)
  }, [exercise.slug, exercise.targetAngle, exercise.limb])

  // Keep the shared hook config in sync with the local control state so
  // sendConfig / start always use the latest values.
  //
  // We destructure `sendConfig` out of `pose` and depend on THAT rather than
  // the whole `pose` object: the hook returns a fresh object literal every
  // render, so depending on `pose` would re-fire this effect on every render
  // → sendConfig → setAppliedConfig → re-render → infinite loop ("Maximum
  // update depth exceeded"). `sendConfig` is a `useCallback` with [] deps so
  // its identity is stable across renders.
  const { sendConfig } = pose
  React.useEffect(() => {
    sendConfig({
      limb,
      target_angle: targetAngle,
      compensation_threshold: compensationThreshold,
    })
  }, [limb, targetAngle, compensationThreshold, sendConfig])

  const sim = useDemoSimulator()

  // ---- Frame loop (single rAF, shared by both modes) ----
  // We use a ref indirection so the callback can reschedule itself
  // without referencing its own (TDZ-bound) `const` name.
  const loopRef = React.useRef<() => void>(() => {})
  const drawAndSend = React.useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      rafRef.current = requestAnimationFrame(() => loopRef.current())
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      rafRef.current = requestAnimationFrame(() => loopRef.current())
      return
    }
    const now = performance.now()
    const elapsed = now - lastFrameTsRef.current
    if (elapsed < DEMO_FRAME_INTERVAL) {
      rafRef.current = requestAnimationFrame(() => loopRef.current())
      return
    }
    lastFrameTsRef.current = now

    // Push the current displayed angle into the rolling timeline buffer
    // (capped at 500 samples). Only happens during active tracking.
    const angleNow = mode === 'demo' ? demoMetrics.angle : pose.elbowAngle
    if (typeof angleNow === 'number' && angleNow > 0) {
      const buf = angleTimelineRef.current
      buf.push(Math.round(angleNow * 100) / 100)
      if (buf.length > 500) buf.splice(0, buf.length - 500)
    }

    if (mode === 'live') {
      const video = videoRef.current
      if (!video || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(() => loopRef.current())
        return
      }
      const vw = video.videoWidth || 640
      const vh = video.videoHeight || 480
      if (canvas.width !== vw) canvas.width = vw
      if (canvas.height !== vh) canvas.height = vh
      ctx.save()
      if (mirror) {
        ctx.translate(vw, 0)
        ctx.scale(-1, 1)
      }
      ctx.drawImage(video, 0, 0, vw, vh)
      ctx.restore()

      // Send base64 frame to backend (strip data URI prefix).
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6)
      const b64 = dataUrl.split(',')[1] ?? ''
      pose.sendFrame(b64)

      drawSkeleton(ctx, pose.landmarks, vw, vh, pose.command, mirror)
    } else {
      // Demo mode — capture from the offscreen simulator canvas, send it
      // to the backend, and draw it directly onto our visible canvas
      // (no async base64→Image round-trip needed).
      const simDataUrl = sim.captureFrame()
      const b64 = simDataUrl.split(',')[1] ?? ''
      pose.sendFrame(b64)

      if (sim.canvas) {
        if (canvas.width !== sim.canvas.width) canvas.width = sim.canvas.width
        if (canvas.height !== sim.canvas.height) canvas.height = sim.canvas.height
        ctx.drawImage(sim.canvas, 0, 0)
      }
    }

    rafRef.current = requestAnimationFrame(() => loopRef.current())
  }, [mode, mirror, pose, sim, demoMetrics.angle])

  // ---- Live camera start/stop ----
  const startCamera = React.useCallback(async () => {
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        await video.play().catch(() => undefined)
      }
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Camera permission denied. Switch to Demo Simulator to try the dashboard without a webcam.'
          : err instanceof Error
            ? err.message
            : 'Unknown camera error'
      setCameraError(msg)
      toast.error('Camera access failed', { description: msg })
      setMode('demo')
      setRunning(false)
    }
  }, [])

  const stopCamera = React.useCallback(() => {
    const stream = streamRef.current
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    const video = videoRef.current
    if (video) video.srcObject = null
  }, [])

  // ---- Start / Stop tracking ----
  const startTracking = React.useCallback(() => {
    pose.start()
    sim.reset()
    demoStartRef.current = performance.now()
    setDemoMetrics({
      ...DEMO_INITIAL,
      startedAt: performance.now(),
      lastFlexedLow: true,
    })
    setRunning(true)
    if (mode === 'live') {
      void startCamera()
    }
  }, [mode, pose, sim, startCamera])

  const stopTracking = React.useCallback(() => {
    setRunning(false)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    pose.stop()
    stopCamera()
  }, [pose, stopCamera])

  // Keep the loop ref pointing at the latest drawAndSend so the rAF
  // self-rescheduler always invokes a fresh closure with up-to-date
  // `mode`, `mirror`, `pose`, and `sim` values.
  React.useEffect(() => {
    loopRef.current = drawAndSend
  }, [drawAndSend])

  // Manage the rAF loop based on running state.
  React.useEffect(() => {
    if (running) {
      lastFrameTsRef.current = 0
      rafRef.current = requestAnimationFrame(() => loopRef.current())
    } else if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [running])

  // Clean up camera on unmount or mode change away from live.
  React.useEffect(() => {
    if (mode !== 'live' || !running) {
      stopCamera()
    }
    return () => stopCamera()
  }, [mode, running, stopCamera])

  // Reset the angle timeline buffer when (re)starting a tracking session.
  React.useEffect(() => {
    if (running) angleTimelineRef.current = []
  }, [running])

  // ---- Demo mode client-side metrics (rep counter with hysteresis) ----
  React.useEffect(() => {
    if (!running || mode !== 'demo') return
    let raf = 0
    const tick = () => {
      const t = performance.now() - demoStartRef.current
      const angle = synthElbowAngleAt(t)
      const flexedHigh = angle >= targetAngle * 0.9
      const flexedLow = angle <= targetAngle * 0.4
      // Simulate an occasional compensation error (every ~6s during the
      // "upswing") so the Comp. Errors metric in demo mode is non-zero.
      const compPhase = (t / 1000) % 6
      const compensationNow = compPhase > 4.5 && compPhase < 5.0

      setDemoMetrics((prev) => {
        let reps = prev.reps
        let correctReps = prev.correctReps
        let score = prev.score
        let compensationErrors = prev.compensationErrors
        let lastFlexedHigh = prev.lastFlexedHigh
        let lastFlexedLow = prev.lastFlexedLow
        const maxAngle = Math.max(prev.maxAngle, angle)

        // Hysteresis rep counter: a rep is one cycle (low → high → low).
        if (flexedHigh && !lastFlexedHigh && lastFlexedLow) {
          reps += 1
          if (compensationNow) {
            compensationErrors += 1
            score += 3
          } else {
            correctReps += 1
            score += 10
          }
        }
        if (flexedHigh) lastFlexedLow = false
        if (flexedLow) {
          lastFlexedHigh = false
          lastFlexedLow = true
        }
        if (flexedHigh) lastFlexedHigh = true

        return {
          angle,
          maxAngle,
          reps,
          correctReps,
          score,
          compensationErrors,
          startedAt: prev.startedAt,
          lastFlexedHigh,
          lastFlexedLow,
        }
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [running, mode, targetAngle])

  // ---- Push snapshot upstream for session saving ----
  const liveAngle = pose.elbowAngle
  const demoAngle = demoMetrics.angle
  const displayedAngle = mode === 'demo' ? demoAngle : liveAngle
  const displayedMax = mode === 'demo' ? demoMetrics.maxAngle : pose.maxAchievedAngle
  const displayedReps = mode === 'demo' ? demoMetrics.reps : pose.repCount
  const displayedScore = mode === 'demo' ? demoMetrics.score : pose.score
  const displayedCompErrors =
    mode === 'demo' ? demoMetrics.compensationErrors : pose.compensationErrors
  const displayedCorrectReps =
    mode === 'demo'
      ? demoMetrics.correctReps
      : Math.max(0, pose.repCount - pose.compensationErrors)
  const displayedLatency = pose.latencyMs || 0
  const displayedFps = pose.fpsAvg || (running ? FRAME_RATE_TARGET : 0)
  const displayedTargetReached =
    mode === 'demo' ? demoAngle >= targetAngle : pose.targetReached
  const displayedCompensation = mode === 'demo' ? false : pose.compensationDetected
  const displayedCommand: WsCommand =
    mode === 'demo'
      ? displayedTargetReached
        ? 'TARGET_HIT'
        : 'KEEP_GOING'
      : pose.command

  React.useEffect(() => {
    if (!onTrackState) return
    onTrackState({
      mode,
      running,
      durationSeconds: demoStartRef.current
        ? (performance.now() - demoStartRef.current) / 1000
        : 0,
      repCount: displayedReps,
      correctReps: displayedCorrectReps,
      maxAchievedAngle: displayedMax,
      compensationErrors: displayedCompErrors,
      score: displayedScore,
      simulated: mode === 'demo',
    })
  }, [
    onTrackState,
    mode,
    running,
    displayedReps,
    displayedCorrectReps,
    displayedMax,
    displayedCompErrors,
    displayedScore,
  ])

  // ---- Save session to /api/v2/sessions ----
  const handleSaveSession = React.useCallback(async () => {
    if (!user) {
      toast.error('Sign in to save sessions', {
        description: 'You must be authenticated to persist a session.',
      })
      return
    }
    if (displayedReps <= 0) {
      toast.warning('No reps to save', {
        description: 'Start tracking and complete at least one rep first.',
      })
      return
    }
    setSavingSession(true)
    try {
      const payload = {
        patientId: user.id,
        source: mode,
        limb,
        durationSeconds: Math.max(
          1,
          Math.round(
            demoStartRef.current
              ? (performance.now() - demoStartRef.current) / 1000
              : 0,
          ),
        ),
        totalReps: displayedReps,
        correctReps: displayedCorrectReps,
        maxAchievedAngle: Math.round(displayedMax * 100) / 100,
        compensationErrors: displayedCompErrors,
        gamificationScore: displayedScore,
        angleTimeline: angleTimelineRef.current.slice(-200),
      }
      const data = await apiFetch<V2SaveSessionResponse>('/api/v2/sessions', {
        method: 'POST',
        json: payload,
      })
      toast.success('Session saved', {
        description: `${payload.totalReps} reps · ${payload.gamificationScore} pts`,
      })
      // Celebratory toast for newly-earned badges.
      if (data.newBadges && data.newBadges.length > 0) {
        for (const b of data.newBadges) {
          toast.success(`🏆 Badge earned: ${b.name}`, {
            description: b.nameAr,
            duration: 5000,
          })
        }
      }
      // Clear the buffer so the next session starts fresh.
      angleTimelineRef.current = []
      // Pass goal achievements up so the parent can fire a celebration.
      const goalAchievements = (data as any).goalAchievements as
        | Array<{ title: string; currentValue: number; targetValue: number }>
        | undefined
      onSessionSaved?.(goalAchievements)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown'
      toast.error('Save failed', { description: msg })
    } finally {
      setSavingSession(false)
    }
  }, [
    user,
    mode,
    limb,
    displayedReps,
    displayedCorrectReps,
    displayedMax,
    displayedCompErrors,
    displayedScore,
    onSessionSaved,
  ])

  return (
    <Card className="overflow-hidden border-border/60 bg-card/40">
      <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 lg:grid-cols-2">
        {/* ---- LEFT: camera / demo view ---- */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-md border border-border bg-card">
              <button
                onClick={() => {
                  if (running) stopTracking()
                  setMode('live')
                }}
                className={cn(
                  'flex h-9 items-center gap-1.5 px-3 text-xs font-medium transition-colors',
                  mode === 'live'
                    ? 'bg-teal-500 text-teal-50'
                    : 'text-foreground/80 hover:bg-muted',
                )}
                aria-pressed={mode === 'live'}
              >
                <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                Live Camera
              </button>
              <button
                onClick={() => {
                  if (running) stopTracking()
                  setMode('demo')
                }}
                className={cn(
                  'flex h-9 items-center gap-1.5 px-3 text-xs font-medium transition-colors',
                  mode === 'demo'
                    ? 'bg-teal-500 text-teal-50'
                    : 'text-foreground/80 hover:bg-muted',
                )}
                aria-pressed={mode === 'demo'}
              >
                <ScanFace className="h-3.5 w-3.5" aria-hidden="true" />
                Demo Simulator
              </button>
            </div>

            <Button
              size="sm"
              className={cn(
                'h-9 gap-1.5 font-medium',
                running
                  ? 'bg-rose-500 text-rose-50 hover:bg-rose-600'
                  : 'bg-emerald-500 text-emerald-50 hover:bg-emerald-600',
              )}
              onClick={running ? stopTracking : startTracking}
              aria-label={running ? 'Stop tracking' : 'Start tracking'}
            >
              {running ? (
                <>
                  <Square className="h-3.5 w-3.5" aria-hidden="true" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  Start tracking
                </>
              )}
            </Button>

            <Select
              value={limb}
              onValueChange={(v) => {
                setLimb(v as 'right' | 'left')
                pose.sendConfig({ limb: v as 'right' | 'left' })
              }}
            >
              <SelectTrigger className="h-9 w-[110px] text-xs" aria-label="Limb selection">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="right">Right arm</SelectItem>
                <SelectItem value="left">Left arm</SelectItem>
              </SelectContent>
            </Select>

            {mode === 'live' && (
              <Button
                size="sm"
                variant="outline"
                className="h-9 gap-1.5"
                onClick={() => setMirror((m) => !m)}
                aria-label="Toggle mirror"
                aria-pressed={mirror}
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Mirror
              </Button>
            )}
          </div>

          {/* Camera / canvas viewport */}
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-border/60 bg-slate-950">
            <video
              ref={videoRef}
              playsInline
              muted
              className="hidden h-full w-full object-cover"
              aria-hidden="true"
            />
            <canvas
              ref={canvasRef}
              className="h-full w-full object-contain"
              role="img"
              aria-label={
                mode === 'live'
                  ? 'Live camera feed with pose skeleton overlay'
                  : 'Demo simulator stick figure'
              }
            />
            <div className="pointer-events-none absolute left-2 top-2 flex flex-col gap-1">
              <Badge
                className={cn(
                  'w-fit text-[10px] font-bold uppercase tracking-wider',
                  running
                    ? 'bg-emerald-500 text-emerald-50'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {running ? '● REC' : '○ IDLE'}
              </Badge>
              {mode === 'demo' && (
                <Badge className="w-fit bg-amber-500/20 text-amber-500">
                  demo · simulated
                </Badge>
              )}
              {pose.connection === 'Connected' && (
                <Badge className="w-fit bg-emerald-500/20 text-emerald-400">
                  ws live · {pose.latencyMs.toFixed(0)}ms
                </Badge>
              )}
            </div>
            {!running && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/70 text-center text-slate-300">
                <ScanFace className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-medium">
                  {mode === 'live' ? 'Camera idle' : 'Simulator idle'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Press “Start tracking” to begin.
                </p>
              </div>
            )}
            {mode === 'live' && cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/85 p-4 text-center text-rose-300">
                <p className="text-sm font-medium">Camera unavailable</p>
                <p className="text-xs text-rose-300/80">{cameraError}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => {
                    setMode('demo')
                    setCameraError(null)
                  }}
                >
                  Switch to Demo Simulator
                </Button>
              </div>
            )}
          </div>

          {/* Exercise preset + sliders */}
          <ExercisePicker value={exercise} onChange={setExercise} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="target-angle" className="font-medium text-muted-foreground">
                  Target angle
                </label>
                <span className="font-mono font-semibold text-amber-500">
                  {targetAngle}°
                </span>
              </div>
              <Slider
                id="target-angle"
                value={[targetAngle]}
                min={0}
                max={180}
                step={1}
                onValueChange={(v) => setTargetAngle(v[0])}
                onValueCommit={(v) => pose.sendConfig({ target_angle: v[0] })}
                aria-label="Target elbow angle in degrees"
              />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="comp-thr" className="font-medium text-muted-foreground">
                  Compensation threshold
                </label>
                <span className="font-mono font-semibold text-rose-500">
                  {compensationThreshold.toFixed(2)}
                </span>
              </div>
              <Slider
                id="comp-thr"
                value={[compensationThreshold]}
                min={0.01}
                max={0.2}
                step={0.01}
                onValueChange={(v) => setCompensationThreshold(v[0])}
                onValueCommit={(v) =>
                  pose.sendConfig({ compensation_threshold: v[0] })
                }
                aria-label="Compensation shrug threshold"
              />
            </div>
          </div>
        </div>

        {/* ---- RIGHT: biomechanics readout ---- */}
        <div className="flex flex-col gap-3">
          <motion.div
            layout
            className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card p-3"
          >
            <div className="flex flex-col">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Elbow angle
              </span>
              <span className="text-[10px] text-muted-foreground/70">
                {mode === 'demo'
                  ? 'client-side simulated · 20°–160° cycle'
                  : 'live from MediaPipe Pose'}
              </span>
            </div>
            <AngleGauge
              angle={displayedAngle}
              target={targetAngle}
              compensation={displayedCompensation}
              reached={displayedTargetReached}
              simulated={mode === 'demo'}
            />
          </motion.div>

          <CommandBanner command={displayedCommand} />

          <MetricsGrid
            repCount={displayedReps}
            score={displayedScore}
            maxAngle={displayedMax}
            compensationErrors={displayedCompErrors}
            latencyMs={displayedLatency}
            fpsAvg={displayedFps}
            latencyHistory={pose.latencyHistory}
            angleHistory={mode === 'demo' ? [] : pose.angleHistory}
            fpsHistory={pose.fpsHistory}
            goal={goal}
            onGoalChange={onGoalChange}
            simulated={mode === 'demo'}
            command={displayedCommand}
          />

          {/* Save session to /api/v2/sessions */}
          {user && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/20 p-3">
              <Button
                size="sm"
                className="h-9 gap-1.5 bg-teal-600 text-white hover:bg-teal-700"
                onClick={handleSaveSession}
                disabled={savingSession || displayedReps <= 0}
              >
                {savingSession ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {savingSession ? 'Saving…' : 'Save session'}
              </Button>
              <span className="ml-auto text-xs text-muted-foreground">
                {displayedReps > 0
                  ? `${displayedReps} reps · ${displayedScore} pts · ${displayedMax.toFixed(0)}° max → saved to your profile`
                  : 'No reps to save yet'}
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------
const SKELETON_COLORS: Record<WsCommand, string> = {
  KEEP_GOING: '#14b8a6',
  HOLD: '#f59e0b',
  TARGET_HIT: '#10b981',
  CORRECT_POSTURE: '#f43f5e',
  NO_POSE: '#94a3b8',
}

function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: PoseLandmarks | null,
  w: number,
  h: number,
  command: WsCommand,
  mirror: boolean,
) {
  if (!landmarks) return
  const { shoulder, elbow, wrist } = landmarks
  if (!shoulder || !elbow || !wrist) return
  const color = SKELETON_COLORS[command]
  ctx.save()
  ctx.lineWidth = 5
  ctx.strokeStyle = color
  ctx.lineCap = 'round'
  // Mirror X coordinates if the displayed video was mirrored (selfie view).
  const mx = (x: number) => (mirror ? 1 - x : x) * w
  const my = (y: number) => y * h
  ctx.beginPath()
  ctx.moveTo(mx(shoulder[0]), my(shoulder[1]))
  ctx.lineTo(mx(elbow[0]), my(elbow[1]))
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(mx(elbow[0]), my(elbow[1]))
  ctx.lineTo(mx(wrist[0]), my(wrist[1]))
  ctx.stroke()
  ctx.fillStyle = color
  for (const [x, y] of [shoulder, elbow, wrist]) {
    ctx.beginPath()
    ctx.arc(mx(x), my(y), 7, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}
