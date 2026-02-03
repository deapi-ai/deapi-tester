import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: 'deAPI Tester',
  description: 'Local developer testing app for deAPI.ai endpoints',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen bg-[#0a0a0a] text-[#ededed]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
