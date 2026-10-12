import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { buildAgentContext, composeSystemPrompt } from '@/lib/agent-context'

// In-memory conversation store (per user, last 20 messages).
// Phase 3+: move to a Prisma `ChatMessage` model for persistence.
const conversations = new Map<string, Array<{ role: 'user' | 'assistant'; content: string }>>()
const MAX_HISTORY = 20

/**
 * POST /api/v2/agent/chat
 *
 * The NeuroMove Agentic AI Rehab Coach endpoint.
 *
 * Agentic pattern: we fetch the patient's REAL clinical context (active plan,
 * lifetime stats, recent sessions, earned badges, relevant exercises) UP FRONT
 * via `buildAgentContext`, inject it into the system prompt, then call the
 * z-ai LLM with the full conversation history. This is "tool-use by context
 * injection" — robust for a small fixed tool set and avoids the round-trip
 * latency + tool-selection hallucination of native function-calling.
 *
 * Body: { message: string, patientId?: string }
 * - Doctors must specify a patientId to coach that patient.
 * - Patients omit patientId (defaults to themselves).
 *
 * Returns: { ok, reply, contextSummary, history }
 */
export async function POST(req: NextRequest) {
  const payload = getUserFromRequest(req)
  if (!payload) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON' }, { status: 400 })
  }
  const message = String(body.message || '').trim()
  if (!message) {
    return NextResponse.json({ ok: false, error: 'message is required' }, { status: 400 })
  }
  if (message.length > 2000) {
    return NextResponse.json(
      { ok: false, error: 'message too long (max 2000 chars)' },
      { status: 400 },
    )
  }

  // Resolve the patient whose context the agent should use.
  const isDoctor = payload.role.toUpperCase() === 'DOCTOR' || payload.role.toUpperCase() === 'ADMIN'
  const patientId = body.patientId
    ? isDoctor
      ? String(body.patientId)
      : payload.sub === String(body.patientId)
        ? String(body.patientId)
        : null
    : payload.sub
  if (!patientId) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  // Fetch the patient record (for preferred dialect + name).
  const patientUser = await db.user.findUnique({
    where: { id: patientId },
    select: { preferredDialect: true, name: true, role: true },
  })
  if (!patientUser || patientUser.role !== 'PATIENT') {
    return NextResponse.json({ ok: false, error: 'patient not found' }, { status: 404 })
  }

  // Build the agent context (the "tools" output).
  const ctx = await buildAgentContext(patientId)
  if (!ctx) {
    return NextResponse.json({ ok: false, error: 'could not build agent context' }, { status: 500 })
  }

  const systemPrompt = composeSystemPrompt(ctx, patientUser.preferredDialect)

  // Load conversation history for this user (keyed by who's asking, so the
  // doctor coaching patient A has a different history than patient A themselves).
  const convKey = `${payload.sub}->${patientId}`
  const history = conversations.get(convKey) ?? []

  // Compose the messages for the LLM.
  const llmMessages: Array<{ role: 'assistant' | 'user'; content: string }> = [
    { role: 'assistant', content: systemPrompt },
    ...history,
    { role: 'user', content: message },
  ]

  // Call the z-ai LLM (server-side only).
  let reply = ''
  let toolsUsed: string[] = []
  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: llmMessages as any,
      thinking: { type: 'disabled' } as any,
    })
    reply = completion.choices[0]?.message?.content ?? ''
    if (!reply) throw new Error('empty LLM response')
    toolsUsed = ['get_patient_context', 'get_active_plan', 'get_session_stats', 'get_exercise_instructions']
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown LLM error'
    // Graceful fallback so the chat still responds if the LLM is unavailable.
    reply = isDoctor
      ? `I couldn't reach the AI model right now (${msg}). Based on ${patientUser.name}'s data: ${ctx.stats.totalSessions} sessions, ${ctx.stats.accuracyPct}% accuracy, max ROM ${ctx.stats.maxAngleOverall.toFixed(0)}°. Encourage them to keep their daily goal of ${ctx.activePlan?.dailyRepGoal ?? 20} reps and watch for compensation errors (avg ${ctx.stats.avgCompensationErrors.toFixed(1)}/session).`
      : `I couldn't reach the AI model right now, but here's your summary: you've completed ${ctx.stats.totalSessions} sessions with ${ctx.stats.totalReps} reps (${ctx.stats.accuracyPct}% accuracy) and reached ${ctx.stats.maxAngleOverall.toFixed(0)}° max ROM. ${ctx.activePlan ? `Your daily goal is ${ctx.activePlan.dailyRepGoal} reps.` : ''} Keep going — every rep counts!`
    toolsUsed = ['fallback_summary']
  }

  // Update conversation history (cap at MAX_HISTORY, keep system implicit).
  history.push({ role: 'user', content: message })
  history.push({ role: 'assistant', content: reply })
  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY)
  }
  conversations.set(convKey, history)

  return NextResponse.json({
    ok: true,
    reply,
    patientId,
    patientName: patientUser.name,
    toolsUsed,
    contextSummary: {
      totalSessions: ctx.stats.totalSessions,
      accuracyPct: ctx.stats.accuracyPct,
      maxAngle: ctx.stats.maxAngleOverall,
      hasActivePlan: !!ctx.activePlan,
      earnedBadgesCount: ctx.earnedBadges.length,
    },
    historyLength: history.length,
  })
}

/**
 * DELETE /api/v2/agent/chat?patientId=X — clear conversation history.
 */
export async function DELETE(req: NextRequest) {
  const payload = getUserFromRequest(req)
  if (!payload) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
  }
  const url = new URL(req.url)
  const patientId = url.searchParams.get('patientId')
  const isDoctor = payload.role.toUpperCase() === 'DOCTOR' || payload.role.toUpperCase() === 'ADMIN'
  const targetPatient = patientId
    ? isDoctor
      ? String(patientId)
      : payload.sub === String(patientId)
        ? String(patientId)
        : payload.sub
    : payload.sub
  const convKey = `${payload.sub}->${targetPatient}`
  conversations.delete(convKey)
  return NextResponse.json({ ok: true, cleared: convKey })
}
