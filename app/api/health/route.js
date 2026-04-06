import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const analyzeProvider = process.env.ALEM_API_KEY
    ? 'alem'
    : process.env.ANTHROPIC_API_KEY
      ? 'anthropic'
      : 'mock';

  const analyzeModel = analyzeProvider === 'alem'
    ? (process.env.ALEM_MODEL || 'qwen3')
    : analyzeProvider === 'anthropic'
      ? (process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest')
      : 'mock-triage';

  return NextResponse.json({
    ok: true,
    runtime: 'next-app-router',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.round(process.uptime()),
    analyze_provider: analyzeProvider,
    analyze_model: analyzeModel,
  });
}
