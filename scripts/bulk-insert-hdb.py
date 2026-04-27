import csv, json, urllib.request, time

SUPABASE_URL = "${SUPABASE_URL}"
SUPABASE_KEY = "${SUPABASE_SERVICE_ROLE_KEY}"
CSV_FILE = "/tmp/hdb_full.csv"
BATCH_SIZE = 2000

def upsert_batch(rows):
    data = json.dumps(rows).encode('utf-8')
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/hdb_transactions?on_conflict=month,block,street_name,flat_type,storey_range,resale_price",
        data=data,
        headers={
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': 'application/json',
            'Prefer': 'resolution=ignore-duplicates,return=minimal',
        },
        method='POST'
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.status

total = 0
batch = []
errors = 0

with open(CSV_FILE, 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        batch.append({
            'month': row['month'],
            'town': row['town'],
            'flat_type': row['flat_type'],
            'block': row['block'],
            'street_name': row['street_name'],
            'storey_range': row['storey_range'],
            'floor_area_sqm': row['floor_area_sqm'],
            'flat_model': row['flat_model'],
            'lease_commence_date': row['lease_commence_date'],
            'remaining_lease': row['remaining_lease'],
            'resale_price': float(row['resale_price']),
        })
        if len(batch) >= BATCH_SIZE:
            try:
                upsert_batch(batch)
                total += len(batch)
                print(f"  Inserted: {total:,}", flush=True)
            except Exception as e:
                errors += 1
                print(f"  Error at {total}: {e}")
                time.sleep(2)
            batch = []

if batch:
    try:
        upsert_batch(batch)
        total += len(batch)
        print(f"  Inserted: {total:,}", flush=True)
    except Exception as e:
        errors += 1
        print(f"  Final batch error: {e}")

print(f"Done! Total: {total:,} | Errors: {errors}")
