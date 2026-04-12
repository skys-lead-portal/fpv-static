import type { Metadata } from 'next'
export const metadata: Metadata = {
  title: 'Free Property Valuation Singapore | FreePropertyValuation.sg',
  description: 'Get a free property valuation in 60 seconds. Based on recent HDB and private property transactions in Singapore.',
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  )
}
