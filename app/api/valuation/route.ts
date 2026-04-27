import { NextRequest, NextResponse } from 'next/server'

// ── Normalise OneMap street names to match HDB dataset format ────────────────
function normaliseStreet(street: string): string {
  return street
    .toUpperCase()
    .replace(/\bAVENUE\b/g, 'AVE')
    .replace(/\bROAD\b/g, 'RD')
    .replace(/\bSTREET\b/g, 'ST')
    .replace(/\bDRIVE\b/g, 'DR')
    .replace(/\bCRESCENT\b/g, 'CRES')
    .replace(/\bCLOSE\b/g, 'CL')
    .replace(/\bTERRACE\b/g, 'TER')
    .replace(/\bPLACE\b/g, 'PL')
    .replace(/\bGARDENS\b/g, 'GDNS')
    .replace(/\bLINK\b/g, 'LK')
    .replace(/\bWALK\b/g, 'WK')
    .replace(/\bNORTH\b/g, 'NTH')
    .replace(/\bSOUTH\b/g, 'STH')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Town keyword map (HDB resale dataset town names) ─────────────────────────
function deriveHDBTown(roadName: string): string | null {
  const r = roadName.toUpperCase()
  const map: Record<string, string[]> = {
    'ANG MO KIO':        ['ANG MO KIO'],
    'BEDOK':             ['BEDOK', 'CHAI CHEE', 'UPPER EAST COAST', 'NEW UPPER CHANGI'],
    'BISHAN':            ['BISHAN', 'SIN MING', 'MARYMOUNT'],
    'BUKIT BATOK':       ['BUKIT BATOK', 'BUKIT GOMBAK', 'HILLVIEW'],
    'BUKIT MERAH':       ['BUKIT MERAH', 'REDHILL', 'TELOK BLANGAH', 'ALEXANDRA', 'DELTA'],
    'BUKIT PANJANG':     ['BUKIT PANJANG', 'FAJAR', 'PETIR', 'PENDING'],
    'BUKIT TIMAH':       ['BUKIT TIMAH', 'CASHEW', 'UPPER BUKIT TIMAH', 'CORONATION'],
    'CENTRAL AREA':      ['OUTRAM', 'CHINATOWN', 'PEARL BANK', 'TANJONG PAGAR', 'BOAT QUAY'],
    'CHOA CHU KANG':     ['CHOA CHU KANG', 'YEW TEE', 'KEAT HONG', 'TECK WHYE'],
    'CLEMENTI':          ['CLEMENTI', 'WEST COAST', 'SUNSET WAY', 'PANDAN'],
    'GEYLANG':           ['GEYLANG', 'ALJUNIED', 'PAYA LEBAR', 'DAKOTA', 'LORONG'],
    'HOUGANG':           ['HOUGANG', 'SERANGOON NORTH', 'LORONG AH SOO', 'DEFU'],
    'JURONG EAST':       ['JURONG EAST', 'BOON LAY', 'TAMAN JURONG', 'JURONG EAST ST', 'JURONG EAST AVE', 'JURONG EAST CTR'],
    'JURONG WEST':       ['JURONG WEST', 'LAKESIDE', 'PIONEER', 'BAHAR', 'YUAN CHING'],
    'KALLANG/WHAMPOA':   ['KALLANG', 'WHAMPOA', 'BENDEMEER', 'BOON KENG', 'CRAWFORD', 'POTONG PASIR'],
    'MARINE PARADE':     ['MARINE PARADE', 'SIGLAP', 'KATONG', 'EAST COAST'],
    'PASIR RIS':         ['PASIR RIS', 'ELIAS', 'WHITE SANDS', 'TAMPINES AVE 9'],
    'PUNGGOL':           ['PUNGGOL', 'EDGEDALE', 'NORTHSHORE', 'WATERWAY', 'PUNGGOL FIELD'],
    'QUEENSTOWN':        ['QUEENSTOWN', 'STIRLING', 'MEI CHIN', 'COMMONWEALTH', 'DOVER', 'MARGARET', 'TANGLIN HALT'],
    'SEMBAWANG':         ['SEMBAWANG', 'CANBERRA', 'ADMIRALTY', 'WELLINGTON'],
    'SENGKANG':          ['SENGKANG', 'FERNVALE', 'RIVERVALE', 'COMPASSVALE', 'ANCHORVALE'],
    'SERANGOON':         ['SERANGOON', 'LORONG CHUAN', 'NERAM', 'UPPER SERANGOON'],
    'TAMPINES':          ['TAMPINES', 'SIMEI', 'TAMPINES ST', 'TAMPINES AVE', 'TAMPINES CTRL'],
    'TOA PAYOH':         ['TOA PAYOH', 'BRADDELL', 'CALDECOTT', 'LORONG 1 TOA PAYOH', 'LORONG 2 TOA PAYOH', 'LORONG 4', 'LORONG 5', 'LORONG 6', 'LORONG 7', 'LORONG 8'],
    'WOODLANDS':         ['WOODLANDS', 'MARSILING', 'WOODGROVE', 'GREENWOOD'],
    'YISHUN':            ['YISHUN', 'KHATIB', 'YISHUN ST', 'YISHUN AVE', 'YISHUN RING'],
  }
  for (const [town, keywords] of Object.entries(map)) {
    if (keywords.some(kw => r.includes(kw))) return town
  }
  return null
}

// ── Format price as "S$380K" or "S$1.25M" ────────────────────────────────────
function formatPrice(price: number): string {
  const rounded = Math.round(price / 10000) * 10000
  if (rounded >= 1_000_000) {
    return `S$${(rounded / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`
  }
  return `S$${Math.round(rounded / 1000)}K`
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  if (sorted.length === 1) return sorted[0]
  const idx = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

// ── Detect likely private/condo property ─────────────────────────────────────
function isLikelyPrivate(block: string, development: string): boolean {
  const dev = development.toUpperCase()
  const privateKeywords = [
    'CONDOMINIUM', 'CONDO', 'RESIDENCES', 'RESIDENCE', 'REGENT', 'SUITES', 'SUITE',
    'APARTMENTS', 'PLAZA', 'TOWERS', 'TOWER', 'COURT', 'PARK', 'GARDEN', 'VILLA', 'VILLAS',
    'WATERFRONT', 'SPRINGS', 'HILLS', 'HEIGHTS', 'LODGE', 'MANOR', 'GROVE',
  ]
  const hasHDBBlock = /^\d{1,4}[A-Z]?$/.test(block)
  if (!hasHDBBlock && privateKeywords.some(kw => dev.includes(kw))) return true
  if (!block || block.toLowerCase() === 'nil') return true
  return false
}

// ── Fetch HDB resale records from data.gov.sg ────────────────────────────────
// CKAN paginates from offset 0 (oldest first). For recent data we fetch the tail.
async function fetchHDBRecords(
  resourceId: string,
  filters: Record<string, string>,
  apiKey?: string,
  recentOnly = false,
): Promise<{ price: number; month: string }[]> {
  const headers: HeadersInit = apiKey ? { 'Authorization': apiKey } : {}
  const filtersParam = encodeURIComponent(JSON.stringify(filters))
  const base = `https://data.gov.sg/api/action/datastore_search?resource_id=${resourceId}`

  const parseRecs = (records: Record<string, string>[]) =>
    records
      .map(r => ({ price: parseFloat(r.resale_price), month: r.month || '' }))
      .filter(r => !isNaN(r.price))
      .sort((a, b) => b.month.localeCompare(a.month))

  if (recentOnly) {
    // For town-level fallback, dataset has ~230k records total.
    // The dataset grows by ~3k/month, so offset ~225000 gets us ~last 6 months.
    // We try multiple high offsets and pick the freshest results.
    const offsets = [229000, 226000, 220000]
    let bestRecs: { price: number; month: string }[] = []
    for (const offset of offsets) {
      const res = await fetch(`${base}&filters=${filtersParam}&limit=500&offset=${offset}`, { headers, cache: 'no-store' })
      if (!res.ok) continue
      const data = await res.json()
      if (!data.success || !data.result?.records?.length) continue
      const recs = parseRecs(data.result.records)
      if (recs.length > bestRecs.length) bestRecs = recs
      if (bestRecs.length >= 20) break
    }
    return bestRecs
  }

  // Block-level: fetch head + tail if large dataset
  const res = await fetch(`${base}&filters=${filtersParam}&limit=500`, { headers, cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json()
  if (!data.success || !data.result?.records) return []

  const head = parseRecs(data.result.records)
  const total: number = data.result?.total || 0

  if (total > 500) {
    const offset = Math.max(0, total - 500)
    const tailRes = await fetch(`${base}&filters=${filtersParam}&limit=500&offset=${offset}`, { headers, cache: 'no-store' })
    if (tailRes.ok) {
      const tailData = await tailRes.json()
      if (tailData.success && tailData.result?.records) {
        return [...head, ...parseRecs(tailData.result.records)]
          .sort((a, b) => b.month.localeCompare(a.month))
      }
    }
  }

  return head
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const postal = searchParams.get('postal')?.trim()
  const flatType = searchParams.get('flat_type')?.trim()?.toUpperCase()
  const propertyType = searchParams.get('property_type')?.trim() || ''

  if (!postal || !/^\d{6}$/.test(postal)) {
    return NextResponse.json({ error: 'Invalid postal code' }, { status: 400 })
  }

  try {
    // ── Step 1: OneMap address lookup ────────────────────────────────────────
    const oneMapUrl = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${postal}&returnGeom=N&getAddrDetails=Y&pageNum=1`
    const oneMapRes = await fetch(oneMapUrl, { next: { revalidate: 3600 } })
    if (!oneMapRes.ok) {
      return NextResponse.json({ error: 'Address lookup failed' }, { status: 503 })
    }

    const oneMapData = await oneMapRes.json()
    if (!oneMapData.results?.length) {
      return NextResponse.json({ error: 'Postal code not found' }, { status: 404 })
    }

    const r = oneMapData.results[0]
    const block = (r.BLK_NO || '').toString().trim()
    const street = normaliseStreet((r.ROAD_NAME || '').toString().trim())
    const development = (r.BUILDING || '').toString().trim()

    // ── Private property check ───────────────────────────────────────────────
    const isPrivateByType = propertyType === 'Condo' || propertyType === 'Landed'
    if (isPrivateByType || isLikelyPrivate(block, development)) {
      return NextResponse.json({
        block, street, development,
        propertyType: propertyType || 'Private',
        isPrivate: true,
        message: 'Our consultant will provide a detailed valuation',
      })
    }

    // ── Step 2: HDB resale price lookup ─────────────────────────────────────
    const town = deriveHDBTown(street)
    const apiKey = process.env.DATA_GOV_SG_API_KEY

    const RESOURCE_IDS = [
      'd_8b84c4ee58e3cfc0ece0d773c8ca6abc', // 2017-2026 live
      'adbbddd3-30e2-445f-a123-29bee150a6fe',
      'f1765b54-a209-4718-8d38-a39237f502b3',
    ]

    let allRecords: { price: number; month: string }[] = []

    const streetForFilter = street.replace(/'/g, '').replace(/'/g, '')
    for (const rid of RESOURCE_IDS) {
      const filters: Record<string, string> = { block, street_name: streetForFilter }
      if (flatType) filters.flat_type = flatType
      const records = await fetchHDBRecords(rid, filters, apiKey)
      allRecords.push(...records)
    }

    if (allRecords.length < 10 && town) {
      const rid = RESOURCE_IDS[0]
      // Try with flat_type first, then without if no results
      const filtersWithType: Record<string, string> = { town }
      if (flatType) filtersWithType.flat_type = flatType
      let townRecords = await fetchHDBRecords(rid, filtersWithType, apiKey, true)
      if (townRecords.length < 3 && flatType) {
        // Retry without flat_type filter
        townRecords = await fetchHDBRecords(rid, { town }, apiKey, true)
      }
      if (townRecords.length > allRecords.length) allRecords = townRecords
    }

    if (allRecords.length < 3) {
      return NextResponse.json({ error: 'Insufficient transaction data' }, { status: 404 })
    }

    const prices = allRecords.map(r => r.price).sort((a, b) => a - b)
    const low = percentile(prices, 25)
    const high = percentile(prices, 75)
    const latestMonth = allRecords
      .map(r => r.month)
      .filter(Boolean)
      .sort()
      .reverse()[0] || ''

    return NextResponse.json({
      block,
      street,
      development: development || `BLK ${block} ${street}`,
      town: town || '',
      estimatedLow: formatPrice(low),
      estimatedHigh: formatPrice(high),
      transactionCount: allRecords.length,
      latestMonth,
      isPrivate: false,
    })
  } catch (e) {
    console.error('[Valuation] Unexpected error:', e)
    return NextResponse.json({ error: 'Valuation service unavailable' }, { status: 500 })
  }
}
