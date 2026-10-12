import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/neuromove/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NeuroMove — Post-Stroke Upper-Limb Rehab",
  description:
    "NeuroMove is a digital therapeutic platform for post-stroke upper-limb rehabilitation. Real-time AI pose tracking, biomechanics feedback, and gamified rehab exercises. Built for سلطنة عُمان.",
  keywords: [
    "NeuroMove",
    "stroke rehabilitation",
    "upper-limb rehab",
    "MediaPipe Pose",
    "biomechanics",
    "Oman",
    "digital therapeutic",
  ],
  authors: [{ name: "NeuroMove Team" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "NeuroMove",
    description: "Post-stroke upper-limb rehabilitation · Real-time AI",
    siteName: "NeuroMove",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NeuroMove",
    description: "Post-stroke upper-limb rehabilitation · Real-time AI",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <SonnerToaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
