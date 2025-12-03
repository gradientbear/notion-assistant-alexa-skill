'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Redirect to main page with login tab
    const redirect = searchParams.get('redirect');
    if (redirect) {
      router.push(`/?tab=login&redirect=${encodeURIComponent(redirect)}`);
    } else {
      router.push('/?tab=login');
    }
  }, [router, searchParams]);

  return null;
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
