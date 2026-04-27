import { NextRequest, NextResponse } from 'next/server'

function normaliseStreet(street: string): string {
  return street
    .toUpperCase()
    .replace(/\bAVENUE\b/g, 'AVE')
    .replace(/\bROAD\b/g, 'RD')
    .replace(/\bSTREET\b/g, 'ST')
    .replace(/\bDRIVE\b/g, 'DR')
    .replace(/\bCRESCENT\b/g, 'CRES')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const postal = searchParams.get('postal') || '560406'
  const apiKey = process.env.DATA_GOV_SG_API_KEY
  const rid = 'd_8b84c4ee58e3cfc0ece0d773c8ca6abc'
  const headers: HeadersInit = apiKey ? { 'Authorization': apiKey } : {}

  // Step 1: OneMap lookup
  const oneMapRes = await fetch(`https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${postal}&returnGeom=N&getAddrDetails=Y&pageNum=1`)
  const oneMapData = await oneMapRes.json()
  const r = oneMapData.results?.[0]
  const block = r?.BLK_NO || ''
  const rawStreet = r?.ROAD_NAME || ''
  const normStreet = normaliseStreet(rawStreet)

  // Step 2: Test block+street filter
  const filters = encodeURIComponent(JSON.stringify({ block, street_name: normStreet }))
  const blockRes = await fetch(
    `https://data.gov.sg/api/action/datastore_search?resource_id=${rid}&filters=${filters}&limit=5`,
    { headers }
  )
  const blockData = await blockRes.json()
  const blockRecs = blockData.result?.records || []

  // Step 3: Get total count for this block+street
  const countRes = await fetch(
    `https://data.gov.sg/api/action/datastore_search?resource_id=${rid}&filters=${filters}&limit=1`,
    { headers }
  )
  const countData = await countRes.json()
  const total = countData.result?.total

  // Step 4: Fetch tail (recent) if we have total
  let tailSample: { month: string; price: number }[] = []
  if (total && total > 0) {
    const offset = Math.max(0, total - 5)
    const tailRes = await fetch(
      `https://data.gov.sg/api/action/datastore_search?resource_id=${rid}&filters=${filters}&limit=5&offset=${offset}`,
      { headers }
    )
    const tailData = await tailRes.json()
    tailSample = (tailData.result?.records || []).map((rec: Record<string, string>) => ({
      month: rec.month,
      price: parseFloat(rec.resale_price),
    }))
  }

  return NextResponse.json({
    postal,
    block,
    rawStreet,
    normStreet,
    hasKey: !!apiKey,
    blockQuerySuccess: blockData.success,
    blockQueryTotal: total,
    blockSample: blockRecs.slice(0, 3).map((rec: Record<string, string>) => ({
      month: rec.month, price: rec.resale_price, flat_type: rec.flat_type,
    })),
    tailSample,
  })
}
