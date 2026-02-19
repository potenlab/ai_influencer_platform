import { NextResponse } from 'next/server';

export function handleError(error: unknown) {
  const err = error instanceof Error ? error : new Error(String(error));
  const errAny = error as Record<string, unknown>;
  if (err.message === 'Unauthorized') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (err.message === 'Admin access required') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  console.error('[API Error]', err.message, errAny?.body || errAny?.status, JSON.stringify(error, Object.getOwnPropertyNames(err)).slice(0, 500));
  const detail = typeof errAny?.body === 'object' && errAny.body !== null ? (errAny.body as Record<string, unknown>).detail : null;
  return NextResponse.json({ error: err.message || 'Internal Server Error', detail: detail || null }, { status: 500 });
}
