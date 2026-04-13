import { NextResponse } from 'next/server'

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  // Extract project ref from URL (e.g. https://xyzxyz.supabase.co → xyzxyz)
  const projectRef = supabaseUrl.replace('https://', '').split('.')[0] || 'unknown'

  const checks: Record<string, string | boolean> = {
    supabase_project: projectRef,
    supabase: false,
    twilio: false,
  }

  try {
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (supabaseUrl && key) {
      const res = await fetch(`${supabaseUrl}/rest/v1/lead_sources?id=eq.5e434bf3-db09-4b18-98ee-4aa33dcb1ffe&select=id&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      })
      checks.supabase = res.ok
    }
  } catch { checks.supabase = false }

  checks.twilio = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)

  const allOk = checks.supabase === true && checks.twilio === true

  return NextResponse.json({
    status: allOk ? 'ok' : 'degraded',
    checks,
    ts: new Date().toISOString(),
  }, { status: allOk ? 200 : 503 })
}
