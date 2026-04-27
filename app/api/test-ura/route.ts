import { NextResponse } from 'next/server'

export async function GET() {
  const accessKey = process.env.URA_ACCESS_KEY || ''

  if (!accessKey) {
    return NextResponse.json({ error: 'URA_ACCESS_KEY not set in env' })
  }

  // Step 1: Generate token
  const tokenRes = await fetch(
    `https://eservice.ura.gov.sg/API/RPT/ApplicationMgt/GenerateToken?accesskey=${accessKey}`,
    { cache: 'no-store' }
  )
  const tokenText = await tokenRes.text()
  let tokenData: Record<string, unknown> = {}
  try { tokenData = JSON.parse(tokenText) } catch { tokenData = { raw: tokenText.slice(0, 300) } }

  const token = (tokenData as { Result?: string }).Result
  if (!token) {
    return NextResponse.json({
      step: 'token_generation',
      status: tokenRes.status,
      response: tokenData,
      keyPrefix: accessKey.slice(0, 8) + '...',
    })
  }

  // Step 2: Fetch one batch of private residential transactions
  const txnRes = await fetch(
    'https://eservice.ura.gov.sg/API/RPT/PMI/GetPrivateResiTransaction?batch=1',
    {
      headers: {
        AccessKey: accessKey,
        Token: token,
      },
      cache: 'no-store',
    }
  )
  const txnText = await txnRes.text()
  let txnData: Record<string, unknown> = {}
  try { txnData = JSON.parse(txnText) } catch { txnData = { raw: txnText.slice(0, 500) } }

  // Show sample of what the data looks like
  const results = (txnData as { Result?: unknown[] }).Result
  const sample = Array.isArray(results) ? results.slice(0, 2) : null

  return NextResponse.json({
    step: 'full_test',
    tokenOk: true,
    txnStatus: txnRes.status,
    txnSuccess: (txnData as { Status?: string }).Status,
    totalProjects: Array.isArray(results) ? results.length : 0,
    sampleProject: sample,
  })
}
