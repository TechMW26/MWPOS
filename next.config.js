/** @type {import('next').NextConfig} */
const nextConfig = {
  // ── Server Actions ────────────────────────────────────
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb'
    }
  },

  // ── PWA & Security Headers ────────────────────────────
  async headers () {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate'
          },
          { key: 'Service-Worker-Allowed', value: '/' }
        ]
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, must-revalidate'
          },
          { key: 'Content-Type', value: 'application/manifest+json' }
        ]
      },
      {
        source: '/icons/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }
        ]
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ]
      }
    ]
  },

  // ── Image optimization ────────────────────────────────
  images: {
    formats: ['image/avif', 'image/webp']
  },

  // ── Compress static assets ────────────────────────────
  compress: true,

  // ── Disable x-powered-by ──────────────────────────────
  poweredByHeader: false
}

module.exports = nextConfig
