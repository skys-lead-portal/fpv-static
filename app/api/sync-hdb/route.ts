/**
 * POST /api/sync-hdb
 * Protected endpoint: syncs HDB data from data.gov.sg into Supabase.
 * Called from Vercel (their IPs aren't rate-limited like our Mac).
 * Auth: Bearer token from SYNC_SECRET env var.
 * 
 * Query params:
 *   offset - start offset in the dataset (default: 199623 = last 30k records)
 *   limit  - records per page (default: 500)
 *   pages  - number of pages to fetch (default: 60 = 30k records)
 */
import { NextRequest, NextResponse } from 'next/server'

const RESOURCE_ID = 'd_8b84c4ee58e3cfc0ece0d773c8ca6abc'

export async function POST(req: NextRequest) {
  // Auth check
  const authHeader = req.headers.get('authorization') || ''
  const syncSecret = process.env.SYNC_SECRET || ''
  if (!syncSecret || authHeader !== `Bearer ${syncSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const startOffset = parseInt(searchParams.get('offset') || '199623')
  const pageLimit = parseInt(searchParams.get('limit') || '500')
  const maxPages = parseInt(searchParams.get('pages') || '60')

  const apiKey = process.env.DATA_GOV_SG_API_KEY || ''
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 })
  }

  const headers: HeadersInit = apiKey ? { 'Authorization': apiKey } : {}
  let totalFetched = 0
  let totalUpserted = 0
  const errors: string[] = []

  for (let page = 0; page < maxPages; page++) {
    const offset = startOffset + page * pageLimit
    const url = `https://data.gov.sg/api/action/datastore_search?resource_id=${RESOURCE_ID}&limit=${pageLimit}&offset=${offset}`

    try {
      const res = await fetch(url, { headers, cache: 'no-store' })
      const data = await res.json()

      if (!data.success || !data.result?.records?.length) {
        if (data.code === 24) {
          errors.push(`Rate limited at offset ${offset}`)
          break
        }
        break // end of dataset
      }

      const records = data.result.records
      totalFetched += records.length

      // Upsert to Supabase
      const rows = records.map((r: Record<string, string>) => ({
        month: r.month,
        town: r.town,
        flat_type: r.flat_type,
        block: r.block,
        street_name: r.street_name,
        storey_range: r.storey_range,
        floor_area_sqm: r.floor_area_sqm,
        flat_model: r.flat_model,
        lease_commence_date: r.lease_commence_date,
        remaining_lease: r.remaining_lease,
        resale_price: parseFloat(r.resale_price),
        synced_at: new Date().toISOString(),
      }))

      const upsertRes = await fetch(`${supabaseUrl}/rest/v1/hdb_transactions`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(rows),
      })

      if (!upsertRes.ok) {
        const errText = await upsertRes.text()
        errors.push(`Supabase error at offset ${offset}: ${errText.slice(0, 100)}`)
        break
      }

      totalUpserted += rows.length

      if (records.length < pageLimit) break // last page

    } catch (e) {
      errors.push(`Fetch error at offset ${offset}: ${String(e).slice(0, 100)}`)
      break
    }
  }

  // Get current count in Supabase
  const countRes = await fetch(`${supabaseUrl}/rest/v1/hdb_transactions?select=count`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Prefer': 'count=exact',
      'Range': '0-0',
    },
    cache: 'no-store',
  })
  const contentRange = countRes.headers.get('content-range') || 'unknown'

  return NextResponse.json({
    success: errors.length === 0,
    totalFetched,
    totalUpserted,
    supabaseCount: contentRange,
    errors: errors.length > 0 ? errors : undefined,
  })
}
