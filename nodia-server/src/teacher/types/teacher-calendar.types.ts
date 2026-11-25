export const calendarColors = ['violet', 'green', 'blue', 'amber'] as const;
export type CalendarColor = (typeof calendarColors)[number];
export const calendarPlanStatuses = ['all', 'active', 'inactive'] as const;
export type CalendarPlanStatus = (typeof calendarPlanStatuses)[number];

export type CalendarSchedule =
  | { kind: 'numbered'; days: number }
  | { kind: 'dated'; start: string; end: string };

export interface CalendarCategory {
  id: string;
  name: string;
  color: CalendarColor;
  active: boolean;
}

export interface CalendarSource {
  label: string;
  url: string;
}

export interface CalendarActivity {
  id: string;
  text: string;
  source?: CalendarSource;
  completed: boolean;
}

export interface CalendarDaySummary {
  id: string;
  ordinal: number;
  date: string | null;
  title: string | null;
  minutes: number | null;
  activity_count: number;
  completed_activity_count: number;
  completed: boolean;
}

export interface CalendarDayDetail extends CalendarDaySummary {
  notes: string | null;
  revision: number;
  activities: CalendarActivity[];
}

export interface CalendarPlanSummary {
  id: string;
  title: string;
  active: boolean;
  schedule: CalendarSchedule;
  categories: CalendarCategory[];
  day_count: number;
  completed_count: number;
}

export interface CalendarPlanDetail extends CalendarPlanSummary {
  days: CalendarDaySummary[];
}

export interface CalendarPlanPage {
  data: CalendarPlanSummary[];
  meta: { page: number; total_pages: number; total: number };
}

export type CalendarCategoryName = {
  name: string;
  normalized_name: string;
};

export type CalendarDayFields = Pick<
  CalendarDayDetail,
  'title' | 'notes' | 'minutes'
>;

export type CalendarImportedActivity = Pick<
  CalendarActivity,
  'text' | 'source'
>;

export type CalendarDayWrite = CalendarDayFields & {
  revision: number;
  activities: (Omit<CalendarActivity, 'id'> & { id?: string })[];
};

export type CalendarImportedDay = CalendarDayFields & {
  ordinal: number;
  activities: CalendarImportedActivity[];
};

export interface CalendarPlanWrite {
  title: string;
  categories: CalendarCategoryName[];
  schedule: CalendarSchedule;
  dayCount: number;
  days: CalendarImportedDay[];
  newCategories: CalendarCategoryName[];
}

export type CalendarPlanPatch = Partial<
  Pick<CalendarPlanSummary, 'title' | 'active'>
> & { category_ids?: string[] };
