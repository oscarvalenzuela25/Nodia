export const CONTACT_DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;
export type ContactDay = (typeof CONTACT_DAYS)[number];
export interface ContactPhone {
  number: string;
}
export interface ContactTimeRange {
  from: string;
  to: string;
  description?: string;
}
export type ContactSchedule = Partial<Record<ContactDay, ContactTimeRange[]>>;
export interface ContactValues {
  name: string;
  phone: ContactPhone[];
  email: string | null;
  schedule: ContactSchedule;
  description: string | null;
  is_active: boolean;
}
