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

  // Step 1: OneMap
  const oneMapRes = await fetch(`https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${postal}&returnGeom=N&getAddrDetails=Y&pageNum=1`)
  const oneMapData = await oneMapRes.json()
  const r = oneMapData.results?.[0]
  const block = r?.BLK_NO || ''
  const rawStreet = r?.ROAD_NAME || ''
  const normStreet = normaliseStreet(rawStreet)

  // Step 2: Block-level filter test
  const blockFilters = encodeURIComponent(JSON.stringify({ block, street_name: normStreet }))
  const blockRes = await fetch(
    `https://data.gov.sg/api/action/datastore_search?resource_id=${rid}&filters=${blockFilters}&limit=3`,
    { headers, cache: 'no-store' }
  )
  const blockRaw = await blockRes.text()
  let blockData: Record<string, unknown> = {}
  try { blockData = JSON.parse(blockRaw) } catch { blockData = { parseError: blockRaw.slice(0, 200) } }

  // Step 3: Town filter test at high offset (recent records)
  const townName = 'ANG MO KIO' // hardcoded for debug
  const townFilters = encodeURIComponent(JSON.stringify({ town: townName }))
  const townRes = await fetch(
    `https://data.gov.sg/api/action/datastore_search?resource_id=${rid}&filters=${townFilters}&limit=3&offset=229000`,
    { headers, cache: 'no-store' }
  )
  const townRaw = await townRes.text()
  let townData: Record<string, unknown> = {}
  try { townData = JSON.parse(townRaw) } catch { townData = { parseError: townRaw.slice(0, 200) } }

  // Step 4: No-filter test at high offset
  const noFilterRes = await fetch(
    `https://data.gov.sg/api/action/datastore_search?resource_id=${rid}&limit=3&offset=229000`,
    { headers, cache: 'no-store' }
  )
  const noFilterRaw = await noFilterRes.text()
  let noFilterData: Record<string, unknown> = {}
  try { noFilterData = JSON.parse(noFilterRaw) } catch { noFilterData = { parseError: noFilterRaw.slice(0, 200) } }

  const blockResult = blockData as { success?: boolean; result?: { total?: number; records?: Record<string, string>[] } }
  const townResult = townData as { success?: boolean; result?: { total?: number; records?: Record<string, string>[] } }
  const noFilterResult = noFilterData as { success?: boolean; result?: { total?: number; records?: Record<string, string>[] } }

  return NextResponse.json({
    postal, block, rawStreet, normStreet,
    hasKey: !!apiKey,
    keyPrefix: apiKey ? apiKey.slice(0, 8) : 'MISSING',
    blockQuery: {
      success: blockResult.success,
      total: blockResult.result?.total,
      records: blockResult.result?.records?.slice(0, 2)?.map(r => ({ month: r.month, price: r.resale_price, flat: r.flat_type })),
      error: (blockData as { code?: number; errorMsg?: string }).code ? `${(blockData as { code?: number; errorMsg?: string }).code}: ${(blockData as { code?: number; errorMsg?: string }).errorMsg}` : undefined,
    },
    townQuery: {
      success: townResult.success,
      total: townResult.result?.total,
      records: townResult.result?.records?.slice(0, 2)?.map(r => ({ month: r.month, price: r.resale_price, town: r.town })),
      error: (townData as { code?: number; errorMsg?: string }).code ? `${(townData as { code?: number; errorMsg?: string }).code}: ${(townData as { code?: number; errorMsg?: string }).errorMsg}` : undefined,
    },
    noFilterQuery: {
      success: noFilterResult.success,
      total: noFilterResult.result?.total,
      records: noFilterResult.result?.records?.slice(0, 2)?.map(r => ({ month: r.month, price: r.resale_price, town: r.town })),
      error: (noFilterData as { code?: number; errorMsg?: string }).code ? `${(noFilterData as { code?: number; errorMsg?: string }).code}: ${(noFilterData as { code?: number; errorMsg?: string }).errorMsg}` : undefined,
    },
  })
}
