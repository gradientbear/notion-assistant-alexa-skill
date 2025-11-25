'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import styles from './page.module.css'

function HomeContent() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [licenseKey, setLicenseKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [amazonAccountId, setAmazonAccountId] = useState<string | null>(null)
  const [isRetry, setIsRetry] = useState(false)

  useEffect(() => {
    // Check for error in URL params
    const errorParam = searchParams.get('error')
    if (errorParam) {
      setError(decodeURIComponent(errorParam))
    }

    // Check for Amazon account ID (from Alexa account linking)
    const amazonId = searchParams.get('amazon_account_id')
    if (amazonId) {
      setAmazonAccountId(amazonId)
    }

    // Check if this is a retry (user previously denied Notion)
    const denied = searchParams.get('denied')
    if (denied === 'true') {
      setIsRetry(true)
      setError('Notion connection was denied. You can retry the connection below.')
    }
  }, [searchParams])

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

      // If coming from Alexa, use GET endpoint with query params
      if (amazonAccountId) {
        const params = new URLSearchParams({
          amazon_account_id: amazonAccountId,
          email,
          license_key: licenseKey,
        })
        window.location.href = `/api/oauth/initiate?${params.toString()}`
        return
      }

      // Regular web flow - use POST endpoint
      const oauthResponse = await fetch('/api/oauth/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, licenseKey, amazon_account_id: amazonAccountId }),
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
        <h1 className={styles.title}>Notion Data</h1>
        <p className={styles.subtitle}>
          {isRetry 
            ? 'Complete your Notion connection to use the Alexa skill'
            : amazonAccountId
            ? 'Link your Notion account to complete Alexa skill setup'
            : 'Link your Notion account to get started'}
        </p>

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

            {isRetry && (
              <div className={styles.info}>
                <p>You previously denied Notion access. Please complete the connection to use all features of the skill.</p>
              </div>
            )}

            <button
              type="submit"
              className={styles.button}
              disabled={loading}
            >
              {loading ? 'Processing...' : isRetry ? 'Retry Notion Connection' : 'Link Notion Account'}
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

export default function Home() {
  return (
    <Suspense fallback={<div className={styles.container}><div className={styles.card}>Loading...</div></div>}>
      <HomeContent />
    </Suspense>
  )
}

