import { NextRequest, NextResponse } from 'next/server';
import { runConflictInvestigation } from '@/lib/adapters/argon';
import { CalendarEvent, TravelMode } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      conflictId: string;
      events: CalendarEvent[];
      selectedModes?: Record<string, TravelMode>;
      bufferMinutes?: number;
    };

    if (!body.conflictId || !Array.isArray(body.events)) {
      return NextResponse.json(
        { error: 'Missing required conflictId or events array' },
        { status: 400 }
      );
    }

    const investigation = await runConflictInvestigation({
      conflictId: body.conflictId,
      events: body.events,
      selectedModes: body.selectedModes || {},
      bufferMinutes: body.bufferMinutes ?? 5,
    });

    return NextResponse.json({ investigation });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Unexpected error during Argon conflict investigation',
      },
      { status: 500 }
    );
  }
}
