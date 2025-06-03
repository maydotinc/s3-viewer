'use client';

import { useSession } from '@s3-viewer/auth/client';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import ProfileDropdown from './profileDropdown';

export default function ViewerBanner({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  // Redirect to connect page if not authenticated
  useEffect(() => {
    if (!isPending && !session && router.pathname !== '/connect') {
      router.push('/connect');
    }
  }, [session, isPending, router, router.pathname]);

  return (
    <div className="flex flex-col size-full [--header-height:calc(theme(spacing.20))]">
      <header className="flex justify-between sticky top-0 w-full h-[var(--header-height)] z-50 bg-gray-100 border-b border-gray-200">
        <Link href="/" className="flex items-center gap-2 mx-10 my-4 hover:text-gray-500 transition-colors">
          <Image
            src="/logo.png" 
            alt="S3 Viewer" 
            width={30}
            height={30}
            className="rounded-md"
            priority
            quality={100}
          />
          <span className="text-xl font-bold">S3Viewer</span>
        </Link>
        {session && (
          <div className="flex items-center mr-10">
            <ProfileDropdown />
          </div>
        )}
      </header>
      <div className="flex h-[calc(100svh-var(--header-height))] w-[calc(100%-var(--sidebar-width))]">
        {children}
      </div>
    </div>
  );
} 