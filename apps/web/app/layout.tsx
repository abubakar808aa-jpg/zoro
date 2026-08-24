import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { themeInitScript } from '@/lib/theme';

export const metadata: Metadata = {
  title: 'JobMan – Find Jobs & Hire Talent in the USA',
  description: 'The US marketplace for gig workers, professionals, and employers. Find a plumber, electrician, engineer, or post a job opening — all in one place.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies today's theme vars before first paint — must run pre-hydration */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript() }} />
      </head>
      <body className="pb-24 lg:pb-0">
        <AuthProvider>
          <Navbar />
          <main>{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
