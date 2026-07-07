import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import type { SessionData } from '@/types/models'
import type { UserRole } from '@/types'

const SESSION_COOKIE = 'mxpos_session'

// Routes accessible without authentication
const PUBLIC_PATHS = [
  '/login',
  '/verify',
  '/api/',
  '/test-notification',
  '/offline'
]

// Role-based path prefixes
const ROLE_PATH_PREFIXES: Record<UserRole, string> = {
  SUPERADMIN: '/superadmin',
  ADMIN: '/admin',
  STORE_MANAGER: '/manager',
  CUSTOMER: '/storefront'
}

export async function middleware (request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|ico|css|js)$/)
  ) {
    return NextResponse.next()
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value

  if (!token) {
    return redirectToLogin(request)
  }

  try {
    const secret = new TextEncoder().encode(
      process.env.SESSION_SECRET ?? 'fallback-dev-secret'
    )
    const { payload } = await jwtVerify(token, secret)
    const session = payload as unknown as SessionData

    // Check role-based access
    const allowedPrefix = ROLE_PATH_PREFIXES[session.role]
    if (allowedPrefix && !pathname.startsWith(allowedPrefix)) {
      // User is trying to access a different role's area
      // Redirect to their correct dashboard
      const redirectPath = getRedirectForRole(session.role)
      return NextResponse.redirect(new URL(redirectPath, request.url))
    }

    // For store managers, check approval status
    if (
      session.role === 'STORE_MANAGER' &&
      session.approvalStatus !== 'APPROVED'
    ) {
      // Check if trying to create customer stores (allowed only when approved)
      if (pathname.includes('/customer-stores')) {
        return NextResponse.redirect(new URL('/manager/dashboard', request.url))
      }
    }

    return NextResponse.next()
  } catch {
    return redirectToLogin(request)
  }
}

function redirectToLogin (request: NextRequest): NextResponse {
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('redirect', request.nextUrl.pathname)
  return NextResponse.redirect(loginUrl)
}

function getRedirectForRole (role: UserRole): string {
  switch (role) {
    case 'SUPERADMIN':
      return '/superadmin/dashboard'
    case 'ADMIN':
      return '/admin/dashboard'
    case 'STORE_MANAGER':
      return '/manager/dashboard'
    case 'CUSTOMER':
      return '/storefront/catalog'
  }
}

export const config = {
  matcher: [
    '/((?!_next|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|ico|css|js)).*)'
  ]
}
