'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  Footprints,
  Dumbbell,
  Medal,
  Award,
  Flame,
  Target,
  Lock,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { V2EarnedBadge } from '@/lib/v2-types'
import { BADGE_CATALOG, type BadgeDef } from '@/lib/badges'

interface BadgesPanelProps {
  earnedBadges: V2EarnedBadge[]
  loading?: boolean
  /** When true, render in compact mode (smaller tiles, no descriptions). */
  compact?: boolean
}

/** Map slug → lucide icon (kept here so the catalog file stays icon-free). */
const BADGE_ICONS: Record<string, LucideIcon> = {
  Footprints,
  Dumbbell,
  Medal,
  Award,
  Flame,
  Target,
}

const TIER_STYLES: Record<BadgeDef['tier'], { ring: string; glow: string; label: string; chip: string }> = {
  bronze: {
    ring: 'border-amber-700/50',
    glow: 'shadow-[0_0_18px_-6px_rgba(180,83,9,0.55)]',
    label: 'text-amber-700 dark:text-amber-500',
    chip: 'bg-amber-700/15 text-amber-700 dark:text-amber-400',
  },
  silver: {
    ring: 'border-slate-400/50',
    glow: 'shadow-[0_0_18px_-6px_rgba(148,163,184,0.55)]',
    label: 'text-slate-500 dark:text-slate-300',
    chip: 'bg-slate-400/15 text-slate-600 dark:text-slate-300',
  },
  gold: {
    ring: 'border-yellow-500/60',
    glow: 'shadow-[0_0_22px_-6px_rgba(234,179,8,0.7)]',
    label: 'text-yellow-600 dark:text-yellow-400',
    chip: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
  },
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

/**
 * BadgesPanel — grid of badges (earned + locked), each with its icon, name
 * (EN + Arabic), tier color border, earned date.
 */
export function BadgesPanel({ earnedBadges, loading, compact }: BadgesPanelProps) {
  const earnedBySlug = React.useMemo(() => {
    const map = new Map<string, V2EarnedBadge>()
    for (const b of earnedBadges ?? []) map.set(b.slug, b)
    return map
  }, [earnedBadges])

  const earnedCount = BADGE_CATALOG.filter((b) => earnedBySlug.has(b.slug)).length

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="text-sm font-semibold">Badges</h3>
          <p className="text-[11px] text-muted-foreground">
            Gamified progress milestones
          </p>
        </div>
        <div className="text-right">
          <span className="font-mono text-base font-bold text-amber-500">
            {earnedCount}
          </span>
          <span className="text-xs text-muted-foreground">
            {' '}/ {BADGE_CATALOG.length}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {BADGE_CATALOG.map((b) => (
            <div
              key={b.slug}
              className="h-24 animate-pulse rounded-lg border border-border/40 bg-muted/30"
            />
          ))}
        </div>
      ) : (
        <div
          className={cn(
            'grid gap-2',
            compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3',
          )}
        >
          {BADGE_CATALOG.map((def) => {
            const earned = earnedBySlug.get(def.slug)
            const isEarned = !!earned
            const Icon = BADGE_ICONS[def.icon] ?? Award
            const tier = TIER_STYLES[def.tier]
            return (
              <motion.div
                key={def.slug}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: isEarned ? -3 : 0, scale: isEarned ? 1.02 : 1 }}
                className={cn(
                  'relative flex flex-col gap-1.5 rounded-lg border bg-card/60 p-3 backdrop-blur transition-colors',
                  isEarned
                    ? cn(tier.ring, tier.glow)
                    : 'border-border/40 opacity-55',
                )}
                title={isEarned ? `Earned on ${formatDate(earned!.earnedAt)}` : 'Locked'}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-full',
                      isEarned
                        ? cn('bg-gradient-to-br', tier.chip)
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {isEarned ? (
                      <Icon className={cn('h-4 w-4', tier.label)} />
                    ) : (
                      <Lock className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider',
                      isEarned ? tier.chip : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {def.tier}
                  </span>
                </div>
                <div>
                  <div className="text-xs font-semibold text-foreground">
                    {def.name}
                  </div>
                  <div className="font-arabic text-[11px] text-muted-foreground">
                    {def.nameAr}
                  </div>
                </div>
                {!compact && (
                  <div className="text-[10px] text-muted-foreground">
                    {isEarned ? (
                      <span>{formatDate(earned!.earnedAt)}</span>
                    ) : (
                      <span>{def.description}</span>
                    )}
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
