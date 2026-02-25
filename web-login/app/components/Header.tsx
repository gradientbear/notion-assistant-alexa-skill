'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface HeaderProps {
  showAuth?: boolean;
}

export function Header({ showAuth = true }: HeaderProps) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (showAuth) {
      checkAuth();
    }
  }, [showAuth]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setIsAuthenticated(!!session);
  };

  const handleLogout = async () => {
    try {
      // Clear localStorage tokens
      localStorage.removeItem('website_access_token');
      localStorage.removeItem('website_refresh_token');
      
      // Clear sessionStorage redirect flags
      if (typeof window !== 'undefined') {
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
          if (key.startsWith('redirect_attempted_')) {
            sessionStorage.removeItem(key);
          }
        });
      }
      
      // Revoke refresh token server-side (if available)
      const refreshToken = localStorage.getItem('website_refresh_token');
      if (refreshToken) {
        try {
          await fetch('/api/auth/revoke', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });
        } catch (err) {
          // Continue logout even if revocation fails
          console.error('[Header] Error revoking refresh token:', err);
        }
      }
      
      // Clear HTTP-only refresh token cookie via API call
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch (err) {
        // Continue logout even if API call fails
        console.error('[Header] Error calling logout API:', err);
      }
      
      // Sign out from Supabase
      await supabase.auth.signOut();
      
      // Redirect to home page
      router.push('/');
    } catch (error) {
      console.error('[Header] Error during logout:', error);
      // Still redirect even if there's an error
      router.push('/');
    }
  };

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="text-xl font-bold text-gray-900">
            Voice Planner
          </Link>
          
          {showAuth && isAuthenticated && (
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

