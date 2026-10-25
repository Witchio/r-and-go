import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    geminiConfigured: Boolean(
      process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 5
    ),
    geminiModel: process.env.GEMINI_MODEL_ID || 'gemini-2.5-flash',
    googleMapsConfigured: Boolean(
      process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    ),
    googleCalendarConfigured: Boolean(process.env.GOOGLE_CALENDAR_ACCESS_TOKEN),
    googleClientId:
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
      process.env.GOOGLE_CLIENT_ID ||
      '',
  });
}
