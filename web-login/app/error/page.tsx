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
          <>
            <div className={styles.info} style={{ marginTop: '16px' }}>
              <p><strong>What happens next?</strong></p>
              <p style={{ marginTop: '8px', fontSize: '14px' }}>
                Your account has been registered, but Notion connection is incomplete. 
                You can retry connecting your Notion account at any time.
              </p>
              <p style={{ marginTop: '12px', fontSize: '14px' }}>
                When you connect, we'll automatically create:
              </p>
              <ul style={{ 
                marginTop: '8px', 
                marginLeft: '20px', 
                fontSize: '14px',
                textAlign: 'left',
                display: 'inline-block'
              }}>
                <li>A "Privacy" page in your workspace</li>
                <li>Tasks, Focus_Logs, and Energy_Logs databases</li>
              </ul>
            </div>
            <div style={{ marginTop: '24px' }}>
              <a href="/" className={styles.button} style={{ textDecoration: 'none', display: 'inline-block' }}>
                Retry Connection
              </a>
            </div>
          </>
        )}
        {!denied && (
          <div style={{ marginTop: '24px' }}>
            <a href="/" className={styles.button} style={{ textDecoration: 'none', display: 'inline-block' }}>
              Try Again
            </a>
          </div>
        )}
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

