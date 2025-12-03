'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function SignupPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Redirect to main page with signup tab
    const redirect = searchParams.get('redirect');
    if (redirect) {
      router.push(`/?tab=signup&redirect=${encodeURIComponent(redirect)}`);
    } else {
      router.push('/?tab=signup');
    }
  }, [router, searchParams]);

  return null;
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupPageContent />
    </Suspense>
  );
}
