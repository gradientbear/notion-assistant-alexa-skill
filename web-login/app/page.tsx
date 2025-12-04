'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Header } from './components/Header';
import { SocialButtons } from './components/SocialButtons';
import { Button } from './components/Button';
import { Card } from './components/Card';

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    // Check if there's a tab parameter in URL
    const tab = searchParams.get('tab');
    if (tab === 'signup') {
      setActiveTab('signup');
    }
  }, [searchParams]);

  useEffect(() => {
    // Only check session once on mount, not on every searchParams change
    // This prevents redirect loops
    checkSession();
    
    // Safety timeout - if checking auth takes too long, show the form
    const timeout = setTimeout(() => {
      if (checkingAuth) {
        console.warn('[AuthPage] Session check timeout, showing auth form');
        setCheckingAuth(false);
      }
    }, 5000); // 5 second timeout
    
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run once

  const checkSession = async () => {
    try {
      console.log('[AuthPage] Checking session...');
      
      // First, get the session to check if it exists
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      // If no session at all, we're done - show auth form
      if (!session || sessionError) {
        console.log('[AuthPage] No session found, showing auth form');
        setCheckingAuth(false);
        return;
      }

      // Check if session is expired
      if (session.expires_at && session.expires_at < Date.now() / 1000) {
        console.log('[AuthPage] Session expired, clearing');
        await supabase.auth.signOut();
        setCheckingAuth(false);
        return;
      }

      // Now validate the session by getting the user (this makes a server call to validate)
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      // If there's an error getting the user, or no user, clear session and stay on auth page
      if (userError || !user) {
        console.log('[AuthPage] No valid user found, clearing session. Error:', userError?.message);
        await supabase.auth.signOut();
        setCheckingAuth(false);
        return;
      }

      // Double-check: verify the user has an email (basic validation)
      if (!user.email) {
        console.log('[AuthPage] User has no email, clearing session');
        await supabase.auth.signOut();
        setCheckingAuth(false);
        return;
      }

      // Only redirect if we have a valid user with email
      console.log('[AuthPage] Valid session found for user:', user.email, '- checking redirect');
      const redirect = searchParams.get('redirect');
      
      console.log('[AuthPage] Redirect check:', {
        hasRedirect: !!redirect,
        redirectUrl: redirect,
        currentPath: window.location.pathname,
        redirectIncludesPath: redirect?.includes(window.location.pathname),
      });
      
      // Prevent redirect loops - if redirect URL is the same as current page, just go to dashboard
      // But allow redirects to API endpoints (like /api/oauth/authorize)
      if (redirect && 
          redirect !== window.location.href && 
          !redirect.includes(window.location.pathname) &&
          (redirect.startsWith('/api/') || !redirect.startsWith(window.location.origin + window.location.pathname))) {
        console.log('[AuthPage] Redirecting to:', redirect);
        router.push(redirect);
      } else {
        console.log('[AuthPage] Redirecting to dashboard (no valid redirect or loop prevention)');
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('[AuthPage] Error checking session:', err);
      // Clear any invalid session on error
      try {
        await supabase.auth.signOut();
      } catch (signOutErr) {
        console.error('[AuthPage] Error signing out:', signOutErr);
      }
      setCheckingAuth(false);
    }
  };

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validatePassword = (password: string) => {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!validateEmail(email)) {
        throw new Error('Please enter a valid email address');
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        if (!data.user.email_confirmed_at) {
          throw new Error('Please verify your email before signing in. Check your inbox.');
        }

        await syncUserToDatabase(data.user.id, email, 'email');
        
        const redirect = searchParams.get('redirect');
        if (redirect) {
          router.push(redirect);
        } else {
          router.push('/dashboard');
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (!validateEmail(email)) {
        throw new Error('Please enter a valid email address');
      }

      if (!validatePassword(password)) {
        throw new Error('Password must be at least 8 characters with uppercase, lowercase, and number');
      }

      if (password !== confirmPassword) {
        throw new Error('Passwords do not match');
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;

      if (data.user) {
        try {
          // Sync user to database immediately (even if email not verified)
          await syncUserToDatabase(data.user.id, email, 'email');
          setMessage('Check your email to verify your account!');
        } catch (syncError: any) {
          console.error('[Signup] Error syncing user:', syncError);
          // Still show success message, user will be created on email verification
          setMessage('Check your email to verify your account! Your account will be fully activated after verification.');
        }
        setTimeout(() => {
          setActiveTab('login');
          setEmail('');
          setPassword('');
          setConfirmPassword('');
        }, 3000);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialAuth = async (provider: 'google' | 'azure' | 'apple') => {
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'OAuth sign-in failed');
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (!validateEmail(email)) {
        throw new Error('Please enter a valid email address');
      }

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;

      setMessage('Check your email for the magic link! Click the link to sign in.');
      setEmail('');
    } catch (err: any) {
      setError(err.message || 'Failed to send magic link');
    } finally {
      setLoading(false);
    }
  };

  const syncUserToDatabase = async (authUserId: string, email: string, provider: string) => {
    try {
      console.log('[syncUserToDatabase] Syncing user:', { authUserId, email, provider });
      const response = await fetch('/api/auth/sync-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth_user_id: authUserId, email, provider }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[syncUserToDatabase] Failed to sync user to database:', errorData);
        throw new Error(errorData.error || 'Failed to sync user');
      }

      const result = await response.json();
      console.log('[syncUserToDatabase] User synced successfully:', result);
      return result;
    } catch (err: any) {
      console.error('[syncUserToDatabase] Error syncing user:', err);
      throw err;
    }
  };

  // Show loading state while checking authentication
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header showAuth={false} />
        <div className="flex items-center justify-center px-4 py-12">
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header showAuth={false} />
      
      <div className="flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          {/* Tab Switcher */}
          <div className="flex border-b border-gray-200 mb-6">
            <button
              onClick={() => {
                setActiveTab('login');
                setError('');
                setMessage('');
              }}
              className={`flex-1 py-3 text-center font-medium transition-colors ${
                activeTab === 'login'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setActiveTab('signup');
                setError('');
                setMessage('');
              }}
              className={`flex-1 py-3 text-center font-medium transition-colors ${
                activeTab === 'signup'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Sign Up
            </button>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {activeTab === 'login' ? 'Welcome Back' : 'Create Account'}
            </h1>
            <p className="text-gray-600">
              {activeTab === 'login' 
                ? 'Sign in to your Voice Planner account' 
                : 'Get started with Voice Planner'}
            </p>
          </div>

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

          <SocialButtons
            onGoogleClick={() => handleSocialAuth('google')}
            onMicrosoftClick={() => handleSocialAuth('azure')}
            onAppleClick={() => handleSocialAuth('apple')}
            isLoading={loading}
          />

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with email</span>
            </div>
          </div>

          {activeTab === 'login' ? (
            <>
              <form onSubmit={handleEmailLogin} className="space-y-4">
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
                    placeholder="Enter your password"
                    disabled={loading}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition disabled:bg-gray-100"
                  />
                </div>

                <div className="flex justify-end">
                  <a
                    href="/auth/forgot-password"
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Forgot Password?
                  </a>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  isLoading={loading}
                >
                  Sign In
                </Button>
              </form>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or</span>
                </div>
              </div>

              <form onSubmit={handleMagicLink} className="space-y-4">
                <div>
                  <label htmlFor="magic-email" className="block text-sm font-medium text-gray-700 mb-1">
                    Sign in with Magic Link (Passwordless)
                  </label>
                  <input
                    id="magic-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="your@email.com"
                    disabled={loading}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition disabled:bg-gray-100"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    We'll send you a link to sign in without a password
                  </p>
                </div>

                <Button
                  type="submit"
                  variant="outline"
                  className="w-full"
                  isLoading={loading}
                >
                  Send Magic Link
                </Button>
              </form>
            </>
          ) : (
            <form onSubmit={handleEmailSignup} className="space-y-4">
              <div>
                <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  id="signup-email"
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
                <label htmlFor="signup-password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  id="signup-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Min. 8 chars, 1 uppercase, 1 number"
                  disabled={loading}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition disabled:bg-gray-100"
                />
              </div>

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

              <Button
                type="submit"
                className="w-full"
                isLoading={loading}
              >
                Create Account
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50">
        <Header showAuth={false} />
        <div className="flex items-center justify-center px-4 py-12">
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    }>
      <AuthPageContent />
    </Suspense>
  );
}
