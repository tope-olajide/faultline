import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import { Sidebar } from '@/components/shell/sidebar'
import { TopBar } from '@/components/shell/top-bar'
import { demoScope } from '@/server/config'

export const metadata: Metadata = {
  title: {
    default: 'Faultline — Know why it broke',
    template: '%s · Faultline',
  },
  description:
    'Self-improving incident intelligence: an operational knowledge graph that learns from verified investigations.',
}

export const viewport: Viewport = {
  themeColor: '#090D12',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only rounded-md bg-surface px-3 py-2 text-ink focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
        >
          Skip to content
        </a>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar project={demoScope.project} environment={demoScope.environment} />
            <main id="main" className="min-w-0 flex-1 px-4 py-5 lg:px-6 lg:py-6">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  )
}
