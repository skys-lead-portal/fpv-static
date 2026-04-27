/**
 * sync-hdb.mjs
 * Syncs recent HDB resale transactions from data.gov.sg into Supabase.
 * Run monthly: node scripts/sync-hdb.mjs
 * 
 * Fetches last ~18 months of data (offset-based pagination from tail of dataset)
 * and upserts into hdb_transactions table.
 */

// Keys loaded from env — copy .env.local before running
const DATA_GOV_KEY = process.env.DATA_GOV_SG_API_KEY || ''
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const RESOURCE_ID = 'd_8b84c4ee58e3cfc0ece0d773c8ca6abc'
const BATCH_SIZE = 1000  // records per upsert batch
const FETCH_LIMIT = 500  // data.gov.sg max per call
const RECORDS_TO_SYNC = 30000  // ~18 months of data (dataset grows ~3k/month)

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function getTotalCount() {
  const res = await fetch(
    `https://data.gov.sg/api/action/datastore_search?resource_id=${RESOURCE_ID}&limit=1`,
    { headers: { 'Authorization': DATA_GOV_KEY } }
  )
  const data = await res.json()
  return data.result?.total || 0
}

async function fetchPage(offset) {
  const url = `https://data.gov.sg/api/action/datastore_search?resource_id=${RESOURCE_ID}&limit=${FETCH_LIMIT}&offset=${offset}`
  const res = await fetch(url, { headers: { 'Authorization': DATA_GOV_KEY } })
  const data = await res.json()
  if (!data.success) {
    if (data.code === 24) throw new Error('RATE_LIMITED')
    throw new Error(`API error: ${JSON.stringify(data)}`)
  }
  return data.result?.records || []
}

async function upsertBatch(records) {
  const rows = records.map(r => ({
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

  const res = await fetch(`${SUPABASE_URL}/rest/v1/hdb_transactions`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Supabase error ${res.status}: ${err.slice(0, 200)}`)
  }
}

async function main() {
  console.log('🔄 Syncing HDB transactions...')
  
  // Get total count
  const total = await getTotalCount()
  console.log(`📊 Total records in dataset: ${total.toLocaleString()}`)
  
  // Calculate start offset (fetch last RECORDS_TO_SYNC records)
  const startOffset = Math.max(0, total - RECORDS_TO_SYNC)
  console.log(`📥 Fetching from offset ${startOffset.toLocaleString()} to ${total.toLocaleString()}`)
  
  let buffer = []
  let fetched = 0
  let upserted = 0
  
  for (let offset = startOffset; offset < total; offset += FETCH_LIMIT) {
    try {
      const records = await fetchPage(offset)
      if (!records.length) break
      
      buffer.push(...records)
      fetched += records.length
      
      // Upsert in batches
      while (buffer.length >= BATCH_SIZE) {
        const batch = buffer.splice(0, BATCH_SIZE)
        await upsertBatch(batch)
        upserted += batch.length
        process.stdout.write(`\r  ✓ Fetched: ${fetched.toLocaleString()} | Upserted: ${upserted.toLocaleString()}`)
      }
      
      // Polite delay to avoid rate limiting
      await sleep(200)
      
    } catch (err) {
      if (err.message === 'RATE_LIMITED') {
        console.log('\n⏳ Rate limited, waiting 15s...')
        await sleep(15000)
        offset -= FETCH_LIMIT  // retry this offset
      } else {
        throw err
      }
    }
  }
  
  // Flush remaining
  if (buffer.length > 0) {
    await upsertBatch(buffer)
    upserted += buffer.length
  }
  
  console.log(`\n✅ Done! Synced ${upserted.toLocaleString()} records`)
  
  // Check what we have
  const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/hdb_transactions?select=count`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'count=exact',
      'Range': '0-0',
    }
  })
  const countHeader = checkRes.headers.get('content-range')
  console.log(`📊 Total in Supabase: ${countHeader}`)
}

main().catch(err => {
  console.error('❌ Sync failed:', err.message)
  process.exit(1)
})
