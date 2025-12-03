'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import styles from '../page.module.css'

function ErrorContent() {
  const searchParams = useSearchParams()
  const message = searchParams.get('message') || 'An error occurred'
  const denied = searchParams.get('denied') === 'true'
  const noAccount = searchParams.get('no_account') === 'true'
  const signupUrl = searchParams.get('signup_url') || 'https://www.notion.so/signup'

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>
          {noAccount ? 'Notion Account Required' : denied ? 'Connection Denied' : 'Error'}
        </h1>
        <div className={styles.error}>
          {message}
        </div>
        {noAccount && (
          <>
            <div className={styles.info} style={{ marginTop: '16px' }}>
              <p><strong>Don't have a Notion account?</strong></p>
              <p style={{ marginTop: '8px', fontSize: '14px' }}>
                Notion is free to use. Create an account to connect your workspace and enable the Alexa skill.
              </p>
              <p style={{ marginTop: '12px', fontSize: '14px' }}>
                After creating your account, come back and try connecting again. We'll automatically create:
              </p>
              <ul style={{ 
                marginTop: '8px', 
                marginLeft: '20px', 
                fontSize: '14px',
                textAlign: 'left',
                display: 'inline-block'
              }}>
                <li>A "Voice Planner" page in your workspace</li>
                <li>Tasks, Focus_Logs, and Energy_Logs databases</li>
              </ul>
            </div>
            <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <a 
                href={signupUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className={styles.button} 
                style={{ textDecoration: 'none', display: 'inline-block', backgroundColor: '#000', color: '#fff' }}
              >
                Create Notion Account
              </a>
              <a href="/onboarding" className={styles.button} style={{ textDecoration: 'none', display: 'inline-block' }}>
                Back to Onboarding
              </a>
            </div>
          </>
        )}
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
                <li>A "Voice Planner" page in your workspace</li>
                <li>Tasks, Focus_Logs, and Energy_Logs databases</li>
              </ul>
            </div>
            <div style={{ marginTop: '24px' }}>
              <a href="/onboarding" className={styles.button} style={{ textDecoration: 'none', display: 'inline-block' }}>
                Retry Connection
              </a>
            </div>
          </>
        )}
        {!denied && !noAccount && (
          <div style={{ marginTop: '24px' }}>
            <a href="/onboarding" className={styles.button} style={{ textDecoration: 'none', display: 'inline-block' }}>
              Back to Onboarding
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

