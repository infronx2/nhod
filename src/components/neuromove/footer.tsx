'use client'

import * as React from 'react'
import { HeartPulse, Github, Map, Server } from 'lucide-react'

interface FooterProps {
  rtl: boolean
}

export function Footer({ rtl }: FooterProps) {
  return (
    <footer
      className="mt-auto w-full border-t border-border/60 bg-background/80 px-4 py-5 backdrop-blur sm:px-6 lg:px-8"
      aria-label="Site footer"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <HeartPulse className="h-4 w-4 text-rose-500" aria-hidden="true" />
            <span className="font-semibold text-foreground">NeuroMove</span>
            <span className="opacity-60">·</span>
            <span>Phase 1 MVP</span>
            <span className="opacity-60">·</span>
            <span>Built for سلطنة عُمان</span>
          </div>
          <nav className="flex flex-wrap items-center gap-3" aria-label="Footer navigation">
            <a
              href="/health?XTransformPort=8001"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <Server className="h-3.5 w-3.5" aria-hidden="true" />
              Backend health
            </a>
            <a
              href="https://github.com/"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <Github className="h-3.5 w-3.5" aria-hidden="true" />
              GitHub
            </a>
            <a
              href="#architecture"
              className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <Map className="h-3.5 w-3.5" aria-hidden="true" />
              Phase roadmap
            </a>
          </nav>
        </div>
        <p
          className={rtl ? 'text-right font-arabic' : 'text-left'}
          lang={rtl ? 'ar' : 'en'}
          dir={rtl ? 'rtl' : 'ltr'}
        >
          هذا النظام لأغراض التأهيل المساعد ولا يغني عن الإشراف الطبي المباشر
        </p>
        <p className="text-[10px] text-muted-foreground/70">
          This system is for assisted rehabilitation and does not replace direct medical supervision.
        </p>
      </div>
    </footer>
  )
}
