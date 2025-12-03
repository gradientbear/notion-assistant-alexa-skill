'use client';

import React from 'react';
import { FaGoogle, FaMicrosoft, FaApple } from 'react-icons/fa';

interface SocialButtonsProps {
  onGoogleClick: () => void;
  onMicrosoftClick: () => void;
  onAppleClick: () => void;
  isLoading?: boolean;
}

export function SocialButtons({
  onGoogleClick,
  onMicrosoftClick,
  onAppleClick,
  isLoading = false,
}: SocialButtonsProps) {
  return (
    <div className="space-y-3">
      <button
        onClick={onGoogleClick}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border-2 border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <FaGoogle className="text-red-500 text-xl" />
        Continue with Google
      </button>

      <button
        onClick={onMicrosoftClick}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border-2 border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <FaMicrosoft className="text-blue-500 text-xl" />
        Continue with Microsoft
      </button>

      <button
        onClick={onAppleClick}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border-2 border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <FaApple className="text-gray-900 text-xl" />
        Continue with Apple
      </button>
    </div>
  );
}

