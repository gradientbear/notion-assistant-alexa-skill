'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FaCheckCircle, FaCircle, FaSpinner } from 'react-icons/fa'

type OnboardingStep = 'amazon' | 'notion' | 'license' | 'complete'

interface User {
  id: string
  auth_user_id: string | null
  email: string
  notion_token: string | null
  notion_setup_complete: boolean
  amazon_account_id: string | null
  license_key: string | null
  onboarding_complete: boolean
}

export default function OnboardingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('notion')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string>('')
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    let mounted = true
    checkUser()
    
    // Check if coming back from Notion OAuth
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('notion_connected') === 'true') {
      setMessage('Notion connected successfully! Notion Data page and databases created.')
      // Remove the query parameter
      window.history.replaceState({}, '', '/onboarding')
    }
    
    return () => {
      mounted = false
    }
  }, [])

  const checkUser = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      
      if (!authUser) {
        router.push('/?mode=signin')
        return
      }

      // Get user from database
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token
      
      if (!token) {
        router.push('/?mode=signin')
        return
      }

      // Sync user first (in case they don't exist in database yet)
      try {
        const syncResponse = await fetch('/api/auth/sync-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            auth_user_id: authUser.id,
            email: authUser.email || '',
            provider: authUser.app_metadata?.provider || 'email',
          }),
        })
        
        if (!syncResponse.ok) {
          console.warn('Sync user response not OK:', syncResponse.status)
        }
      } catch (syncError) {
        console.warn('Sync attempt failed (may already exist):', syncError)
      }

      // Wait a moment for sync to complete
      await new Promise(resolve => setTimeout(resolve, 500))

      const response = await fetch('/api/users/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      })

      if (!response.ok) {
        if (response.status === 404) {
          // Route not found or user not found - try one more sync
          console.log('User not found, attempting final sync...')
          
          await fetch('/api/auth/sync-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              auth_user_id: authUser.id,
              email: authUser.email || '',
              provider: authUser.app_metadata?.provider || 'email',
            }),
          })
          
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          const retryResponse = await fetch('/api/users/me', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            cache: 'no-store',
          })
          
          if (!retryResponse.ok) {
            console.error('User still not found after sync. Status:', retryResponse.status)
            setError('Unable to load user data. Please try refreshing the page.')
            setLoading(false)
            return
          }
          
          const userData = await retryResponse.json()
          setUser(userData)
          setLoading(false)
          return
        }
        
        console.error('Failed to fetch user:', response.status, response.statusText)
        setError(`Failed to load user: ${response.status}`)
        setLoading(false)
        return
      }

      const userData = await response.json()
      setUser(userData)

      // Determine current step - Notion first (optional), then Amazon (MVP: no license required)
      if (userData.onboarding_complete) {
        router.push('/dashboard')
        return
      } else if (!userData.notion_token) {
        setCurrentStep('notion')
      } else if (!userData.amazon_account_id) {
        setCurrentStep('amazon')
      } else {
        // All required steps complete - auto-complete onboarding
        setCurrentStep('complete')
        // Mark onboarding as complete in database
        try {
          const session = await supabase.auth.getSession()
          const token = session.data.session?.access_token
          if (token) {
            await fetch('/api/users/complete-onboarding', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            })
          }
        } catch (err) {
          console.warn('Failed to auto-complete onboarding:', err)
        }
      }

      setLoading(false)
    } catch (error) {
      console.error('Error checking user:', error)
      setLoading(false)
      // Don't redirect immediately - let user see the error or retry
    }
  }

  const handleNotionConnect = async () => {
    setProcessing(true)
    try {
      // Get the actual auth_user_id from Supabase Auth
      const { data: { user: authUser } } = await supabase.auth.getUser()
      
      if (!authUser) {
        setError('Please sign in to connect Notion')
        setProcessing(false)
        return
      }

      const response = await fetch('/api/oauth/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: user?.email || authUser.email,
          auth_user_id: authUser.id // Use Supabase Auth user ID
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to initiate Notion connection')
      }

      const { authUrl } = await response.json()
      window.location.href = authUrl
    } catch (error: any) {
      console.error('Error initiating Notion OAuth:', error)
      setError(error.message || 'Failed to connect Notion. Please try again.')
      setProcessing(false)
    }
  }

  const handleAmazonLink = async () => {
    setProcessing(true)
    // Redirect to Amazon linking page
    router.push('/amazon/link')
  }

  // License step removed for MVP

  const handleSkipNotion = async () => {
    // Allow user to skip Notion connection and proceed to next step
    if (!user?.amazon_account_id) {
      setCurrentStep('amazon')
    } else {
      // All steps complete
      setCurrentStep('complete')
    }
  }

  const steps = [
    {
      id: 'notion' as OnboardingStep,
      title: 'Connect Notion (Optional)',
      description: 'Link your Notion workspace and we\'ll automatically create the required databases. You can skip this and connect later.',
      completed: !!user?.notion_token && user?.notion_setup_complete,
      action: handleNotionConnect,
      skippable: true,
    },
    {
      id: 'amazon' as OnboardingStep,
      title: 'Link Amazon Account',
      description: 'Connect your Amazon account to enable the Alexa skill',
      completed: !!user?.amazon_account_id,
      action: handleAmazonLink,
    },
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-gray-600">
          <FaSpinner className="animate-spin text-4xl mx-auto mb-4" />
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Notion Data</h1>
          <p className="text-gray-600 mb-8">Complete these steps to get started</p>

          {/* Success Message */}
          {message && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
              <p className="font-medium mb-2">Success!</p>
              <p className="text-sm">{message}</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              <p className="font-medium mb-2">Error</p>
              <p className="text-sm mb-3">{error}</p>
              <button
                onClick={() => {
                  setError('')
                  setLoading(true)
                  checkUser()
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
              >
                Retry
              </button>
            </div>
          )}

          {/* Progress Steps */}
          <div className="space-y-6 mb-8">
            {steps.map((step, index) => {
              const isCurrent = currentStep === step.id
              const isCompleted = step.completed
              const isDisabled = !isCurrent && !isCompleted

              return (
                <div
                  key={step.id}
                  className={`border-2 rounded-lg p-6 transition-all ${
                    isCurrent
                      ? 'border-blue-500 bg-blue-50'
                      : isCompleted
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 mt-1">
                      {isCompleted ? (
                        <FaCheckCircle className="text-green-500 text-2xl" />
                      ) : isCurrent ? (
                        <FaCircle className="text-blue-500 text-2xl" />
                      ) : (
                        <FaCircle className="text-gray-300 text-2xl" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 mb-1">
                        {index + 1}. {step.title}
                      </h3>
                      <p className="text-gray-600 mb-4">{step.description}</p>
                      
                      {isCurrent && !isCompleted && (
                        <div className="flex flex-col sm:flex-row gap-3">
                          {step.id === 'notion' && (
                            <>
                              <a
                                href="https://www.notion.so/signup"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-6 py-2 bg-white border-2 border-blue-600 text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition text-center"
                              >
                                Create Notion Account
                              </a>
                              <button
                                onClick={step.action}
                                disabled={processing}
                                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 transition disabled:opacity-50"
                              >
                                {processing ? 'Processing...' : 'Connect Notion'}
                              </button>
                              <button
                                onClick={handleSkipNotion}
                                disabled={processing}
                                className="px-6 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition disabled:opacity-50"
                              >
                                Skip for Now
                              </button>
                            </>
                          )}
                          {step.id !== 'notion' && (
                            <button
                              onClick={step.action}
                              disabled={processing}
                              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 transition disabled:opacity-50"
                            >
                              {processing ? 'Processing...' : `Start ${step.title}`}
                            </button>
                          )}
                        </div>
                      )}
                      
                      {isCompleted && (
                        <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                          Completed
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Additional Info */}
          {currentStep === 'notion' && (
            <div className="space-y-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800 mb-2">
                  <strong>Don't have a Notion account?</strong>
                </p>
                <p className="text-sm text-blue-700 mb-3">
                  Notion is free to use. Click "Create Notion Account" above to sign up, then come back to connect your workspace.
                </p>
                <p className="text-sm text-blue-700">
                  You can also skip this step and connect Notion later from your dashboard.
                </p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  <strong>What we'll create in your Notion workspace:</strong>
                </p>
                <ul className="list-disc list-inside text-sm text-green-700 mt-2 space-y-1">
                  <li>A "Notion Data" page in your Notion workspace</li>
                  <li>Tasks database for task management</li>
                  <li>Focus_Logs database for focus tracking</li>
                  <li>Energy_Logs database for energy tracking</li>
                </ul>
              </div>
            </div>
          )}
          {currentStep === 'amazon' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800">
                <strong>Why link your Amazon account?</strong>
              </p>
              <ul className="list-disc list-inside text-sm text-blue-700 mt-2 space-y-1">
                <li>Enables the Alexa skill to identify you</li>
                <li>Required for using the skill on your Alexa devices</li>
                <li>Links your web account to your Alexa account</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

