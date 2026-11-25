import { createHash, randomUUID } from 'node:crypto';
import {
  CV_PROFILE_MAX_BYTES,
  type NodiaCvProfileInputDto,
} from '../dto/nodia-cv-profile.dto.js';
import type { NodiaCvProfileData } from '../types/nodia-cv-profile.types.js';
import { nodiaCvProfileError } from './nodia-cv-profile-errors.js';

function checkDates(
  field: string,
  start: string | undefined,
  end: string | undefined,
  current = false,
) {
  if (end && (current || (start && end < start))) {
    nodiaCvProfileError('invalid_profile_dates', field);
  }
}

function normalizedFields<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, field]) => field !== undefined && field !== '',
    ),
  ) as T;
}

/** Called after DTO validation. Only arrays are ordered as entered by the user. */
export function readNodiaCvProfile(input: NodiaCvProfileInputDto) {
  for (const [index, job] of (input.experiences ?? []).entries()) {
    checkDates(
      `experiences.${index}.end_month`,
      job.start_month,
      job.end_month,
      job.status === 'current',
    );
  }
  for (const [index, project] of (input.projects ?? []).entries()) {
    checkDates(
      `projects.${index}.end_month`,
      project.start_month,
      project.end_month,
    );
  }
  for (const [index, study] of (input.education ?? []).entries()) {
    checkDates(`education.${index}.end_year`, study.start_year, study.end_year);
  }

  const {
    profile_name,
    full_name,
    professional_title,
    second_title,
    summary,
    main_stack,
    contact,
    experiences,
    projects,
    skill_areas,
    education,
    certifications,
    languages,
    additional_sections,
  } = input;
  const profile = {
    profile_name,
    full_name,
    professional_title: professional_title || null,
    data: normalizedFields({
      second_title,
      summary,
      main_stack: main_stack ?? [],
      contact: normalizedFields(contact ?? {}),
      experiences: (experiences ?? []).map((row) =>
        normalizedFields({
          ...row,
          highlights: row.highlights ?? [],
          technologies: row.technologies ?? [],
        }),
      ),
      projects: (projects ?? []).map((row) =>
        normalizedFields({
          ...row,
          contributions: row.contributions ?? [],
          technologies: row.technologies ?? [],
        }),
      ),
      skill_areas: (skill_areas ?? []).map((row) =>
        normalizedFields({ ...row, skills: row.skills ?? [] }),
      ),
      education: (education ?? []).map(normalizedFields),
      certifications: (certifications ?? []).map(normalizedFields),
      languages: (languages ?? []).map(normalizedFields),
      additional_sections: (additional_sections ?? []).map((row) =>
        normalizedFields({ ...row, lines: row.lines ?? [] }),
      ),
    }),
  };

  const canonical = JSON.stringify(profile, (_key, value: unknown) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(
          Object.entries(value).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0,
          ),
        )
      : value,
  );
  if (Buffer.byteLength(canonical, 'utf8') > CV_PROFILE_MAX_BYTES) {
    nodiaCvProfileError('profile_too_large');
  }
  return {
    profile,
    requestHash: createHash('sha256').update(canonical).digest('hex'),
  };
}

export type NormalizedNodiaCvProfile = ReturnType<
  typeof readNodiaCvProfile
>['profile'];

function assignIds<T extends { id?: string }>(
  rows: readonly T[],
  previousRows: readonly { id: string }[],
  field: string,
  newId: () => string,
): (T & { id: string })[] {
  const availableIds = new Set(previousRows.map(({ id }) => id));
  return rows.map((row, index) => {
    const id = row.id?.toLowerCase();
    if (id && !availableIds.delete(id)) {
      nodiaCvProfileError('invalid_profile_entry', `${field}.${index}.id`);
    }
    return { ...row, id: id ?? newId() };
  });
}

export function withNodiaCvEntryIds(
  data: NormalizedNodiaCvProfile['data'],
  previous?: NodiaCvProfileData,
  newId = randomUUID,
): NodiaCvProfileData {
  return {
    ...data,
    experiences: assignIds(
      data.experiences,
      previous?.experiences ?? [],
      'experiences',
      newId,
    ),
    projects: assignIds(
      data.projects,
      previous?.projects ?? [],
      'projects',
      newId,
    ),
    skill_areas: assignIds(
      data.skill_areas,
      previous?.skill_areas ?? [],
      'skill_areas',
      newId,
    ),
    education: assignIds(
      data.education,
      previous?.education ?? [],
      'education',
      newId,
    ),
    certifications: assignIds(
      data.certifications,
      previous?.certifications ?? [],
      'certifications',
      newId,
    ),
    languages: assignIds(
      data.languages,
      previous?.languages ?? [],
      'languages',
      newId,
    ),
    additional_sections: assignIds(
      data.additional_sections,
      previous?.additional_sections ?? [],
      'additional_sections',
      newId,
    ),
  };
}
