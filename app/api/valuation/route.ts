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
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Town keyword map (HDB resale dataset town names) ─────────────────────────
function deriveHDBTown(roadName: string): string | null {
  const r = roadName.toUpperCase()
  const map: Record<string, string[]> = {
    'ANG MO KIO':        ['ANG MO KIO'],
    'BEDOK':             ['BEDOK', 'CHAI CHEE', 'NEW UPPER CHANGI'],
    'BISHAN':            ['BISHAN', 'SIN MING', 'MARYMOUNT'],
    'BUKIT BATOK':       ['BUKIT BATOK', 'BUKIT GOMBAK', 'HILLVIEW'],
    'BUKIT MERAH':       ['BUKIT MERAH', 'REDHILL', 'TELOK BLANGAH', 'ALEXANDRA', 'DELTA'],
    'BUKIT PANJANG':     ['BUKIT PANJANG', 'FAJAR', 'PETIR', 'PENDING'],
    'BUKIT TIMAH':       ['BUKIT TIMAH', 'CASHEW', 'UPPER BUKIT TIMAH'],
    'CENTRAL AREA':      ['OUTRAM', 'CHINATOWN', 'TANJONG PAGAR'],
    'CHOA CHU KANG':     ['CHOA CHU KANG', 'YEW TEE', 'KEAT HONG', 'TECK WHYE'],
    'CLEMENTI':          ['CLEMENTI', 'WEST COAST', 'SUNSET WAY'],
    'GEYLANG':           ['GEYLANG', 'ALJUNIED', 'PAYA LEBAR', 'DAKOTA', 'LORONG'],
    'HOUGANG':           ['HOUGANG', 'SERANGOON NORTH', 'LORONG AH SOO'],
    'JURONG EAST':       ['JURONG EAST'],
    'JURONG WEST':       ['JURONG WEST', 'LAKESIDE', 'PIONEER', 'YUAN CHING'],
    'KALLANG/WHAMPOA':   ['KALLANG', 'WHAMPOA', 'BENDEMEER', 'BOON KENG', 'POTONG PASIR'],
    'MARINE PARADE':     ['MARINE PARADE', 'SIGLAP', 'KATONG'],
    'PASIR RIS':         ['PASIR RIS', 'ELIAS'],
    'PUNGGOL':           ['PUNGGOL', 'EDGEDALE', 'NORTHSHORE', 'WATERWAY'],
    'QUEENSTOWN':        ['QUEENSTOWN', 'STIRLING', 'COMMONWEALTH', 'DOVER', 'MARGARET', 'TANGLIN HALT'],
    'SEMBAWANG':         ['SEMBAWANG', 'CANBERRA', 'ADMIRALTY'],
    'SENGKANG':          ['SENGKANG', 'FERNVALE', 'RIVERVALE', 'COMPASSVALE', 'ANCHORVALE'],
    'SERANGOON':         ['SERANGOON', 'LORONG CHUAN', 'UPPER SERANGOON'],
    'TAMPINES':          ['TAMPINES', 'SIMEI'],
    'TOA PAYOH':         ['TOA PAYOH', 'BRADDELL', 'CALDECOTT'],
    'WOODLANDS':         ['WOODLANDS', 'MARSILING', 'WOODGROVE'],
    'YISHUN':            ['YISHUN', 'KHATIB'],
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

// ── Query HDB transactions from Supabase cache ────────────────────────────────
async function querySupabase(
  supabaseUrl: string,
  supabaseKey: string,
  filters: Record<string, string>,
  limit = 200,
): Promise<{ price: number; month: string }[]> {
  let url = `${supabaseUrl}/rest/v1/hdb_transactions?select=resale_price,month&order=month.desc&limit=${limit}`
  for (const [key, val] of Object.entries(filters)) {
    url += `&${encodeURIComponent(key)}=eq.${encodeURIComponent(val)}`
  }
  const res = await fetch(url, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
    },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = await res.json()
  if (!Array.isArray(data)) return []
  return data
    .map((r: { resale_price: string | number; month: string }) => ({
      price: parseFloat(String(r.resale_price)),
      month: r.month || '',
    }))
    .filter(r => !isNaN(r.price))
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
    const oneMapRes = await fetch(oneMapUrl, { cache: 'no-store' })
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
      // Try URA transaction data for private property
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

      if (supabaseUrl && supabaseKey && development && development !== 'NIL') {
        // Build search keywords from development name
        const keywords = development.toUpperCase()
          .replace(/[^A-Z0-9 ]/g, ' ')
          .split(' ')
          .filter((w: string) => w.length > 2)
          .slice(0, 3)
          .join('%')

        const uraUrl = `${supabaseUrl}/rest/v1/ura_transactions?select=price,contract_date,floor_range,area,property_type,tenure,district&project=ilike.%25${encodeURIComponent(keywords)}%25&order=contract_date.desc&limit=200`
        const uraRes = await fetch(uraUrl, {
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
          cache: 'no-store',
        })

        if (uraRes.ok) {
          const uraData = await uraRes.json()
          if (Array.isArray(uraData) && uraData.length >= 3) {
            const prices = uraData.map((r: { price: number }) => Number(r.price)).filter(p => p > 0).sort((a, b) => a - b)
            const low = percentile(prices, 25)
            const high = percentile(prices, 75)
            const latestDate = uraData[0]?.contract_date || ''
            const tenure = uraData[0]?.tenure || ''
            const district = uraData[0]?.district || ''

            // Get exact project name
            const projRes = await fetch(
              `${supabaseUrl}/rest/v1/ura_transactions?select=project&project=ilike.%25${encodeURIComponent(keywords)}%25&limit=1`,
              { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }, cache: 'no-store' }
            )
            const projData = projRes.ok ? await projRes.json() : []
            const projectName = projData[0]?.project || development

            return NextResponse.json({
              block, street,
              development: projectName,
              propertyType: propertyType || 'Private',
              isPrivate: true,
              estimatedLow: formatPrice(low),
              estimatedHigh: formatPrice(high),
              transactionCount: uraData.length,
              latestMonth: latestDate,
              tenure,
              district,
            })
          }
        }
      }

      // No URA data found
      return NextResponse.json({
        block, street, development,
        propertyType: propertyType || 'Private',
        isPrivate: true,
        message: 'Our consultant will provide a detailed valuation',
      })
    }

    // ── Step 2: HDB resale price lookup (Supabase cache) ────────────────────
    const town = deriveHDBTown(street)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

    let allRecords: { price: number; month: string }[] = []

    if (supabaseUrl && supabaseKey) {
      // Block + street level query (precise)
      const blockFilters: Record<string, string> = {
        block,
        street_name: street.replace(/'/g, ''),
      }
      if (flatType) blockFilters.flat_type = flatType
      allRecords = await querySupabase(supabaseUrl, supabaseKey, blockFilters, 200)

      // Town-level fallback if not enough block data
      if (allRecords.length < 10 && town) {
        const townFilters: Record<string, string> = { town }
        if (flatType) townFilters.flat_type = flatType
        let townRecords = await querySupabase(supabaseUrl, supabaseKey, townFilters, 500)

        // If still not enough, try without flat_type
        if (townRecords.length < 3 && flatType) {
          townRecords = await querySupabase(supabaseUrl, supabaseKey, { town }, 500)
        }

        if (townRecords.length > allRecords.length) allRecords = townRecords
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
