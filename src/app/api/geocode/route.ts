import { NextRequest, NextResponse } from 'next/server';
import {
  autocompleteAddresses,
  geocodeLocationWithFallback,
} from '@/lib/adapters/calendar-integrations';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') || '';
  const isAutocomplete =
    request.nextUrl.searchParams.get('autocomplete') === '1';

  if (isAutocomplete) {
    const suggestions = await autocompleteAddresses(q, 6);
    return NextResponse.json({ suggestions });
  }

  if (!q.trim()) {
    return NextResponse.json(
      { neighborhood: 'Location missing', coordinates: undefined },
      { status: 400 }
    );
  }

  const resolved = await geocodeLocationWithFallback(q);
  return NextResponse.json(resolved);
}
