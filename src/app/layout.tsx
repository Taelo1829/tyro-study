import type { Metadata, Viewport } from 'next'
import { Urbanist } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { AuthProvider } from '@/components/providers/auth-provider'
import { ApiLoader } from '@/components/ui/api-loader'
import { ADSENSE_CLIENT, SITE_NAME, siteUrl } from '@/lib/site'

const urbanist = Urbanist({
  subsets: ['latin'],
  variable: '--font-urbanist',
  display: 'swap',
})

export const metadata: Metadata = {
  // The real address (www.tyrostudy.co.za), so canonical links and social
  // previews never point at the old .vercel.app address
  metadataBase: new URL(siteUrl()),
  title: 'Tyro Study - ReImagined Learning',
  description: 'Structured studying with quizzes and flashcards',
  manifest: '/manifest.json',
  other: { "google-adsense-account": ADSENSE_CLIENT },
  applicationName: SITE_NAME,
  openGraph: { siteName: SITE_NAME, type: 'website', locale: 'en_ZA' },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Tyro Study'
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#ffffff'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={urbanist.variable}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        {/* Tells Google the site's name, so results show "Tyro Study" */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: SITE_NAME,
              alternateName: ['TyroStudy', 'Tyro'],
              url: `${siteUrl()}/`,
            }),
          }}
        />
      </head>
      <body className={`${urbanist.className} bg-background text-foreground`}>
        <ApiLoader />
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  )
}
