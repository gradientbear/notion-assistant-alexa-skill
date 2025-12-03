import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Voice Planner - Account Linking',
  description: 'Link your Notion account to Alexa Skill',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}

