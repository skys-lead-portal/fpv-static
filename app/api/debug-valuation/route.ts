import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest) {
  const apiKey = process.env.DATA_GOV_SG_API_KEY
  const rid = 'd_8b84c4ee58e3cfc0ece0d773c8ca6abc'
  const headers: HeadersInit = apiKey ? { 'Authorization': apiKey } : {}

  // Get total count for Bishan
  const countFilters = encodeURIComponent(JSON.stringify({ town: 'BISHAN' }))
  const countUrl = `https://data.gov.sg/api/action/datastore_search?resource_id=${rid}&filters=${countFilters}&limit=1`
  const countRes = await fetch(countUrl, { headers })
  const countData = await countRes.json()
  const total = countData.result?.total || 0

  // Fetch last 100 records using offset = total - 100
  const offset = Math.max(0, total - 100)
  const recentUrl = `https://data.gov.sg/api/action/datastore_search?resource_id=${rid}&filters=${countFilters}&limit=100&offset=${offset}`
  const recentRes = await fetch(recentUrl, { headers })
  const recentData = await recentRes.json()

  return NextResponse.json({
    total, offset,
    recentStatus: recentRes.status,
    sample: recentData.result?.records?.slice(-3),
    hasKey: !!apiKey,
  })
}
