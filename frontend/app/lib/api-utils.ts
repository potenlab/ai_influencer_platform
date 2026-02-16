import { NextResponse } from 'next/server';

export function handleError(error: any) {
  if (error.message === 'Unauthorized') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (error.message === 'Admin access required') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  console.error(error);
  return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
}
