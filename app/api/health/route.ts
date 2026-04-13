import { NextResponse } from 'next/server'

export async function GET() {
  const checks: Record<string, boolean> = {
    supabase: false,
    twilio: false,
  }

  // Check Supabase
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (url && key) {
      const res = await fetch(`${url}/rest/v1/lead_sources?id=eq.5e434bf3-db09-4b18-98ee-4aa33dcb1ffe&select=id&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      })
      checks.supabase = res.ok
    }
  } catch { checks.supabase = false }

  // Check Twilio creds exist
  checks.twilio = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)

  const allOk = Object.values(checks).every(Boolean)

  return NextResponse.json({
    status: allOk ? 'ok' : 'degraded',
    checks,
    ts: new Date().toISOString(),
  }, { status: allOk ? 200 : 503 })
}
