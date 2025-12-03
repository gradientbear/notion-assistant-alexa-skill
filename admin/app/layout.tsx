import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Voice Planner - Admin Panel',
  description: 'License key management for Voice Planner',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

