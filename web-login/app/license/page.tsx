'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LicensePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [licenseKey, setLicenseKey] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      
      if (!authUser) {
        router.push('/?mode=signin')
        return
      }

      const response = await fetch('/api/users/me', {
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch user')
      }

      const userData = await response.json()
      setUser(userData)

      // If already has license, redirect
      if (userData.license_key) {
        router.push('/dashboard')
        return
      }

      setLoading(false)
    } catch (error) {
      console.error('Error checking user:', error)
      router.push('/?mode=signin')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setSubmitting(true)

    try {
      if (!licenseKey.trim()) {
        throw new Error('Please enter a license key')
      }

      // Validate license key
      const validateResponse = await fetch('/api/validate-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: licenseKey.trim() }),
      })

      if (!validateResponse.ok) {
        const errorData = await validateResponse.json()
        throw new Error(errorData.error || 'Invalid license key')
      }

      // Update user with license key
      const updateResponse = await fetch('/api/users/update-license', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ license_key: licenseKey.trim() }),
      })

      if (!updateResponse.ok) {
        throw new Error('Failed to update license key')
      }

      setMessage('License key activated successfully!')
      
      // Mark onboarding as complete
      await fetch('/api/users/complete-onboarding', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      })

      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Enter License Key</h1>
        <p className="text-gray-600 mb-6">
          Enter your license key to activate the Notion Data Alexa skill.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="licenseKey" className="block text-sm font-medium text-gray-700 mb-1">
              License Key
            </label>
            <input
              id="licenseKey"
              type="text"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              required
              placeholder="Enter your license key"
              disabled={submitting}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition disabled:bg-gray-100"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 transition disabled:opacity-50"
          >
            {submitting ? 'Activating...' : 'Activate License'}
          </button>
        </form>

        <p className="mt-4 text-sm text-gray-500 text-center">
          Don't have a license key? Contact support to get one.
        </p>
      </div>
    </div>
  )
}

