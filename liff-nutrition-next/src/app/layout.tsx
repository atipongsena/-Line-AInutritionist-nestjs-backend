import type { Metadata, Viewport } from 'next'
import { ReactNode, Suspense } from 'react'
import { Providers } from './providers'
import './globals.css'
import Script from 'next/script'
import { WebVitals } from '../components/WebVitals'

// Metadata configuration for mobile-first LIFF app
export const metadata: Metadata = {
  title: 'Nutrition Report - LINE LIFF App',
  description: 'รายงานโภชนาการอาหารผ่าน LINE',
  keywords: ['nutrition', 'food log', 'LINE', 'LIFF', 'health', 'diet'],
  authors: [{ name: 'AI Nutritionist Team' }],
  robots: 'noindex, nofollow', // LIFF apps shouldn't be indexed
  icons: {
    icon: '/favicon.ico',
    apple: '/favicon.ico',
  },
  manifest: '/manifest.json',
  openGraph: {
    title: 'Nutrition Report - LINE LIFF App',
    description: 'รายงานโภชนาการอาหารผ่าน LINE',
    type: 'website',
    locale: 'th_TH',
  },
}

// Viewport configuration for mobile optimization
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#06C755', // LINE Green
}

interface RootLayoutProps {
  children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        {/* Preconnect for faster external resources */}
        <link rel="preconnect" href="https://static.line-scdn.net" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://api.line.me" />

        {/* Performance hints */}
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body>
        {/* Performance monitoring */}
        <WebVitals />

        <Suspense
          fallback={
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                fontSize: '18px',
                color: '#06C755',
              }}
            >
              กำลังโหลด...
            </div>
          }
        >
          <Providers>{children}</Providers>
        </Suspense>

        {/* LIFF SDK with optimized loading */}
        <Script
          src="https://static.line-scdn.net/liff/edge/2/sdk.js"
          strategy="afterInteractive"
          charSet="utf-8"
          id="liff-sdk"
        />
      </body>
    </html>
  )
}
