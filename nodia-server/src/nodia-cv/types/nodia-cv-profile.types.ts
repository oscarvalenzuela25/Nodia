import type {
  CvAdditionalSectionDto,
  CvCertificationDto,
  CvContactDto,
  CvEducationDto,
  CvExperienceDto,
  CvLanguageDto,
  CvProjectDto,
  CvSkillAreaDto,
} from '../dto/nodia-cv-profile.dto.js';

export const NODIA_CV_ROUTE = '/nodia-cv';
export const NODIA_CV_CONTROLLER = 'nodia-cv';

export interface NodiaCvProfileData {
  second_title?: string;
  summary?: string;
  main_stack: string[];
  contact: CvContactDto;
  experiences: (CvExperienceDto & {
    id: string;
    highlights: string[];
    technologies: string[];
  })[];
  projects: (CvProjectDto & {
    id: string;
    contributions: string[];
    technologies: string[];
  })[];
  skill_areas: (CvSkillAreaDto & { id: string; skills: string[] })[];
  education: (CvEducationDto & { id: string })[];
  certifications: (CvCertificationDto & { id: string })[];
  languages: (CvLanguageDto & { id: string })[];
  additional_sections: (CvAdditionalSectionDto & {
    id: string;
    lines: string[];
  })[];
}

export interface NodiaCvProfileSummary {
  id: string;
  revision: number;
  schema_version: number;
  created_at: Date;
  updated_at: Date;
  profile_name: string;
  full_name: string;
  professional_title?: string;
}

export type NodiaCvProfileDetail = NodiaCvProfileSummary & NodiaCvProfileData;
