// Internal, explicit operator probe. This script never starts a provider client.
// The normal worker takes a new probe through the same ownership and POST budget.
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parseFlashcardImageQualificationArgs } from './teacher-flashcard-image-qualification-args.mjs';

let source;
let args;
try {
  args = parseFlashcardImageQualificationArgs(process.argv.slice(2));
} catch {
  console.error(
    'Provide --user-id, --auth-session-public-id, --connection-id, --model-id and exactly one of --probe-request-key, --inspect-operation-id or --accept-operation-id. Optional --effort-id selects an exact effort.',
  );
  process.exitCode = 2;
}

if (args) {
  try {
    const { AssertNodiaAiOperationModeUseCase } =
      await import('../dist/nodia-ai-runtime/use-case/assert-nodia-ai-operation-mode.use-case.js');
    new AssertNodiaAiOperationModeUseCase().execute(process.env);
    ({ default: source } = await import('../dist/config/data-source.js'));
    const { CheckModuleAccessUseCase } =
      await import('../dist/authorization/use-case/check-module-access.use-case.js');
    const { TeacherService } =
      await import('../dist/teacher/teacher.service.js');
    const { hash, teacherError } =
      await import('../dist/teacher/policies/teacher-validation.js');
    const { ApiNodiaAiCredentialsService } =
      await import('../dist/nodia-ai-adapter/api-nodia-ai-credentials.service.js');
    const { ApiTextGenerationService } =
      await import('../dist/ai-generation/api-text-generation.service.js');
    const { FlashcardLibraryStore } =
      await import('../dist/ai-generation/flashcard-library.store.js');
    const { FlashcardLibraryTransport, FLASHCARD_IMAGE_QUALIFICATION_PROMPT } =
      await import('../dist/ai-generation/flashcard-library-transport.service.js');
    const { ValidateNodiaAiRuntimePolicyUseCase } =
      await import('../dist/nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case.js');

    const policy = new ValidateNodiaAiRuntimePolicyUseCase().execute(
      JSON.parse(
        await readFile(
          new URL(
            '../dist/nodia-ai-runtime/config/runtime-policy.json',
            import.meta.url,
          ),
          'utf8',
        ),
      ),
    );
    await source.initialize();
    const teacher = new TeacherService(
      source,
      new CheckModuleAccessUseCase(source),
    );
    const credentials = new ApiNodiaAiCredentialsService(source);
    const transport = new FlashcardLibraryTransport(
      source,
      credentials,
      new ApiTextGenerationService(credentials, policy),
      policy,
    );
    const library = new FlashcardLibraryStore(transport, policy);
    const { action, operation, actor, selection } = args;

    const result = await teacher.scope(
      actor,
      null,
      async ({ manager, actor: owner }) => {
        if (action === 'probe') {
          const probe = await library.admit(manager, {
            id: randomUUID(),
            owner: owner.actorId,
            authSession: owner.sessionId,
            requestKey: operation,
            requestHash: hash({
              purpose: 'flashcard-image-canary/1',
              selection,
            }),
            origin: { kind: 'notes' },
            textPrompt: null,
            imagePrompt: FLASHCARD_IMAGE_QUALIFICATION_PROMPT,
            textSelection: null,
            imageSelection: selection,
            qualification: true,
          });
          const [part] = await manager.query(
            "SELECT id,state FROM teacher_flashcard_library_parts WHERE kind='image' AND proposal_id=$1",
            [probe.id],
          );
          if (!part) teacherError('flashcard_image_qualification_invalid', 422);
          return { operation_id: part.id, state: part.state };
        }

        const [row] = await manager.query(
          `SELECT part.state,op.remote_outcome,op.acknowledged_at IS NOT NULL AS acknowledged,
                op.response_hash,octet_length(part.image_bytes) AS preview_bytes
         FROM teacher_flashcard_library_parts part
         JOIN teacher_flashcard_library_proposals proposal ON proposal.id=part.proposal_id
         LEFT JOIN ai_generation_operations op ON op.id=part.id AND op.owner_kind='flashcard_library'
         WHERE part.id=$1 AND proposal.owner_user_id=$2 AND proposal.qualification
           AND part.kind='image' AND part.selection_snapshot=$3::jsonb`,
          [operation, owner.actorId, JSON.stringify(selection)],
        );
        if (!row) teacherError('flashcard_image_qualification_invalid', 422);
        if (action === 'accept')
          await transport.acceptImageQualification(
            manager,
            selection,
            operation,
            owner.actorId,
          );
        return {
          operation_id: operation,
          ...row,
          ...(action === 'accept' && { accepted: true }),
        };
      },
      action !== 'inspect',
    );
    console.log(JSON.stringify({ action, ...result }));
  } catch (error) {
    const code =
      error instanceof Error &&
      /^(teacher|auth|core|nodia_ai):[a-z_]+$/.test(error.message)
        ? error.message
        : 'teacher:flashcard_image_qualification_invalid';
    console.error(JSON.stringify({ code, retry: false }));
    process.exitCode = 1;
  } finally {
    if (source?.isInitialized) await source.destroy();
  }
}
