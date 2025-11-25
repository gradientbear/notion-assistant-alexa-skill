'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import styles from '../page.module.css'

function ErrorContent() {
  const searchParams = useSearchParams()
  const message = searchParams.get('message') || 'An error occurred'
  const denied = searchParams.get('denied') === 'true'

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>{denied ? 'Connection Denied' : 'Error'}</h1>
        <div className={styles.error}>
          {message}
        </div>
        {denied && (
          <div className={styles.info} style={{ marginTop: '16px' }}>
            <p>You can retry connecting your Notion account later. Some features of the skill may be limited without Notion access.</p>
          </div>
        )}
        <div style={{ marginTop: '24px' }}>
          <a href="/" className={styles.button} style={{ textDecoration: 'none', display: 'inline-block' }}>
            {denied ? 'Retry Connection' : 'Try Again'}
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

