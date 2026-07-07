'use client'

export default function OfflinePage () {
  return (
    <div className='flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center'>
      {/* Offline icon */}
      <div className='flex h-24 w-24 items-center justify-center rounded-full bg-muted'>
        <svg
          xmlns='http://www.w3.org/2000/svg'
          width='48'
          height='48'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='1.5'
          strokeLinecap='round'
          strokeLinejoin='round'
          className='text-muted-foreground'
        >
          <path d='M8.5 2.5a8.5 8.5 0 0 1 8.09 5.75' />
          <path d='M2.5 8.5a8.5 8.5 0 0 1 12.08-7.62' />
          <line x1='2' y1='2' x2='22' y2='22' />
          <path d='M12 22c-4.97 0-9-4.03-9-9 0-1.66.45-3.22 1.24-4.56' />
          <path d='M22 13c0 4.97-4.03 9-9 9-1.66 0-3.22-.45-4.56-1.24' />
        </svg>
      </div>

      <div>
        <h1 className='text-2xl font-bold tracking-tight'>
          No Internet Connection
        </h1>
        <p className='mt-2 text-muted-foreground'>
          You&apos;re offline. Check your connection and try again.
        </p>
      </div>

      <button
        onClick={() => window.location.reload()}
        className='inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors'
      >
        <svg
          xmlns='http://www.w3.org/2000/svg'
          width='16'
          height='16'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
        >
          <polyline points='23 4 23 10 17 10' />
          <path d='M20.49 15a9 9 0 1 1-2.12-9.36L23 10' />
        </svg>
        Try Again
      </button>

      <p className='text-xs text-muted-foreground'>
        MW-POS works best with an active internet connection.
      </p>
    </div>
  )
}
