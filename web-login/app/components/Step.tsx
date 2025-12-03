import React from 'react';

interface StepProps {
  number: number;
  title: string;
  description?: string;
  status: 'complete' | 'current' | 'pending';
  children?: React.ReactNode;
}

export function Step({ number, title, description, status, children }: StepProps) {
  return (
    <div className="flex gap-4">
      {/* Step indicator */}
      <div className="flex-shrink-0">
        {status === 'complete' ? (
          <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : status === 'current' ? (
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
            {number}
          </div>
        ) : (
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-semibold">
            {number}
          </div>
        )}
      </div>
      
      {/* Step content */}
      <div className="flex-1 pb-8">
        <div className="mb-2">
          <h3 className={`text-lg font-semibold ${status === 'pending' ? 'text-gray-400' : 'text-gray-900'}`}>
            {title}
          </h3>
          {description && (
            <p className={`text-sm mt-1 ${status === 'pending' ? 'text-gray-400' : 'text-gray-600'}`}>
              {description}
            </p>
          )}
        </div>
        {children && (
          <div className="mt-4">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

