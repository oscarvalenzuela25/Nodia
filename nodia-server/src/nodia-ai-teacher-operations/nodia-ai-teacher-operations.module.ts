import { Module } from '@nestjs/common';
import { TeacherModule } from '../teacher/teacher.module.js';
import { TeacherCalendarUseCase } from '../teacher/use-case/teacher-calendar.use-case.js';
import { TeacherFlashcardsUseCase } from '../teacher/use-case/teacher-flashcards.use-case.js';
import { compiledNodiaAiCapabilityIds } from '../nodia-ai-products/nodia-ai-product-reads.module.js';
import {
  calendarReadCandidates,
  calendarWriteCandidates,
} from './calendar-operations.js';
import {
  flashcardReadCandidates,
  flashcardWriteCandidates,
} from './flashcard-operations.js';
import {
  loadTeacherToolContracts,
  loadTeacherToolSchemaSource,
  teacherSchemaReference,
} from './teacher-contracts.js';
import { TeacherProposalOperation } from './teacher-proposal-operation.js';
import {
  NODIA_AI_TEACHER_OPERATIONS,
  NODIA_AI_TEACHER_READS,
} from './types.js';

export function buildTeacherProposalOperations(
  calendar: TeacherCalendarUseCase,
  flashcards: TeacherFlashcardsUseCase,
) {
  const schema = loadTeacherToolSchemaSource();
  const contracts = loadTeacherToolContracts();
  const candidates = [
    ...calendarWriteCandidates(calendar),
    ...flashcardWriteCandidates(flashcards),
  ];
  const names = new Set(candidates.map(({ toolName }) => toolName));
  if (
    names.size !== candidates.length ||
    [...contracts.values()].some(
      (contract) =>
        contract.kind === 'prepare_change' && !names.has(contract.toolName),
    )
  )
    throw new Error('nodia_ai:invalid_teacher_contract');
  return candidates.map((candidate) => {
    const contract = contracts.get(candidate.toolName);
    if (!contract || contract.kind !== 'prepare_change')
      throw new Error('nodia_ai:invalid_teacher_contract');
    return new TeacherProposalOperation(
      candidate,
      teacherSchemaReference(schema, contract.inputSchema),
    );
  });
}

@Module({
  imports: [TeacherModule],
  providers: [
    {
      provide: NODIA_AI_TEACHER_READS,
      inject: [TeacherCalendarUseCase, TeacherFlashcardsUseCase],
      useFactory: (
        calendar: TeacherCalendarUseCase,
        flashcards: TeacherFlashcardsUseCase,
      ) => [
        ...calendarReadCandidates(calendar),
        ...flashcardReadCandidates(flashcards),
      ],
    },
    {
      provide: NODIA_AI_TEACHER_OPERATIONS,
      inject: [TeacherCalendarUseCase, TeacherFlashcardsUseCase],
      useFactory: (
        calendar: TeacherCalendarUseCase,
        flashcards: TeacherFlashcardsUseCase,
      ) => {
        const published = new Set(compiledNodiaAiCapabilityIds());
        const writes = [...loadTeacherToolContracts().values()].filter(
          (contract) =>
            contract.kind === 'prepare_change' &&
            published.has(contract.toolName),
        );
        if (!writes.length) return [];
        const writeNames = new Set(writes.map((contract) => contract.toolName));
        return buildTeacherProposalOperations(calendar, flashcards).filter(
          (operation) => writeNames.has(operation.toolName),
        );
      },
    },
  ],
  exports: [NODIA_AI_TEACHER_OPERATIONS, NODIA_AI_TEACHER_READS],
})
export class NodiaAiTeacherOperationsModule {}
