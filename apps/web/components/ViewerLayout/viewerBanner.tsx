import Image from 'next/image';
import Link from 'next/link';

export default function ViewerBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col size-full [--header-height:calc(theme(spacing.20))]">
      <header className="flex sticky top-0 w-full h-[var(--header-height)] z-50 bg-gray-100 border-b border-gray-200">
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
          <span className="text-xl font-bold">S3 Viewer</span>
        </Link>
      </header>
      <div className="flex h-[calc(100svh-var(--header-height))]">
        {children}
      </div>
    </div>
  );
} 