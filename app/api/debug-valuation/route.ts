import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest) {
  const apiKey = process.env.DATA_GOV_SG_API_KEY
  const rid = 'd_8b84c4ee58e3cfc0ece0d773c8ca6abc'
  const headers: HeadersInit = apiKey ? { 'Authorization': apiKey } : {}

  // Use SQL endpoint — single call, supports ORDER BY for recent records
  const sql = encodeURIComponent(
    `SELECT month, resale_price, block, street_name FROM "${rid}" WHERE town='BISHAN' ORDER BY month DESC LIMIT 5`
  )
  const url = `https://data.gov.sg/api/action/datastore_search_sql?sql=${sql}`
  const res = await fetch(url, { headers })
  const data = await res.json()

  return NextResponse.json({
    status: res.status,
    success: data.success,
    records: data.result?.records,
    error: data.error,
    hasKey: !!apiKey,
  })
}
