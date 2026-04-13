import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest) {
  const apiKey = process.env.DATA_GOV_SG_API_KEY
  const rid = 'd_8b84c4ee58e3cfc0ece0d773c8ca6abc'
  const headers: HeadersInit = apiKey ? { 'Authorization': apiKey } : {}

  const townFilters = encodeURIComponent(JSON.stringify({ town: 'BISHAN' }))
  const townUrl = `https://data.gov.sg/api/action/datastore_search?resource_id=${rid}&filters=${townFilters}&limit=3`
  const townRes = await fetch(townUrl, { headers })
  const townData = await townRes.json()

  return NextResponse.json({
    townStatus: townRes.status,
    townTotal: townData.result?.total,
    townSample: townData.result?.records?.slice(0, 2),
    hasKey: !!apiKey,
  })
}
