import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
// import { Toaster } from '@/components/ui/toaster'
// import { AuthProvider } from '@/components/providers/auth-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Tyro Study - ReImagined Learning',
  description: 'Structured studying with AI-powered quizzes and flashcards',
  manifest: '/manifest.json',
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
  themeColor: '#000000'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* <AuthProvider> */}
        {children}
        {/* <Toaster />
        </AuthProvider> */}
      </body>
    </html>
  )
}