import { HttpException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { readCalendarDayPatch, readCalendarPlan } from './teacher-calendar.js';

const numberedPlan = {
  version: 1,
  title: 'Aprender inglés',
  schedule: { kind: 'numbered', days: 30 },
};

function expectInvalid(read: () => unknown, field: string) {
  try {
    read();
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    if (!(error instanceof HttpException)) throw error;
    expect(error.getStatus()).toBe(400);
    expect(error.getResponse()).toMatchObject({
      code: 'calendar_invalid_input',
      field,
    });
    return;
  }
  throw new Error('Expected calendar validation to fail');
}

describe('study calendar plan policy', () => {
  it('maps dated rows to stable civil ordinals through a daylight saving transition', () => {
    const plan = readCalendarPlan(
      {
        ...numberedPlan,
        schedule: { kind: 'dated', start: '2024-04-06', end: '2024-04-08' },
        days: [
          { date: '2024-04-08', title: 'Tercera jornada' },
          { date: '2024-04-06', minutes: 30 },
        ],
      },
      undefined,
    );
    expect(plan.dayCount).toBe(3);
    expect(plan.days.map(({ ordinal }) => ordinal)).toEqual([1, 3]);
  });

  it('validates real leap days and the inclusive one-year bound', () => {
    const dated = {
      ...numberedPlan,
      schedule: { kind: 'dated', start: '2024-01-01', end: '2024-12-31' },
    };
    expect(readCalendarPlan(dated, undefined).dayCount).toBe(366);
    expectInvalid(
      () =>
        readCalendarPlan(
          { ...dated, schedule: { ...dated.schedule, end: '2025-01-01' } },
          undefined,
        ),
      'plan.schedule.end',
    );
    expectInvalid(
      () =>
        readCalendarPlan(
          { ...dated, schedule: { ...dated.schedule, start: '2024-02-30' } },
          undefined,
        ),
      'plan.schedule.start',
    );
    expect(
      readCalendarPlan(
        {
          ...dated,
          schedule: {
            ...dated.schedule,
            start: '0001-01-01',
            end: '0001-01-01',
          },
        },
        undefined,
      ).dayCount,
    ).toBe(1);
  });

  it('keeps sparse ordered activities and allows source-free practice', () => {
    const source = { label: 'Clase', url: 'https://example.org/lesson?q=1' };
    const plan = readCalendarPlan(
      {
        ...numberedPlan,
        days: [
          {
            day: 30,
            activities: [
              { text: ' Ver clase ', source },
              { text: 'Practicar' },
            ],
          },
        ],
      },
      undefined,
    );
    expect(plan).toMatchObject({
      dayCount: 30,
      days: [
        {
          ordinal: 30,
          title: null,
          minutes: null,
          activities: [{ text: 'Ver clase', source }, { text: 'Practicar' }],
        },
      ],
    });
  });

  it('rejects duplicate or incompatible day identifiers and imported completion', () => {
    expectInvalid(
      () =>
        readCalendarPlan(
          { ...numberedPlan, days: [{ day: 7 }, { day: 7 }] },
          undefined,
        ),
      'plan.days.1.day',
    );
    expectInvalid(
      () =>
        readCalendarPlan({ ...numberedPlan, days: [{ day: 31 }] }, undefined),
      'plan.days.0.day',
    );
    expectInvalid(
      () =>
        readCalendarPlan(
          { ...numberedPlan, days: [{ day: 7, date: '2025-04-01' }] },
          undefined,
        ),
      'plan.days.0',
    );
    expectInvalid(
      () =>
        readCalendarPlan(
          {
            ...numberedPlan,
            days: [{ day: 7, activities: [{ text: 'Leer', completed: true }] }],
          },
          undefined,
        ),
      'plan.days.0.activities.0',
    );
  });

  it('matches approved new categories by a normalized name but rejects unrelated names and duplicates', () => {
    const plan = { ...numberedPlan, categories: ['  Ｉnglés   técnico '] };
    expect(readCalendarPlan(plan, ['INGLÉS TÉCNICO']).categories).toEqual([
      { name: 'Inglés técnico', normalized_name: 'inglés técnico' },
    ]);
    expectInvalid(() => readCalendarPlan(plan, ['Idiomas']), 'new_categories');
    expectInvalid(
      () =>
        readCalendarPlan(
          { ...plan, categories: [...plan.categories, 'inglés técnico'] },
          undefined,
        ),
      'plan.categories',
    );
  });

  it.each([
    'http://example.org',
    'https://name:password@example.org',
    'https://example.org/f i l e',
    'https://example.org\\lesson',
  ])('rejects unsupported sources and identifies the activity field', (url) => {
    expectInvalid(
      () =>
        readCalendarPlan(
          {
            ...numberedPlan,
            days: [
              {
                day: 1,
                activities: [
                  { text: 'Leer', source: { label: 'Referencia', url } },
                ],
              },
            ],
          },
          undefined,
        ),
      'plan.days.0.activities.0.source.url',
    );
  });
});

describe('study calendar day patch policy', () => {
  const day = { revision: 1, title: null, notes: null, minutes: null };
  const existingId = 'a25d845f-a3ad-4b71-bb67-e17e2bb0d12e';

  it('retains activity identity and explicit personal progress', () => {
    expect(
      readCalendarDayPatch({
        ...day,
        activities: [
          {
            id: existingId.toUpperCase(),
            text: ' Ver lección ',
            completed: false,
          },
          { text: 'Practicar', completed: true },
        ],
      }),
    ).toEqual({
      ...day,
      activities: [
        { id: existingId, text: 'Ver lección', completed: false },
        { text: 'Practicar', completed: true },
      ],
    });
  });

  it('rejects aggregate completion and duplicate or ambiguous activity flags', () => {
    expectInvalid(
      () => readCalendarDayPatch({ ...day, completed: true, activities: [] }),
      'day',
    );
    expectInvalid(
      () =>
        readCalendarDayPatch({
          ...day,
          activities: [{ text: 'Leer', completed: 'false' }],
        }),
      'activities.0.completed',
    );
    expectInvalid(
      () =>
        readCalendarDayPatch({
          ...day,
          activities: [
            { id: existingId, text: 'Leer', completed: true },
            {
              id: existingId.toUpperCase(),
              text: 'Escribir',
              completed: false,
            },
          ],
        }),
      'activities.1.id',
    );
  });
});
