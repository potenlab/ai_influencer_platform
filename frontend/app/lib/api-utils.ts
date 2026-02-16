import { NextResponse } from 'next/server';

export function handleError(error: any) {
  if (error.message === 'Unauthorized') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (error.message === 'Admin access required') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  console.error('[API Error]', error?.message, error?.body || error?.status, JSON.stringify(error, Object.getOwnPropertyNames(error)).slice(0, 500));
  return NextResponse.json({ error: error.message || 'Internal Server Error', detail: error?.body?.detail || null }, { status: 500 });
}
