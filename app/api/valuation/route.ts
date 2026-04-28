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
  // Tengah: new town, no resale data yet (MOP not up). Return null so caller handles gracefully.
  if (r.includes('TENGAH') || r.includes('PLANTATION CRESCENT') || r.includes('BRICKLAND') || r.includes('GARDEN VALE')) return '__TENGAH_NEW_TOWN__'
  for (const [town, keywords] of Object.entries(map)) {
    if (keywords.some(kw => r.includes(kw))) return town
  }
  return null
}


// ── Unit type to typical sqft range for PSF calculation ─────────────────────
// Ranges based on URA/HDB data medians for SG condos (sqft, built-in area)
// Low end = P20, high end = P80 of actual unit sizes for each bedroom count
function getTypicalSqft(unitType: string): { low: number; mid: number; high: number } {
  const u = (unitType || '').toLowerCase()
  if (u.includes('studio') || u.includes('1br') || u.includes('1 bed')) return { low: 420, mid: 506, high: 614 }
  if (u.includes('2 bed') || u.includes('2br'))                          return { low: 635, mid: 797, high: 969 }
  if (u.includes('3 bed') || u.includes('3br') || u.includes('3 room')) return { low: 926, mid: 1098, high: 1345 }
  if (u.includes('4 bed') || u.includes('4br') || u.includes('4 room')) return { low: 1259, mid: 1550, high: 1938 }
  if (u.includes('5') || u.includes('penthouse'))                        return { low: 1800, mid: 2400, high: 3800 }
  return { low: 500, mid: 900, high: 1400 } // default (unknown unit type)
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

// ── Known HDB building name patterns (override private keyword detection) ────
// Some HDB estates have names that look private (e.g. "PARC RESIDENCES @ TENGAH")
// If the block number is a valid HDB block format, trust that over building name.
const HDB_BLOCK_PATTERN = /^\d{1,4}[A-Z]?$/

// ── Detect likely private/condo property ─────────────────────────────────────
function isLikelyPrivate(block: string, development: string): boolean {
  const dev = development.toUpperCase()
  // If block matches HDB format (e.g. "301A", "12", "45B"), it's HDB — period.
  // Some new HDB estates have condo-sounding names (Parc Residences, The Pinnacle, etc.)
  if (HDB_BLOCK_PATTERN.test(block)) return false
  const privateKeywords = [
    'CONDOMINIUM', 'CONDO', 'RESIDENCES', 'RESIDENCE', 'REGENT', 'SUITES', 'SUITE',
    'APARTMENTS', 'PLAZA', 'TOWERS', 'TOWER', 'VILLA', 'VILLAS',
    'WATERFRONT', 'SPRINGS', 'LODGE', 'MANOR',
  ]
  if (privateKeywords.some(kw => dev.includes(kw))) return true
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
  const flatType = searchParams.get('flat_type')?.trim() || ''
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

      if (supabaseUrl && supabaseKey) {
        const isLanded = propertyType === 'Landed'
        let uraUrl = ''
        let projectKeywords = ''

        if (isLanded || !development || development === 'NIL') {
          // Landed: filter by specific sub-type if provided, else all landed types
          const streetEncoded = encodeURIComponent(street.replace(/'/g, ''))
          // Map form sub-type to URA property_type values
          // Note: Strata types are rare (<3% of transactions) so we exclude them for simplicity
          // Main landed types cover 97%+ of transactions
          const landedSubTypeMap: Record<string, string> = {
            'Terrace': 'Terrace',
            'Corner Terrace': 'Terrace',
            'Semi-Detached': 'Semi-detached',
            'Detached': 'Detached',
          }
          const landedTypes = (flatType && landedSubTypeMap[flatType])
            ? landedSubTypeMap[flatType]
            : 'Terrace,Semi-detached,Detached'
          // Note: use encodeURI (not encodeURIComponent) so %20 passes through correctly
          uraUrl = `${supabaseUrl}/rest/v1/ura_transactions?select=price,contract_date,floor_range,area,property_type,tenure,district,project&street=ilike.%25${streetEncoded}%25&property_type=in.(${landedTypes})&order=contract_date.desc&limit=200`
        } else {
          // Condo/Apartment: match by project name keywords
          projectKeywords = development.toUpperCase()
            .replace(/[^A-Z0-9 ]/g, ' ')
            .split(' ')
            .filter((w: string) => w.length > 2)
            .slice(0, 3)
            .join('%')
          uraUrl = `${supabaseUrl}/rest/v1/ura_transactions?select=price,contract_date,floor_range,area,property_type,tenure,district&project=ilike.%25${encodeURIComponent(projectKeywords)}%25&order=contract_date.desc&limit=200`
        }
        const uraRes = await fetch(uraUrl, {
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
          cache: 'no-store',
        })

        if (uraRes.ok) {
          let uraData = await uraRes.json()
          // Landed fallback: if insufficient street data, try district-level first, then national
          if (Array.isArray(uraData) && uraData.length < 3 && (isLanded || !development || development === 'NIL')) {
            const landedSubTypeMap2: Record<string, string> = {
              'Terrace': 'Terrace',
              'Corner Terrace': 'Terrace',
              'Semi-Detached': 'Semi-detached',
              'Detached': 'Detached',
            }
            const landedTypes2 = (flatType && landedSubTypeMap2[flatType])
              ? landedSubTypeMap2[flatType]
              : 'Terrace,Semi-detached,Detached'

            // Derive district from postal prefix (SG postal districts D01–D28)
            const postalPrefix = postal ? parseInt(postal.slice(0, 2), 10) : 0
            const districtMap: Record<number, number> = {
              1:1,2:1,3:2,4:2,5:3,6:4,7:5,8:5,9:9,10:10,
              11:11,12:12,13:13,14:14,15:15,16:16,17:17,18:18,
              19:19,20:20,21:21,22:22,23:23,24:24,25:25,26:26,
              27:27,28:28,
            }
            const district = districtMap[postalPrefix]

            // Tier 1 fallback: same district
            if (district) {
              const districtRes = await fetch(
                `${supabaseUrl}/rest/v1/ura_transactions?select=price,contract_date,floor_range,area,property_type,tenure,district,project&property_type=in.(${landedTypes2})&district=eq.${district}&order=contract_date.desc&limit=200`,
                { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }, cache: 'no-store' }
              )
              if (districtRes.ok) {
                const districtData = await districtRes.json()
                if (Array.isArray(districtData) && districtData.length >= 3) {
                  uraData = districtData
                }
              }
            }

            // Tier 2 fallback: national (only if district also insufficient)
            if (Array.isArray(uraData) && uraData.length < 3) {
              const fallbackRes = await fetch(
                `${supabaseUrl}/rest/v1/ura_transactions?select=price,contract_date,floor_range,area,property_type,tenure,district,project&property_type=in.(${landedTypes2})&order=contract_date.desc&limit=200`,
                { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }, cache: 'no-store' }
              )
              if (fallbackRes.ok) {
                const fallbackData = await fallbackRes.json()
                if (Array.isArray(fallbackData) && fallbackData.length >= 3) uraData = fallbackData
              }
            }
          }
          if (Array.isArray(uraData) && uraData.length >= 3) {
            const latestDate = uraData[0]?.contract_date || ''
            const tenure = uraData[0]?.tenure || ''
            const district = uraData[0]?.district || ''

            // Use PSF methodology for condo/landed — more accurate than raw price range
            const validPsf = uraData
              .filter((r: { price: number; area: number }) => Number(r.area) > 0 && Number(r.price) > 0)
              .map((r: { price: number; area: number }) => Number(r.price) / (Number(r.area) * 10.764))
              .filter((psf: number) => psf > 500 && psf < 10000)
              .sort((a: number, b: number) => a - b)

            let low: number, high: number
            if (validPsf.length >= 3 && propertyType !== 'Landed') {
              // PSF-based for condo:
              // low  = P25 PSF × low sqft  (conservative floor)
              // high = P75 PSF × high sqft (optimistic ceiling)
              // This gives a tighter, more realistic band than mid × mid
              const sqftRange = getTypicalSqft(flatType || '')
              const psfP25 = percentile(validPsf, 25)
              const psfP75 = percentile(validPsf, 75)
              low  = psfP25 * sqftRange.low
              high = psfP75 * sqftRange.high
            } else {
              // Landed: use raw price range (P25-P75) filtered by sub-type
              const prices = uraData.map((r: { price: number }) => Number(r.price)).filter((p: number) => p > 0).sort((a: number, b: number) => a - b)
              low = percentile(prices, 25)
              high = percentile(prices, 75)
            }

            // Get exact project name
            const projRes = await fetch(
              `${supabaseUrl}/rest/v1/ura_transactions?select=project&project=ilike.%25${encodeURIComponent(projectKeywords)}%25&limit=1`,
              { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }, cache: 'no-store' }
            )
            const projData = projRes.ok ? await projRes.json() : []
            const projectName = projData[0]?.project || development

            // Also return PSF for display in brief
            const psfLow = validPsf.length >= 3 ? Math.round(percentile(validPsf, 25)) : null
            const psfHigh = validPsf.length >= 3 ? Math.round(percentile(validPsf, 75)) : null

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
              psfLow,
              psfHigh,
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
      if (flatType) blockFilters.flat_type = flatType.toUpperCase()
      allRecords = await querySupabase(supabaseUrl, supabaseKey, blockFilters, 200)

      // Town-level fallback if not enough block data
      if (allRecords.length < 10 && town) {
        const townFilters: Record<string, string> = { town }
        if (flatType) townFilters.flat_type = flatType.toUpperCase()
        let townRecords = await querySupabase(supabaseUrl, supabaseKey, townFilters, 500)

        // If still not enough, try without flat_type
        if (townRecords.length < 3 && flatType) {
          townRecords = await querySupabase(supabaseUrl, supabaseKey, { town }, 500)
        }

        // Only use town data if we have more of it AND it's in a plausible range
        // (avoids diluting a specific block result with a wildly different town median)
        if (townRecords.length > allRecords.length) {
          if (allRecords.length === 0) {
            // No block data at all — use town
            allRecords = townRecords
          } else {
            // Sanity check: town median should be within 30% of block median
            const blockMedian = percentile(allRecords.map(r => r.price).sort((a, b) => a - b), 50)
            const townMedian  = percentile(townRecords.map(r => r.price).sort((a, b) => a - b), 50)
            const drift = Math.abs(townMedian - blockMedian) / blockMedian
            if (drift <= 0.30) {
              allRecords = townRecords
            }
            // If drift > 30%, keep the block data — small sample is more accurate than wrong town
          }
        }
      }
    }

    if (allRecords.length < 3) {
      // Check if this is a known new town with no resale data yet
      const isNewTown = town === '__TENGAH_NEW_TOWN__'
      return NextResponse.json({
        error: 'Insufficient transaction data',
        isNewTown,
        message: isNewTown
          ? 'Tengah is a new estate — no resale transactions yet (MOP not reached). Our consultant can provide a valuation estimate.'
          : undefined,
      }, { status: 404 })
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
