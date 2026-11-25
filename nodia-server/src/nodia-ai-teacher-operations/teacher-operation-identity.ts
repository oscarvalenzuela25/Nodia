const operations = {
  teacher_calendars: ['create', 'update', 'delete'],
  teacher_calendar_days: ['update'],
  teacher_calendar_activities: ['set_completion'],
  teacher_calendar_categories: ['create', 'update'],
  teacher_flashcard_decks: ['create'],
  teacher_flashcards: ['create', 'update', 'delete'],
  teacher_flashcard_imports: ['create'],
  teacher_flashcard_reviews: ['create'],
} as const;

type TeacherResourceKey = keyof typeof operations;
type TeacherOperationKey = (typeof operations)[TeacherResourceKey][number];

type TeacherOperationIdentity = Readonly<{
  family: 'teacher';
  idKind: 'uuid';
  resourceKey: TeacherResourceKey;
  operation: TeacherOperationKey;
}>;

const identities = new Map<string, TeacherOperationIdentity>(
  Object.entries(operations).flatMap(([resourceKey, values]) =>
    values.map(
      (operation) =>
        [
          `nodia_${resourceKey}_prepare_${operation}`,
          {
            family: 'teacher' as const,
            idKind: 'uuid' as const,
            resourceKey: resourceKey as TeacherResourceKey,
            operation: operation as TeacherOperationKey,
          },
        ] as const,
    ),
  ),
);

export function nodiaAiTeacherOperationIdentity(name: string) {
  return identities.get(name) ?? null;
}
