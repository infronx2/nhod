'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Loader2,
  LogIn,
  UserPlus,
  Eye,
  EyeOff,
  Shield,
  UserRound,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const DEMO_ACCOUNTS = [
  {
    label: 'طبيب — د. سالم الحبسي',
    email: 'doctor@nuhoud.health',
    password: 'demo1234',
    role: 'DOCTOR' as const,
    icon: Shield,
    accent: 'text-amber-500',
  },
  {
    label: 'مريض — ليلى المنذرية',
    email: 'layla@nuhoud.health',
    password: 'demo1234',
    role: 'PATIENT' as const,
    icon: UserRound,
    accent: 'text-teal-500',
  },
  {
    label: 'مريض — عمر السناني',
    email: 'omar@nuhoud.health',
    password: 'demo1234',
    role: 'PATIENT' as const,
    icon: UserRound,
    accent: 'text-emerald-500',
  },
]

/**
 * AuthScreen — beautiful split-screen login/register.
 *
 * Left: Nuhoud brand panel with a subtle radial teal glow, an animated
 * neuron SVG, and the bilingual tagline.
 * Right: tabbed login/register form with email validation, password eye
 * toggle, and one-click demo-account quick-login buttons.
 */
export function AuthScreen() {
  const { login, register } = useAuth()
  const [tab, setTab] = React.useState<'login' | 'register'>('login')

  // Login state
  const [loginEmail, setLoginEmail] = React.useState('')
  const [loginPassword, setLoginPassword] = React.useState('')
  const [showLoginPw, setShowLoginPw] = React.useState(false)
  const [loginBusy, setLoginBusy] = React.useState(false)

  // Register state
  const [regName, setRegName] = React.useState('')
  const [regEmail, setRegEmail] = React.useState('')
  const [regPassword, setRegPassword] = React.useState('')
  const [showRegPw, setShowRegPw] = React.useState(false)
  const [regRole, setRegRole] = React.useState<'PATIENT' | 'DOCTOR'>('PATIENT')
  const [regBusy, setRegBusy] = React.useState(false)

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const email = loginEmail.trim().toLowerCase()
    if (!EMAIL_RE.test(email)) {
      toast.error('Invalid email', { description: 'Please enter a valid email address.' })
      return
    }
    if (!loginPassword) {
      toast.error('Password required')
      return
    }
    setLoginBusy(true)
    try {
      const user = await login(email, loginPassword)
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed'
      toast.error('Login failed', { description: msg })
    } finally {
      setLoginBusy(false)
    }
  }

  const handleRegister = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const email = regEmail.trim().toLowerCase()
    const name = regName.trim()
    if (!name) {
      toast.error('Name required')
      return
    }
    if (!EMAIL_RE.test(email)) {
      toast.error('Invalid email')
      return
    }
    if (regPassword.length < 6) {
      toast.error('Password too short', { description: 'Minimum 6 characters.' })
      return
    }
    setRegBusy(true)
    try {
      const user = await register({ email, name, password: regPassword, role: regRole })
      toast.success(`Account created — welcome, ${user.name.split(' ')[0]}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed'
      toast.error('Registration failed', { description: msg })
    } finally {
      setRegBusy(false)
    }
  }

  const quickLogin = async (email: string, password: string) => {
    setLoginEmail(email)
    setLoginPassword(password)
    setTab('login')
    setLoginBusy(true)
    try {
      const user = await login(email, password)
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed'
      toast.error('Login failed', { description: msg })
    } finally {
      setLoginBusy(false)
    }
  }

  return (
    <div className="nm-mesh-bg grid min-h-screen w-full grid-cols-1 lg:grid-cols-2">
      {/* ---------- Left: brand panel ---------- */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* radial teal glow behind the logo */}
        <div
          className="pointer-events-none absolute -left-24 top-24 h-96 w-96 rounded-full opacity-50 blur-3xl"
          style={{
            background:
              'radial-gradient(circle at center, rgba(20,184,166,0.45), transparent 70%)',
          }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full opacity-30 blur-3xl"
          style={{
            background:
              'radial-gradient(circle at center, rgba(245,158,11,0.35), transparent 70%)',
          }}
          aria-hidden="true"
        />

        <div className="relative z-10 flex items-center gap-3">
          <motion.div
            initial={{ rotate: -8, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="text-teal-400"
          >
            <NeuronMark className="h-12 w-12" />
          </motion.div>
          <div className="flex flex-col">
            <span className="text-2xl font-bold tracking-tight text-white">
              Nuhoud
            </span>
            <span className="text-xs text-slate-400">
              Digital Therapeutic · post-stroke upper-limb rehab
            </span>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="relative z-10 flex flex-col gap-4"
        >
          <h1 className="max-w-md text-4xl font-bold leading-tight text-white">
            نعيد الحركة،{' '}
            <span className="bg-gradient-to-r from-teal-300 to-emerald-300 bg-clip-text text-transparent">
              تكراراً بتكرار
            </span>
            .
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-slate-300">
            تتبع حركي لحظي بالذكاء الاصطناعي، تغذية راجعة حركية، تمارين تأهيل
            تفاعلية، وتصدير جلسات جاهز لمعيار HL7 FHIR —
            مصمّم لسلطنة عُمان.
          </p>
          <ul className="flex flex-col gap-2 text-sm text-slate-300">
            <li className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-teal-400" /> استدلال لحظي بـ MediaPipe Pose
            </li>
            <li className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-teal-400" /> خطط علاجية سريرية + اتجاهات نشاط 7 أيام
            </li>
            <li className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-teal-400" /> أوسمة تحفيزية و تصدير FHIR R4
            </li>
          </ul>
        </motion.div>

        <div className="relative z-10 text-xs text-slate-500">
          المرحلة الثانية · المصادقة، التخزين و لوحات سريرية
        </div>
      </div>

      {/* ---------- Right: form panel ---------- */}
      <div className="flex items-center justify-center bg-background p-6 sm:p-10">
        <div className="w-full max-w-md">
          {/* mobile-only header */}
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <div className="text-teal-500">
              <NeuronMark className="h-9 w-9" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight">نُهوض</span>
              <span className="text-[10px] text-muted-foreground">
                علاج رقمي · تأهيل ما بعد السكتة
              </span>
            </div>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as 'login' | 'register')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login" className="gap-1.5">
                <LogIn className="h-3.5 w-3.5" /> تسجيل الدخول
              </TabsTrigger>
              <TabsTrigger value="register" className="gap-1.5">
                <UserPlus className="h-3.5 w-3.5" /> حساب جديد
              </TabsTrigger>
            </TabsList>

            {/* ----- Login ----- */}
            <TabsContent value="login">
              <Card className="border-border/40 bg-card/60 shadow-lg shadow-black/20 backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-xl">مرحباً بعودتك</CardTitle>
                  <CardDescription>
                    سجّل الدخول إلى حسابك في نُهوض للمتابعة.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleLogin} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="login-email">البريد الإلكتروني</Label>
                      <Input
                        id="login-email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@nuhood.health"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        disabled={loginBusy}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="login-pw">كلمة المرور</Label>
                      <div className="relative">
                        <Input
                          id="login-pw"
                          type={showLoginPw ? 'text' : 'password'}
                          autoComplete="current-password"
                          placeholder="••••••••"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          disabled={loginBusy}
                          required
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPw((s) => !s)}
                          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                          aria-label={showLoginPw ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                        >
                          {showLoginPw ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      disabled={loginBusy}
                      className="mt-1 h-10 gap-2 bg-teal-600 text-white hover:bg-teal-700"
                    >
                      {loginBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <LogIn className="h-4 w-4" />
                      )}
                      دخول
                    </Button>
                  </form>

                  <DemoQuickLogin onPick={quickLogin} busy={loginBusy} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ----- Register ----- */}
            <TabsContent value="register">
              <Card className="border-border/40 bg-card/60 shadow-lg shadow-black/20 backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-xl">أنشئ حسابك</CardTitle>
                  <CardDescription>
                    يمكن للمرضى والأطباء إنشاء حساب للوصول التجريبي.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleRegister} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="reg-name">الاسم الكامل</Label>
                      <Input
                        id="reg-name"
                        autoComplete="name"
                        placeholder="مثال: سارة البلوشية"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        disabled={regBusy}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="reg-email">البريد الإلكتروني</Label>
                      <Input
                        id="reg-email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@nuhood.health"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        disabled={regBusy}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="reg-pw">كلمة المرور</Label>
                      <div className="relative">
                        <Input
                          id="reg-pw"
                          type={showRegPw ? 'text' : 'password'}
                          autoComplete="new-password"
                          placeholder="٦ أحرف على الأقل"
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          disabled={regBusy}
                          required
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegPw((s) => !s)}
                          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                          aria-label={showRegPw ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                        >
                          {showRegPw ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>نوع الحساب</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['PATIENT', 'DOCTOR'] as const).map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setRegRole(r)}
                            className={cn(
                              'flex h-10 items-center justify-center gap-2 rounded-md border text-sm font-medium transition-colors',
                              regRole === r
                                ? 'border-teal-500 bg-teal-500/10 text-teal-600 dark:text-teal-400'
                                : 'border-border bg-card text-muted-foreground hover:bg-muted',
                            )}
                          >
                            {r === 'DOCTOR' ? (
                              <Shield className="h-3.5 w-3.5" />
                            ) : (
                              <UserRound className="h-3.5 w-3.5" />
                            )}
                            {r === 'DOCTOR' ? 'طبيب' : 'مريض'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Button
                      type="submit"
                      disabled={regBusy}
                      className="mt-1 h-10 gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      {regBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserPlus className="h-4 w-4" />
                      )}
                      إنشاء حساب
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

/** One-click demo-account quick-login chips. */
function DemoQuickLogin({
  onPick,
  busy,
}: {
  onPick: (email: string, password: string) => void
  busy: boolean
}) {
  return (
    <div className="mt-5 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-border/60" />
        <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
          حسابات تجريبية
        </span>
        <div className="h-px flex-1 bg-border/60" />
      </div>
      <div className="flex flex-col gap-1.5">
        {DEMO_ACCOUNTS.map((acc) => {
          const Icon = acc.icon
          return (
            <button
              key={acc.email}
              type="button"
              disabled={busy}
              onClick={() => onPick(acc.email, acc.password)}
              className="group flex h-9 items-center gap-2 rounded-md border border-border/60 bg-card/60 px-3 text-xs transition-colors hover:border-teal-500/50 hover:bg-teal-500/5 disabled:opacity-50"
            >
              <Icon className={cn('h-3.5 w-3.5', acc.accent)} />
              <span className="font-medium text-foreground">{acc.label}</span>
              <span className="ml-auto text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                اضغط ←
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * NeuronMark — inline SVG logo for the brand panel. All geometry is integer
 * literals (deterministic across SSR + client) to avoid hydration mismatch.
 */
function NeuronMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="Nuhoud neuron-joint mark"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="2" opacity="0.25" />
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
      <circle cx="32" cy="32" r="6" fill="currentColor" />
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

// End of AuthScreen.

