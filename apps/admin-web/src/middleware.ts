import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@iocondo/supabase-client';

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const db = createServerSupabase(
    {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    },
    {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options as never));
      },
    },
  );

  const { data: { user } } = await db.auth.getUser();

  // Se l'utente non è loggato e tenta di accedere ad aree protette, redirect a login
  const isPublic = req.nextUrl.pathname.startsWith('/login') ||
                   req.nextUrl.pathname.startsWith('/auth') ||
                   req.nextUrl.pathname === '/';

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
