import { NextRequest, NextResponse } from 'next/server'

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
async function fetchHDBRecords(
  resourceId: string,
  filters: Record<string, string>,
  apiKey?: string,
): Promise<{ price: number; month: string }[]> {
  const headers: HeadersInit = {}
  if (apiKey) headers['Authorization'] = apiKey  // data.gov.sg v2 key format
  const filtersParam = encodeURIComponent(JSON.stringify(filters))
  const url = `https://data.gov.sg/api/action/datastore_search?resource_id=${resourceId}&filters=${filtersParam}&limit=100&sort=month%20desc`

  const res = await fetch(url, { headers, next: { revalidate: 3600 } })
  if (!res.ok) return []
  const data = await res.json()
  if (!data.success || !data.result?.records) return []

  return data.result.records
    .map((r: Record<string, string>) => ({ price: parseFloat(r.resale_price), month: r.month || '' }))
    .filter((r: { price: number; month: string }) => !isNaN(r.price))
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const postal = searchParams.get('postal')?.trim()
  const flatType = searchParams.get('flat_type')?.trim()?.toUpperCase()

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
    const street = (r.ROAD_NAME || '').toString().trim().toUpperCase()
    const development = (r.BUILDING || '').toString().trim()

    // ── Private property check ───────────────────────────────────────────────
    if (isLikelyPrivate(block, development)) {
      return NextResponse.json({
        block, street, development,
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

    const streetForFilter = street.replace(/'/g, '')
    for (const rid of RESOURCE_IDS) {
      const filters: Record<string, string> = { block, street_name: streetForFilter }
      if (flatType) filters.flat_type = flatType
      const records = await fetchHDBRecords(rid, filters, apiKey)
      allRecords.push(...records)
    }

    if (allRecords.length < 10 && town) {
      for (const rid of RESOURCE_IDS.slice(0, 1)) {
        const filters: Record<string, string> = { town }
        if (flatType) filters.flat_type = flatType
        const records = await fetchHDBRecords(rid, filters, apiKey)
        if (records.length > allRecords.length) allRecords = records
      }
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
