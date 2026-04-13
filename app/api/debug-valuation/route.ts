import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest) {
  const apiKey = process.env.DATA_GOV_SG_API_KEY
  const rid = 'd_8b84c4ee58e3cfc0ece0d773c8ca6abc'
  const headers: HeadersInit = apiKey ? { 'Authorization': apiKey } : {}

  // Single call: get 500 records for Bishan, sort client-side
  const filters = encodeURIComponent(JSON.stringify({ town: 'BISHAN' }))
  const url = `https://data.gov.sg/api/action/datastore_search?resource_id=${rid}&filters=${filters}&limit=500`
  const res = await fetch(url, { headers })
  const data = await res.json()

  const records = (data.result?.records || [])
    .map((r: Record<string,string>) => ({ month: r.month, price: parseFloat(r.resale_price) }))
    .filter((r: {month:string,price:number}) => !isNaN(r.price))
    .sort((a: {month:string}, b: {month:string}) => b.month.localeCompare(a.month))

  return NextResponse.json({
    status: res.status,
    success: data.success,
    total: data.result?.total,
    fetched: records.length,
    newestMonth: records[0]?.month,
    oldestMonth: records[records.length - 1]?.month,
    sampleRecent: records.slice(0, 3),
    hasKey: !!apiKey,
  })
}
