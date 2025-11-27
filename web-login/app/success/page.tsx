'use client'

import { Suspense } from 'react'
import styles from '../page.module.css'

function SuccessContent() {
  // Token is now stored in database during callback, no need to check URL parameter

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Success!</h1>
        <p className={styles.subtitle}>
          Your Notion account has been linked successfully.
        </p>
        <div className={styles.success}>
          <p><strong>✓ Notion workspace configured</strong></p>
          <p style={{ marginTop: '12px', fontSize: '14px' }}>
            We've automatically created:
          </p>
          <ul style={{ 
            marginTop: '8px', 
            marginLeft: '20px', 
            fontSize: '14px',
            textAlign: 'left',
            display: 'inline-block'
          }}>
            <li>A "Privacy" page in your workspace</li>
            <li>Tasks database for task management</li>
            <li>Focus_Logs database for focus tracking</li>
            <li>Energy_Logs database for energy tracking</li>
          </ul>
          <p style={{ marginTop: '16px', fontSize: '14px', color: '#666' }}>
            You can now use the Notion Data Alexa skill. Try: "Alexa, open Notion Data"
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

