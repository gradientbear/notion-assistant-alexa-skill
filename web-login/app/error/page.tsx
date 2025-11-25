'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import styles from '../page.module.css'

function ErrorContent() {
  const searchParams = useSearchParams()
  const message = searchParams.get('message') || 'An error occurred'

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Error</h1>
        <div className={styles.error}>
          {message}
        </div>
        <div style={{ marginTop: '24px' }}>
          <a href="/" className={styles.button} style={{ textDecoration: 'none', display: 'inline-block' }}>
            Try Again
          </a>
        </div>
      </div>
    </div>
  )
}

export default function ErrorPage() {
  return (
    <Suspense fallback={
      <div className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.title}>Loading...</h1>
        </div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  )
}

