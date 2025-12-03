'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function AmazonLinkContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [linking, setLinking] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [amazonAccountId, setAmazonAccountId] = useState<string | null>(null)

  useEffect(() => {
    checkUser()
    
    // Check if coming from Alexa with amazon_account_id
    const amazonId = searchParams.get('amazon_account_id')
    if (amazonId) {
      setAmazonAccountId(amazonId)
      handleLinkAmazon(amazonId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

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

      // If already linked, redirect
      if (userData.amazon_account_id) {
        router.push('/onboarding')
        return
      }

      setLoading(false)
    } catch (error) {
      console.error('Error checking user:', error)
      router.push('/?mode=signin')
    }
  }

  const handleLinkAmazon = async (accountId?: string) => {
    setLinking(true)
    try {
      const accountIdToLink = accountId || amazonAccountId
      
      if (!accountIdToLink) {
        // For testing: Allow manual entry or use a test account ID
        // In production, this would come from Alexa OAuth
        const testAccountId = prompt('Enter your Amazon Account ID (for testing) or leave empty to skip:')
        if (!testAccountId || testAccountId.trim() === '') {
          setLinking(false)
          return
        }
        
        // Use the entered account ID
        const session = await supabase.auth.getSession()
        const token = session.data.session?.access_token
        
        const response = await fetch('/api/users/link-amazon', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ amazon_account_id: testAccountId.trim() }),
        })

        if (!response.ok) {
          throw new Error('Failed to link Amazon account')
        }

        // Redirect to next step
        router.push('/onboarding')
        return
      }

      // Update user with amazon_account_id
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token
      
      const response = await fetch('/api/users/link-amazon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ amazon_account_id: accountIdToLink }),
      })

      if (!response.ok) {
        throw new Error('Failed to link Amazon account')
      }

      // Redirect to next step
      router.push('/onboarding')
    } catch (error) {
      console.error('Error linking Amazon account:', error)
      alert('Failed to link Amazon account. Please try again.')
      setLinking(false)
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
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Link Amazon Account</h1>
        <p className="text-gray-600 mb-6">
          To use the Alexa skill, you need to link your Amazon account. This allows the skill to identify you.
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800 font-medium mb-2">How to link:</p>
          <ol className="list-decimal list-inside text-sm text-blue-700 space-y-1">
            <li>Open the Alexa app on your phone</li>
            <li>Search for "Voice Planner" skill</li>
            <li>Click "Enable" or "Link Account"</li>
            <li>You'll be redirected back here automatically</li>
          </ol>
        </div>

        <button
          onClick={() => handleLinkAmazon()}
          disabled={linking}
          className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 transition disabled:opacity-50"
        >
          {linking ? 'Linking...' : 'Link Amazon Account (Test Mode)'}
        </button>
        
        <p className="text-xs text-gray-500 mt-2 text-center">
          For testing: Click the button above and enter your Amazon Account ID when prompted.
          <br />
          You can get this from the Alexa Developer Console Simulator.
        </p>

        <button
          onClick={() => router.push('/onboarding')}
          className="w-full mt-3 py-2 text-gray-600 hover:text-gray-800 font-medium"
        >
          Skip for now
        </button>
      </div>
    </div>
  )
}

export default function AmazonLinkPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-gray-600">Loading...</div>
      </div>
    }>
      <AmazonLinkContent />
    </Suspense>
  )
}

