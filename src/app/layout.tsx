import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';

function getMetadataBaseUrl(): string {
  const fallback = 'http://localhost:3000';
  const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (!rawSiteUrl) {
    return fallback;
  }

  let normalized = rawSiteUrl.trim();

  // Ensure URL has a protocol; default to https, or http for localhost/127.0.0.1
  if (!/^https?:\/\//i.test(normalized)) {
    const isLocalHostLike = /^localhost(:\d+)?$/i.test(normalized) || /^127\.0\.0\.1(:\d+)?$/i.test(normalized);
    const protocol = isLocalHostLike ? 'http://' : 'https://';
    normalized = protocol + normalized;
  }

  try {
    // Validate that the resulting string is a proper URL
    // eslint-disable-next-line no-new
    new URL(normalized);
    return normalized;
  } catch {
    console.warn(
      `Invalid NEXT_PUBLIC_SITE_URL ('${rawSiteUrl}'). Falling back to ${fallback}`
    );
    return fallback;
  }
}

export const metadata: Metadata = {
  metadataBase: new URL(getMetadataBaseUrl()),
  title: 'deAPI Tester — Test AI Inference Endpoints',
  description:
    'Local developer tool for testing deAPI.ai endpoints. Generate images, videos, audio and more with dynamic forms, async job tracking, and result preview.',
  keywords: [
    'deapi',
    'ai inference',
    'api tester',
    'image generation',
    'video generation',
    'text to speech',
    'developer tool',
  ],
  authors: [{ name: 'deAPI', url: 'https://deapi.ai' }],
  openGraph: {
    title: 'deAPI Tester — Test AI Inference Endpoints',
    description:
      'Test deAPI.ai endpoints locally with dynamic forms, async job tracking, price calculator and result preview.',
    type: 'website',
    siteName: 'deAPI Tester',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'deAPI Tester — Test AI Inference Endpoints',
    description:
      'Test deAPI.ai endpoints locally with dynamic forms, async job tracking, price calculator and result preview.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('deapi-theme')||'dark';if(t==='system'){t=window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'}document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','dark')}})()`,
          }}
        />
      </head>
      <body className="antialiased min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
