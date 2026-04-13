import type { Metadata } from 'next'
export const metadata: Metadata = {
  title: 'Free Property Valuation Singapore | SGHomeValuation.com',
  description: 'Get a free property valuation in 60 seconds. Based on recent HDB and private property transactions in Singapore.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: '/favicon.png',
  },
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  )
}
