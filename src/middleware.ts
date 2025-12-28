import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const url = request.nextUrl.pathname

  // 为静态资源添加长期缓存头
  if (
    url.startsWith('/_next/static/') ||
    url.startsWith('/_next/image') ||
    url.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webp|avif)$/)
  ) {
    // 静态资源：1年缓存，不可变
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
    response.headers.set('Expires', new Date(Date.now() + 31536000000).toUTCString())
    
    // 添加ETag支持（Next.js会自动生成）
    // 添加Last-Modified支持
    response.headers.set('Vary', 'Accept-Encoding')
  } else if (url.startsWith('/_next/')) {
    // Next.js内部资源：不缓存
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
  } else if (url.startsWith('/api/')) {
    // API路由：不缓存
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
  } else {
    // HTML页面：允许浏览器缓存但需要验证
    response.headers.set('Cache-Control', 'public, max-age=0, must-revalidate')
  }

  // 添加安全头
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'SAMEORIGIN')
  response.headers.set('X-XSS-Protection', '1; mode=block')

  return response
}

// 配置中间件匹配规则
// 匹配所有请求，包括静态资源
export const config = {
  matcher: [
    /*
     * 匹配所有请求路径
     * 包括静态资源、API路由、页面等
     */
    '/(.*)',
  ],
}

