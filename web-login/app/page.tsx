'use client'

import { useState } from 'react'
import styles from './page.module.css'

export default function Home() {
  const [email, setEmail] = useState('')
  const [licenseKey, setLicenseKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      // Validate license key first
      const validateResponse = await fetch('/api/validate-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, licenseKey }),
      })

      if (!validateResponse.ok) {
        const errorData = await validateResponse.json()
        throw new Error(errorData.error || 'License validation failed')
      }

      // Initiate Notion OAuth flow
      const oauthResponse = await fetch('/api/oauth/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, licenseKey }),
      })

      if (!oauthResponse.ok) {
        const errorData = await oauthResponse.json()
        throw new Error(errorData.error || 'OAuth initiation failed')
      }

      const { authUrl } = await oauthResponse.json()
      
      // Redirect to Notion OAuth
      window.location.href = authUrl
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Notion Assistant</h1>
        <p className={styles.subtitle}>Link your Notion account to get started</p>

        {success ? (
          <div className={styles.success}>
            <p>Account linked successfully! You can now use the Alexa skill.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
                disabled={loading}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="licenseKey">License Key</label>
              <input
                id="licenseKey"
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                required
                placeholder="Enter your license key"
                disabled={loading}
              />
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <button
              type="submit"
              className={styles.button}
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Link Notion Account'}
            </button>
          </form>
        )}

        <div className={styles.footer}>
          <p>Need help? Contact support</p>
        </div>
      </div>
    </div>
  )
}

