'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  History,
  RotateCcw,
} from 'lucide-react';
import {
  TODAY_DATE_ISO,
  formatDateHeading,
  isPastDateIso,
  shiftDateIso,
} from '@/lib/playback/day-history';

export interface DayNavigatorBarProps {
  selectedDateIso: string;
  selectedDateFilter?: string;
  todayDateIso?: string;
  daySubtitle?: string;
  eventsCount: number;
  eventCountsByDate?: Record<string, number>;
  totalSourceEventsCount?: number;
  isConnectedCalendar?: boolean;
  isResyncing?: boolean;
  onSelectDateIso: (newDateIso: string) => void;
  onSelectAllDates?: () => void;
  onResync?: () => void;
  bufferMinutes?: number;
  onChangeBufferMinutes?: (buffer: number) => void;
  onAddEventClick?: () => void;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function parseYearMonth(dateIso: string): { year: number; month: number } {
  const parts = dateIso.split('-').map(Number);
  if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
    return { year: parts[0], month: parts[1] - 1 };
  }
  return { year: 2026, month: 9 }; // October 2026
}

/**
 * Unified single-button Calendar & Date Picker Bar.
 * Clicking the main calendar button pops up an interactive month calendar highlighting
 * available dates with events. Removes the Buffer and +Event clutter and replaces
 * the separate "Show:" dropdown bar.
 */
export function DayNavigatorBar({
  selectedDateIso,
  selectedDateFilter,
  todayDateIso = TODAY_DATE_ISO,
  eventsCount,
  eventCountsByDate = {},
  totalSourceEventsCount,
  isConnectedCalendar = false,
  isResyncing = false,
  onSelectDateIso,
  onSelectAllDates,
  onResync,
}: DayNavigatorBarProps) {
  const isViewingAllDates =
    Boolean(isConnectedCalendar && selectedDateFilter === 'ALL');
  const [isOpen, setIsOpen] = useState(false);
  const [{ year, month }, setViewYearMonth] = useState(() =>
    parseYearMonth(selectedDateIso)
  );
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setViewYearMonth(parseYearMonth(selectedDateIso));
  }, [selectedDateIso]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const isPast = isPastDateIso(selectedDateIso, todayDateIso);

  const calendarCells = useMemo(() => {
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ day: number | null; dateIso: string | null }> = [];

    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({ day: null, dateIso: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      cells.push({ day: d, dateIso: `${year}-${mStr}-${dStr}` });
    }
    return cells;
  }, [year, month]);

  const handleStepMonth = (delta: number) => {
    setViewYearMonth((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  return (
    <div ref={containerRef} className="relative mb-3 space-y-2">
      <div className="flex items-center justify-between gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50/80 px-2 py-1.5">
        {/* Previous Day Step */}
        <button
          type="button"
          onClick={() => onSelectDateIso(shiftDateIso(selectedDateIso, -1))}
          title="Previous day"
          aria-label="Previous day"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-slate-900 hover:shadow-2xs transition-all cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Single Unified Calendar Popover Trigger Button */}
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          aria-expanded={isOpen}
          aria-label="Open calendar date picker"
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-white px-3 py-1.5 text-left shadow-2xs border border-slate-200/80 hover:border-indigo-300 transition-all cursor-pointer min-w-0"
        >
          <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
          <span className="truncate text-[13px] font-bold tracking-tight text-slate-900">
            {formatDateHeading(selectedDateIso)}
          </span>
          <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
            {eventsCount} {eventsCount === 1 ? 'event' : 'events'}
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Next Day Step */}
        <button
          type="button"
          onClick={() => onSelectDateIso(shiftDateIso(selectedDateIso, 1))}
          title="Next day"
          aria-label="Next day"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-slate-900 hover:shadow-2xs transition-all cursor-pointer"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Optional Re-sync Icon Button for Connected Calendars */}
        {isConnectedCalendar && onResync && (
          <button
            type="button"
            disabled={isResyncing}
            onClick={onResync}
            title="Re-sync events from Google Calendar"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
          >
            <RotateCcw
              className={`h-3.5 w-3.5 ${isResyncing ? 'animate-spin' : ''}`}
            />
          </button>
        )}
      </div>

      {/* Interactive Popup Calendar */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-11 z-40 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_16px_40px_rgba(15,23,42,0.16)] space-y-3">
          {/* Month Header & Controls */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => handleStepMonth(-1)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
              title="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-slate-900">
                {MONTH_NAMES[month]} {year}
              </span>
              <button
                type="button"
                onClick={() => {
                  onSelectDateIso(todayDateIso);
                  setIsOpen(false);
                }}
                className="rounded-md bg-slate-100 hover:bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700 cursor-pointer"
              >
                Today
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleStepMonth(1)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
              title="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-extrabold uppercase text-slate-400">
            {WEEKDAYS.map((wd) => (
              <div key={wd} className="py-0.5">
                {wd}
              </div>
            ))}
          </div>

          {/* Days Grid with Event Count Below Each Date */}
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell, idx) => {
              if (!cell.day || !cell.dateIso) {
                return <div key={`empty-${idx}`} className="h-11" />;
              }
              const count = eventCountsByDate[cell.dateIso] || 0;
              const isSelected = cell.dateIso === selectedDateIso;
              const isToday = cell.dateIso === todayDateIso;

              return (
                <button
                  key={cell.dateIso}
                  type="button"
                  onClick={() => {
                    onSelectDateIso(cell.dateIso!);
                    setIsOpen(false);
                  }}
                  title={`${cell.dateIso}: ${count} ${
                    count === 1 ? 'event' : 'events'
                  }`}
                  className={`relative flex h-11 flex-col items-center justify-center rounded-xl py-1 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : count > 0
                      ? 'bg-indigo-50/90 text-indigo-950 border border-indigo-200/90 hover:bg-indigo-100'
                      : isToday
                      ? 'border border-slate-300 text-slate-900 hover:bg-slate-100'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span
                    className={`text-xs leading-none ${
                      isSelected || count > 0 || isToday
                        ? 'font-extrabold'
                        : 'font-semibold'
                    }`}
                  >
                    {cell.day}
                  </span>
                  <span
                    className={`mt-1 text-[9px] leading-none font-bold ${
                      isSelected
                        ? 'text-indigo-100'
                        : count > 0
                        ? 'text-indigo-600 font-extrabold'
                        : 'text-slate-300'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Historical Provenance Notice (Only shown when viewing a past date) */}
      {isPast && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-1.5 text-[11px] text-amber-900">
          <History className="h-3.5 w-3.5 shrink-0 text-amber-700" />
          <span className="leading-snug">
            <strong className="font-semibold">Past-Day Replay:</strong> Routes
            reflect reconstructed estimates; overdue departure alerts are muted.
          </span>
        </div>
      )}
    </div>
  );
}
