import { z } from 'zod';

export type Mode = 'month' | 'year' | 'all' | 'custom';
export type Month = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type Scope =
  | { mode: 'month'; year: number; month: Month }
  | { mode: 'year'; year: number }
  | { mode: 'all' }
  | { mode: 'custom'; startISO: string; endISO: string };

const isoDate = z.string().refine((d) => !isNaN(Date.parse(d)), {
  message: 'Invalid date',
});

export function scopeToRange(scope: Scope): { start: number; end: number } {
  switch (scope.mode) {
    case 'month': {
      const start = new Date(scope.year, scope.month - 1, 1).getTime();
      const end = new Date(scope.year, scope.month, 1).getTime();
      return { start, end };
    }
    case 'year': {
      const start = new Date(scope.year, 0, 1).getTime();
      const end = new Date(scope.year + 1, 0, 1).getTime();
      return { start, end };
    }
    case 'all': {
      return { start: 0, end: Date.now() };
    }
    case 'custom': {
      const schema = z
        .object({ startISO: isoDate, endISO: isoDate })
        .refine(
          (s) => new Date(s.startISO).getTime() <= new Date(s.endISO).getTime(),
          { message: 'start must be before end' }
        );
      const { startISO, endISO } = schema.parse(scope);
      return {
        start: new Date(startISO).getTime(),
        end: new Date(endISO).getTime(),
      };
    }
  }
}
