import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

/**
 * GET /api/v2/notifications?limit=20 — list the current user's notifications,
 * newest first. Unread ones are surfaced first (sorted by read asc, then
 * createdAt desc) so the bell badge reflects what's actually new.
 */
export async function GET(req: NextRequest) {
  const payload = getUserFromRequest(req)
  if (!payload) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
  }
  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '30', 10) || 30, 100)

  const notifications = await db.notification.findMany({
    where: { userId: payload.sub },
    orderBy: [{ read: 'asc' }, { createdAt: 'desc' }],
    take: limit,
  })

  const unreadCount = await db.notification.count({
    where: { userId: payload.sub, read: false },
  })

  return NextResponse.json({
    ok: true,
    notifications,
    unreadCount,
  })
}

/**
 * POST /api/v2/notifications/mark-all-read — mark all of the user's
 * notifications as read.
 */
export async function POST(req: NextRequest) {
  const payload = getUserFromRequest(req)
  if (!payload) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
  }
  const result = await db.notification.updateMany({
    where: { userId: payload.sub, read: false },
    data: { read: true },
  })
  return NextResponse.json({ ok: true, updated: result.count })
}
