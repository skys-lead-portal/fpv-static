import json, urllib.request, time, sys

URA_KEY = "${URA_ACCESS_KEY}"
SUPABASE_URL = "${SUPABASE_URL}"
SUPABASE_KEY = "${SUPABASE_SERVICE_ROLE_KEY}"
BATCH_SIZE = 1000

def ura_get(url, headers):
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read()
    if raw.startswith(b'\xef\xbb\xbf'):
        raw = raw[3:]
    return json.loads(raw.decode('utf-8'))

def get_token():
    d = ura_get("https://eservice.ura.gov.sg/uraDataService/insertNewToken/v1",
                {"AccessKey": URA_KEY})
    if d.get("Status") != "Success" and not d.get("Result"):
        raise Exception(f"Token failed: {d}")
    return d["Result"]

def fetch_batch(token, batch_num):
    d = ura_get(
        f"https://eservice.ura.gov.sg/uraDataService/invokeUraDS/v1?service=PMI_Resi_Transaction&batch={batch_num}",
        {"AccessKey": URA_KEY, "Token": token}
    )
    if d.get("Status") != "Success":
        raise Exception(f"Batch {batch_num} failed: {d.get('Message')}")
    return d.get("Result", [])

def flatten(projects):
    rows = []
    for p in projects:
        for t in p.get("transaction", []):
            try:
                rows.append({
                    "project": (p.get("project") or "").strip(),
                    "street": (p.get("street") or "").strip(),
                    "market_segment": p.get("marketSegment", ""),
                    "x": str(p.get("x", "")),
                    "y": str(p.get("y", "")),
                    "contract_date": t.get("contractDate", ""),
                    "area": float(t.get("area") or 0),
                    "price": float(t.get("price") or 0),
                    "property_type": t.get("propertyType", ""),
                    "type_of_area": t.get("typeOfArea", ""),
                    "tenure": t.get("tenure", ""),
                    "floor_range": t.get("floorRange", ""),
                    "type_of_sale": str(t.get("typeOfSale", "")),
                    "district": str(t.get("district", "")),
                    "no_of_units": int(t.get("noOfUnits") or 1),
                })
            except Exception as e:
                pass
    return rows

def upsert(rows):
    data = json.dumps(rows).encode("utf-8")
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/ura_transactions?on_conflict=project,contract_date,area,price,floor_range,type_of_sale",
        data=data,
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=ignore-duplicates,return=minimal",
        },
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status

print("Getting URA token...")
token = get_token()
print(f"Token: {token[:20]}...")

total = 0
for batch_num in [1, 2, 3, 4]:
    print(f"\nFetching batch {batch_num}...")
    try:
        projects = fetch_batch(token, batch_num)
        rows = flatten(projects)
        print(f"  {len(projects)} projects → {len(rows)} transactions")

        for i in range(0, len(rows), BATCH_SIZE):
            chunk = rows[i:i+BATCH_SIZE]
            upsert(chunk)
            total += len(chunk)
            print(f"  Upserted: {total:,}", flush=True)

        print(f"  Batch {batch_num} complete")
    except Exception as e:
        print(f"  Batch {batch_num} error: {e}")
    time.sleep(1)

print(f"\nDone. Total: {total:,} records")
