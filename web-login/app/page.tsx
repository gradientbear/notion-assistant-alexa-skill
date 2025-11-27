'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { FaGoogle, FaMicrosoft, FaApple } from 'react-icons/fa'

type AuthMode = 'signin' | 'signup'

function AuthContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const modeParam = searchParams.get('mode')
    if (modeParam === 'signup' || modeParam === 'signin') {
      setMode(modeParam)
    }

    // Check if user is already logged in
    checkSession()
  }, [searchParams])

  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      router.push('/onboarding')
    }
  }

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const validatePassword = (password: string) => {
    // At least 8 chars, 1 uppercase, 1 lowercase, 1 number
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      if (!validateEmail(email)) {
        throw new Error('Please enter a valid email address')
      }

      if (mode === 'signup') {
        if (!validatePassword(password)) {
          throw new Error('Password must be at least 8 characters with uppercase, lowercase, and number')
        }
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match')
        }

        // Sign up
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })

        if (error) throw error

        if (data.user) {
          // Sync to custom users table
          await syncUserToDatabase(data.user.id, email, 'email')
          
          setMessage('Check your email to verify your account!')
          setTimeout(() => {
            setMode('signin')
            setEmail('')
            setPassword('')
            setConfirmPassword('')
          }, 3000)
        }
      } else {
        // Sign in
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error

        if (data.user) {
          // Check if email is verified
          if (!data.user.email_confirmed_at) {
            throw new Error('Please verify your email before signing in. Check your inbox.')
          }

          // Sync user and redirect to onboarding
          await syncUserToDatabase(data.user.id, email, 'email')
          router.push('/onboarding')
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleSocialAuth = async (provider: 'google' | 'azure' | 'apple') => {
    setLoading(true)
    setError('')

    try {
      // Check if Supabase is properly configured
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
        throw new Error('Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL environment variable.')
      }
      
      // Validate URL format
      if (supabaseUrl.includes('supabase.com/dashboard') || supabaseUrl.includes('dashboard/project')) {
        throw new Error(
          'Invalid Supabase URL! You\'re using the dashboard URL instead of the API URL. ' +
          'Go to Supabase → Settings → API and copy the "Project URL" (format: https://[project].supabase.co). ' +
          'Update NEXT_PUBLIC_SUPABASE_URL in Vercel and redeploy.'
        )
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) throw error
    } catch (err: any) {
      setError(err.message || 'OAuth sign-in failed. Please check your environment variables are set correctly.')
      setLoading(false)
    }
  }

  const syncUserToDatabase = async (authUserId: string, email: string, provider: string) => {
    try {
      const response = await fetch('/api/auth/sync-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth_user_id: authUserId, email, provider }),
      })

      if (!response.ok) {
        console.error('Failed to sync user to database')
      }
    } catch (err) {
      console.error('Error syncing user:', err)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Notion Data</h1>
            <p className="text-gray-600">Alexa Skill Authentication</p>
          </div>

          {/* Tabs */}
          <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => {
                setMode('signin')
                setError('')
                setMessage('')
              }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                mode === 'signin'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setMode('signup')
                setError('')
                setMessage('')
              }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                mode === 'signup'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Messages */}
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

          {/* Social Login Buttons */}
          <div className="space-y-3 mb-6">
            <button
              onClick={() => handleSocialAuth('google')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border-2 border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaGoogle className="text-red-500 text-xl" />
              Continue with Google
            </button>

            <button
              onClick={() => handleSocialAuth('azure')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border-2 border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaMicrosoft className="text-blue-500 text-xl" />
              Continue with Microsoft
            </button>

            <button
              onClick={() => handleSocialAuth('apple')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border-2 border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaApple className="text-gray-900 text-xl" />
              Continue with Apple
            </button>
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with email</span>
            </div>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
                disabled={loading}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition disabled:bg-gray-100"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder={mode === 'signup' ? 'Min. 8 chars, 1 uppercase, 1 number' : 'Enter your password'}
                disabled={loading}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition disabled:bg-gray-100"
              />
            </div>

            {mode === 'signup' && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Confirm your password"
                  disabled={loading}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition disabled:bg-gray-100"
                />
              </div>
            )}

            {mode === 'signin' && (
              <div className="flex justify-end">
                <a
                  href="/auth/forgot-password"
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Forgot Password?
                </a>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : mode === 'signup' ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center text-sm text-gray-600">
            {mode === 'signin' ? (
              <p>
                Don't have an account?{' '}
                <button
                  onClick={() => setMode('signup')}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Sign up
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button
                  onClick={() => setMode('signin')}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    }>
      <AuthContent />
    </Suspense>
  )
}
