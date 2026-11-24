import {
  BadRequestException,
  HttpException,
  ValidationPipe,
} from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { CreateNodiaCvProfileDto } from '../dto/nodia-cv-profile.dto.js';
import { readNodiaCvProfile, withNodiaCvEntryIds } from './nodia-cv-profile.js';

const key = 'bbdc205f-8c03-49fb-9739-a4dbe61e0645';
const experience = '7841784a-42a4-4462-91cc-258ec32d79d4';
const other = '586e93a3-782e-4729-9195-ea04d28f5c6c';
const sample = {
  profile_name: '  Ingeniería ',
  full_name: 'Elena Muñoz',
  experiences: [
    {
      company: 'Taller Norte',
      position: 'Desarrolladora',
      start_month: '2024-04',
      end_month: '2026-02',
      technologies: [' C++ ', 'C#'],
    },
  ],
};

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

async function parse(profile: unknown): Promise<CreateNodiaCvProfileDto> {
  return pipe.transform(
    { request_key: key, profile },
    {
      metatype: CreateNodiaCvProfileDto,
      type: 'body',
    },
  );
}

describe('Nodia CV profile normalization and identity', () => {
  it('keeps precise dates, normalizes equivalents, and preserves source ordering', async () => {
    const a = readNodiaCvProfile((await parse(sample)).profile);
    const b = readNodiaCvProfile(
      (
        await parse({
          full_name: 'Elena Muñoz',
          profile_name: 'Ingeniería',
          contact: {},
          main_stack: [],
          experiences: [
            {
              technologies: ['C++', 'C#'],
              end_month: '2026-02',
              start_month: '2024-04',
              position: 'Desarrolladora',
              company: 'Taller Norte',
              highlights: [],
            },
          ],
        })
      ).profile,
    );
    expect(a.requestHash).toBe(b.requestHash);
    expect(a.profile.data.experiences[0]).toMatchObject({
      start_month: '2024-04',
      end_month: '2026-02',
      technologies: ['C++', 'C#'],
    });
  });

  it.each([
    {
      ...sample,
      experiences: [{ ...sample.experiences[0], start_month: '2025-13' }],
    },
    {
      ...sample,
      experiences: [{ ...sample.experiences[0], end_month: '2025-01-01' }],
    },
    {
      ...sample,
      experiences: [{ ...sample.experiences[0], owner_user_id: '42' }],
    },
    {
      ...sample,
      contact: { linkedin_url: 'https://user:secret@example.com/profile' },
    },
    { ...sample, full_name: 'Elena\u0000' },
    { ...sample, full_name: '\uD800' },
    { ...sample, full_name: '   ' },
    { ...sample, contact: null },
    { ...sample, experiences: [sample.experiences] },
    { ...sample, languages: Array(26).fill({ language: 'Inglés' }) },
  ])(
    'rejects malformed or unauthorized input before normalization',
    async (input) => {
      await expect(parse(input)).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it.each([
    {
      ...sample,
      experiences: [{ ...sample.experiences[0], status: 'current' }],
    },
    {
      ...sample,
      projects: [
        { name: 'Demo', start_month: '2026-01', end_month: '2025-12' },
      ],
    },
    {
      ...sample,
      education: [
        {
          title: 'Ingeniería',
          institution: 'Escuela',
          start_year: '2026',
          end_year: '2025',
        },
      ],
    },
  ])('rejects inconsistent date ranges', async (input) => {
    const validated = await parse(input);
    expect(() => readNodiaCvProfile(validated.profile)).toThrow(HttpException);
  });

  it('caps the aggregate by UTF-8 byte length as well as collection sizes', async () => {
    const validated = await parse({
      ...sample,
      languages: Array.from({ length: 25 }, () => ({
        language: 'Español',
        usage: 'ñ'.repeat(4000),
      })),
    });
    expect(() => readNodiaCvProfile(validated.profile)).toThrow(
      'profile_too_large',
    );
  });

  it('adds fresh IDs for a new profile and accepts only owned, unique IDs on edits', async () => {
    const input = readNodiaCvProfile((await parse(sample)).profile).profile
      .data;
    const first = withNodiaCvEntryIds(input, undefined, () => experience);
    const copy = withNodiaCvEntryIds(input, undefined, () => other);
    const existing = { ...input.experiences[0], id: experience };
    const edit = { ...input, experiences: [input.experiences[0], existing] };

    expect(copy.experiences[0].id).not.toBe(first.experiences[0].id);
    expect(
      withNodiaCvEntryIds(edit, first, () => other).experiences.map(
        ({ id }) => id,
      ),
    ).toEqual([other, experience]);
    expect(() => withNodiaCvEntryIds(edit, copy)).toThrow(
      'invalid_profile_entry',
    );
    expect(() => withNodiaCvEntryIds(edit)).toThrow('invalid_profile_entry');
    expect(() =>
      withNodiaCvEntryIds(
        { ...input, experiences: [existing, existing] },
        first,
      ),
    ).toThrow('invalid_profile_entry');
  });
});
