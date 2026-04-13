import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const block = searchParams.get('block') || '144'
  const street = searchParams.get('street') || 'BISHAN STREET 12'
  const rid = 'd_8b84c4ee58e3cfc0ece0d773c8ca6abc'

  const filters = { block, street_name: street }
  const fp = encodeURIComponent(JSON.stringify(filters))
  const url = `https://data.gov.sg/api/action/datastore_search?resource_id=${rid}&filters=${fp}&limit=5`

  const res = await fetch(url)
  const data = await res.json()

  return NextResponse.json({
    url,
    status: res.status,
    success: data.success,
    total: data.result?.total,
    records: data.result?.records?.slice(0, 3),
    error: data.error,
  })
}
