import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
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
    url: 'https://github.com/deapi-ai/deapi-develop-tester',
    siteName: 'deAPI Tester',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'deAPI Tester — Test AI Inference Endpoints',
    description:
      'Test deAPI.ai endpoints locally with dynamic forms, async job tracking, price calculator and result preview.',
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
