import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const block = searchParams.get('block') || '144'
  const street = searchParams.get('street') || 'BISHAN STREET 12'
  const rid = 'd_8b84c4ee58e3cfc0ece0d773c8ca6abc'
  const apiKey = process.env.DATA_GOV_SG_API_KEY

  const filters = { block, street_name: street }
  const fp = encodeURIComponent(JSON.stringify(filters))
  const url = `https://data.gov.sg/api/action/datastore_search?resource_id=${rid}&filters=${fp}&limit=5`

  const headers: HeadersInit = apiKey ? { 'Authorization': apiKey } : {}
  const res = await fetch(url, { headers })
  const data = await res.json()

  return NextResponse.json({
    url, status: res.status, hasKey: !!apiKey,
    success: data.success, total: data.result?.total,
    records: data.result?.records?.slice(0, 3),
  })
}
