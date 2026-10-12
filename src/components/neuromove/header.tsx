'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Moon, Sun, Languages, Wifi, WifiOff, Loader2 } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { WsConnectionState } from '@/components/neuromove/types'
import { UserMenu } from '@/components/neuromove/user-menu'
import { useAuth } from '@/hooks/use-auth'

interface HeaderProps {
  /** WS connection state. Omit / pass undefined to hide the WS pill entirely. */
  connection?: WsConnectionState
  rtl: boolean
  onToggleRtl: () => void
}

function NeuroMoveLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="NeuroMove neuron-joint logo"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* outer ring — joint capsule */}
      <circle
        cx="32"
        cy="32"
        r="28"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.25"
      />
      {/* dendrites */}
      <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.55">
        <path d="M32 4 L32 12" />
        <path d="M52 16 L46 21" />
        <path d="M60 32 L52 32" />
        <path d="M52 48 L46 43" />
        <path d="M32 60 L32 52" />
        <path d="M12 48 L18 43" />
        <path d="M4 32 L12 32" />
        <path d="M12 16 L18 21" />
      </g>
      {/* central soma */}
      <circle cx="32" cy="32" r="6" fill="currentColor" />
      {/* elbow-joint accent arc */}
      <path
        d="M20 40 Q32 50 44 36"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.85"
      />
      <circle cx="20" cy="40" r="3" fill="currentColor" />
      <circle cx="44" cy="36" r="3" fill="currentColor" />
    </svg>
  )
}

/**
 * Header — sticky top bar. When the user is authenticated (Phase 2) we show
 * the gradient header background + the UserMenu (avatar + role + logout)
 * alongside the existing language/theme toggles. When not authenticated we
 * render a slimmer version (just the brand + toggles) — the AuthScreen owns
 * the rest of the viewport in that case.
 *
 * The header background uses a subtle dark gradient with a faint radial teal
 * glow behind the logo for visual depth.
 */
export function Header({ connection, rtl, onToggleRtl }: HeaderProps) {
  const { theme, setTheme } = useTheme()
  const { user } = useAuth()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const statusColor: Record<WsConnectionState, string> = {
    Disconnected: 'bg-rose-500',
    Connecting: 'bg-amber-500',
    Connected: 'bg-emerald-500',
  }

  const statusLabel: Record<WsConnectionState, string> = {
    Disconnected: 'Disconnected',
    Connecting: 'Connecting',
    Connected: 'Connected',
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full border-b border-border/60 backdrop-blur-md supports-[backdrop-filter]:bg-background/70',
        // Subtle gradient overlay (works in both light and dark mode)
        'bg-gradient-to-r from-slate-50 via-background to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950',
      )}
    >
      {/* radial teal glow behind the logo */}
      <div
        className="pointer-events-none absolute top-1/2 left-2 h-24 w-24 -translate-y-1/2 rounded-full opacity-40 blur-2xl sm:left-6"
        style={{
          background:
            'radial-gradient(circle at center, rgba(20,184,166,0.45), transparent 70%)',
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ rotate: -8, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="text-teal-500"
          >
            <NeuroMoveLogo className="h-9 w-9 sm:h-10 sm:w-10" />
          </motion.div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-foreground sm:text-lg">
              NeuroMove
            </span>
            <span className="text-[10px] leading-tight text-muted-foreground sm:text-xs">
              Digital Therapeutic · post-stroke upper-limb rehab · سلطنة عُمان
            </span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Hide the language pill when authenticated — UserMenu is more useful. */}
          {!user && (
            <Badge
              variant="outline"
              className={cn(
                'hidden gap-1.5 border-border/60 px-2.5 py-1 text-xs font-medium sm:inline-flex',
                rtl && 'flex-row-reverse',
              )}
              aria-label={`Demo text direction: ${rtl ? 'RTL Arabic' : 'LTR English'}`}
            >
              <span className={cn('text-foreground', rtl && 'font-arabic')}>
                {rtl ? 'مرحباً بكم في NeuroMove' : 'Welcome to NeuroMove'}
              </span>
            </Badge>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={onToggleRtl}
            className="h-9 gap-1.5 px-3 text-xs"
            aria-label="Toggle language between English and Arabic"
          >
            <Languages className="h-4 w-4" aria-hidden="true" />
            <span>{rtl ? 'عربي' : 'EN'}</span>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground">{rtl ? 'EN' : 'عربي'}</span>
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle dark mode"
          >
            {mounted ? (
              theme === 'dark' ? (
                <Sun className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4" aria-hidden="true" />
              )
            ) : (
              <Sun className="h-4 w-4 opacity-50" aria-hidden="true" />
            )}
          </Button>

          {/* WS status pill — only shown when a connection state is provided
              (the doctor view doesn't have a tracking panel, so it omits it). */}
          {user && connection && (
            <div
              className="hidden items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1.5 text-xs font-medium md:inline-flex"
              role="status"
              aria-live="polite"
            >
              <span className="relative inline-flex h-2.5 w-2.5">
                <span
                  className={cn(
                    'inline-flex h-2.5 w-2.5 rounded-full',
                    statusColor[connection],
                  )}
                />
                {connection === 'Connecting' && (
                  <span className="absolute inset-0 inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-amber-500/60" />
                )}
              </span>
              <span className="text-foreground/90">{statusLabel[connection]}</span>
              {connection === 'Disconnected' ? (
                <WifiOff className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              ) : connection === 'Connecting' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden="true" />
              ) : (
                <Wifi className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
              )}
            </div>
          )}

          {user && <UserMenu />}
        </div>
      </div>
    </header>
  )
}
