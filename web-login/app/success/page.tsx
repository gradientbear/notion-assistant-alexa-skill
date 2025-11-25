'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import styles from '../page.module.css'

function SuccessContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setError('No token received')
      return
    }

    // In a real implementation, you would:
    // 1. Store the token securely
    // 2. Associate it with the user's Amazon account
    // 3. Complete the Alexa account linking flow
    
    // For now, show success message
  }, [token])

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Success!</h1>
        <p className={styles.subtitle}>
          Your Notion account has been linked successfully.
        </p>
        <div className={styles.success}>
          <p>You can now use the Notion Assistant Alexa skill.</p>
          <p style={{ marginTop: '16px', fontSize: '14px', color: '#666' }}>
            Go back to your Alexa app and try: "Alexa, open Notion Assistant"
          </p>
        </div>
      </div>
    </div>
  )
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.title}>Loading...</h1>
        </div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}

