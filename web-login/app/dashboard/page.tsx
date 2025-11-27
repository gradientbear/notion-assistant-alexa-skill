'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FaCheckCircle, FaTimesCircle } from 'react-icons/fa'

interface User {
  email: string
  notion_token: string | null
  notion_setup_complete: boolean
  amazon_account_id: string | null
  license_key: string | null
  onboarding_complete: boolean
}

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)

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

      // If onboarding not complete, redirect
      if (!userData.onboarding_complete) {
        router.push('/onboarding')
        return
      }

      setLoading(false)
    } catch (error) {
      console.error('Error checking user:', error)
      router.push('/?mode=signin')
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/?mode=signin')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-1">Welcome back, {user?.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
            >
              Sign Out
            </button>
          </div>

          {/* Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="border-2 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                {user?.notion_setup_complete ? (
                  <FaCheckCircle className="text-green-500" />
                ) : (
                  <FaTimesCircle className="text-red-500" />
                )}
                <h3 className="font-semibold text-gray-900">Notion</h3>
              </div>
              <p className="text-sm text-gray-600">
                {user?.notion_setup_complete ? 'Connected' : 'Not Connected'}
              </p>
            </div>

            <div className="border-2 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                {user?.amazon_account_id ? (
                  <FaCheckCircle className="text-green-500" />
                ) : (
                  <FaTimesCircle className="text-red-500" />
                )}
                <h3 className="font-semibold text-gray-900">Amazon</h3>
              </div>
              <p className="text-sm text-gray-600">
                {user?.amazon_account_id ? 'Linked' : 'Not Linked'}
              </p>
            </div>

            <div className="border-2 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                {user?.license_key ? (
                  <FaCheckCircle className="text-green-500" />
                ) : (
                  <FaTimesCircle className="text-red-500" />
                )}
                <h3 className="font-semibold text-gray-900">License</h3>
              </div>
              <p className="text-sm text-gray-600">
                {user?.license_key ? 'Active' : 'Not Activated'}
              </p>
            </div>
          </div>

          {/* Ready Status */}
          {user?.onboarding_complete && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <FaCheckCircle className="text-green-500 text-xl" />
                <h3 className="font-semibold text-green-900">All Set!</h3>
              </div>
              <p className="text-sm text-green-700">
                Your Notion Data Alexa skill is ready to use. Try saying: "Alexa, open Notion Data"
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

