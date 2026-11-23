import type { NodiaAiJsonObject } from '../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import { readFlashcardImportContent } from '../teacher/policies/teacher-flashcard-import.js';
import {
  flashcardDeckDefinition,
  flashcardDeckId,
  readFlashcardCreate,
  readFlashcardPatch,
} from '../teacher/policies/teacher-flashcards.js';
import {
  object,
  requireUuid,
  teacherError,
} from '../teacher/policies/teacher-validation.js';
import type {
  Flashcard,
  FlashcardDeck,
} from '../teacher/types/teacher-flashcards.types.js';
import type { TeacherFlashcardsUseCase } from '../teacher/use-case/teacher-flashcards.use-case.js';
import type {
  TeacherOperationContext,
  TeacherPreparedCommand,
  TeacherReadCandidate,
  TeacherWriteCandidate,
} from './types.js';

const cardPatchFields = [
  'question',
  'answer',
  'deck_id',
  'source',
  'image_side',
  'remove_image',
];

type ImportCommand = {
  destination:
    | { kind: 'existing'; deck_id: string }
    | { kind: 'new'; title: string; category?: string };
  cards: { question: string; answer: string; source?: string }[];
};

function actor({ actorId, sessionId }: TeacherOperationContext) {
  return { userId: actorId, sessionId };
}

function cardId(id: unknown) {
  return requireUuid(id).toLowerCase();
}

function pageInput(page: unknown) {
  if (page === undefined) return 1;
  if (typeof page !== 'number') teacherError('invalid_input', 400);
  return page;
}

function deckIdInput(deckId: unknown) {
  return deckId === undefined
    ? 'general'
    : (flashcardDeckId(deckId) ?? 'general');
}

function previewText(value: string, limit: number) {
  const points = Array.from(value);
  return points.length <= limit
    ? value
    : `${points.slice(0, limit - 1).join('')}…`;
}

function projectDeck(deck: FlashcardDeck) {
  return {
    id: deck.id,
    title: deck.title,
    category: deck.category,
    card_count: deck.card_count,
  };
}

function projectCard(card: Flashcard, question: string) {
  return {
    id: card.id,
    deck_id: card.deck_id,
    question,
    revision: card.revision,
    image: card.image ? { side: card.image.side } : null,
    source: card.source ? { label: card.source.label } : null,
  };
}

function deckCommand(input: Record<string, unknown>) {
  const deck = flashcardDeckDefinition(input.title, input.category);
  return {
    title: deck.title,
    ...(deck.category !== null && { category: deck.category }),
  };
}

function createCommand(input: NodiaAiJsonObject) {
  const raw = object(input, ['question', 'answer', 'deck_id', 'source']);
  const data = readFlashcardCreate({
    question: raw.question,
    answer: raw.answer,
    deck_id: raw.deck_id,
    source: raw.source === undefined ? undefined : { label: raw.source },
  });
  return {
    deck_id: data.deckId ?? 'general',
    question: data.question,
    answer: data.answer,
    ...(data.source && { source: data.source.label }),
  };
}

function patchCommand(input: Record<string, unknown>, revision: number) {
  const { source, remove_image } = input;
  if (
    input.deck_id === null ||
    (remove_image !== undefined && remove_image !== true)
  ) {
    teacherError('invalid_input', 400);
  }
  const data = readFlashcardPatch({
    revision,
    deck_id: input.deck_id,
    question: input.question,
    answer: input.answer,
    source:
      source === undefined || source === null ? source : { label: source },
    image: remove_image ? null : undefined,
    image_side: input.image_side,
  });
  return {
    ...(data.deckId !== undefined && { deck_id: data.deckId ?? 'general' }),
    ...(data.question !== undefined && { question: data.question }),
    ...(data.answer !== undefined && { answer: data.answer }),
    ...(data.source !== undefined && { source: data.source?.label ?? null }),
    ...(data.image === null && { remove_image: true }),
    ...(data.imageSide !== undefined && { image_side: data.imageSide }),
  };
}

function importCommand(input: NodiaAiJsonObject): ImportCommand {
  const raw = object(input, ['destination', 'cards']);
  const { destination, cards } = readFlashcardImportContent(
    raw.destination,
    raw.cards,
  );
  return {
    destination:
      destination.kind === 'existing'
        ? { kind: destination.kind, deck_id: destination.deckId ?? 'general' }
        : {
            kind: destination.kind,
            title: destination.deck.title,
            ...(destination.deck.category !== null && {
              category: destination.deck.category,
            }),
          },
    cards: cards.map(({ question, answer, source }) => ({
      question,
      answer,
      ...(source && { source: source.label }),
    })),
  };
}

function rememberedInput(value: unknown) {
  if (typeof value !== 'boolean') teacherError('invalid_input', 400);
  return value;
}

function confirmedRevision(prepared: TeacherPreparedCommand) {
  const revision = prepared.preconditions.revision;
  if (
    typeof revision !== 'number' ||
    !Number.isInteger(revision) ||
    revision < 1
  )
    teacherError('invalid_input', 400);
  return revision;
}

export function flashcardReadCandidates(
  useCase: TeacherFlashcardsUseCase,
): TeacherReadCandidate[] {
  return [
    {
      toolName: 'nodia_teacher_flashcard_decks_list',
      async execute(input, context) {
        const { page } = object(input, ['page']);
        const result = await useCase.deckPage(
          actor(context),
          pageInput(page),
          context.manager,
        );
        return { data: result.data.map(projectDeck), meta: result.meta };
      },
    },
    {
      toolName: 'nodia_teacher_flashcards_list',
      async execute(input, context) {
        const { deck_id, page } = object(input, ['deck_id', 'page']);
        const result = await useCase.cards(
          actor(context),
          deckIdInput(deck_id),
          pageInput(page),
          context.manager,
        );
        return {
          data: result.data.map((card) => {
            const question = previewText(card.question, 320);
            return {
              ...projectCard(card, question),
              question_truncated: question !== card.question,
            };
          }),
          meta: result.meta,
        };
      },
    },
    {
      toolName: 'nodia_teacher_flashcards_get',
      async execute(input, context) {
        const { id } = object(input, ['id']);
        const card = await useCase.card(
          actor(context),
          cardId(id),
          context.manager,
        );
        return { ...projectCard(card, card.question), answer: card.answer };
      },
    },
  ];
}

export function flashcardWriteCandidates(
  useCase: TeacherFlashcardsUseCase,
): TeacherWriteCandidate[] {
  const requireDeck = (id: string, context: TeacherOperationContext) =>
    useCase.deck(actor(context), id, context.manager);
  const requireCard = (id: unknown, context: TeacherOperationContext) =>
    useCase.card(actor(context), cardId(id), context.manager);

  async function verifyRevision(
    prepared: TeacherPreparedCommand,
    context: TeacherOperationContext,
  ) {
    const card = await requireCard(prepared.id, context);
    if (card.revision !== confirmedRevision(prepared))
      teacherError('revision_conflict');
  }

  return [
    {
      toolName: 'nodia_teacher_flashcard_decks_prepare_create',
      async prepare(input) {
        const command = deckCommand(object(input, ['title', 'category']));
        return { command, title: command.title, preconditions: {} };
      },
      verify: async () => undefined,
      async execute(prepared, context) {
        const command = deckCommand(prepared.command);
        const deck = await useCase.createDeck(
          actor(context),
          command,
          context.manager,
        );
        return { id: deck.id };
      },
    },
    {
      toolName: 'nodia_teacher_flashcards_prepare_create',
      async prepare(input, context) {
        const command = createCommand(input);
        const deck = await requireDeck(command.deck_id, context);
        return {
          command,
          preconditions: {},
          title: previewText(command.question, 120),
          preview: { ...command, deck_title: deck.title },
        };
      },
      async verify(prepared, context) {
        await requireDeck(deckIdInput(prepared.command.deck_id), context);
      },
      async execute(prepared, context) {
        const { source, ...command } = createCommand(prepared.command);
        const card = await useCase.createCard(
          actor(context),
          {
            ...command,
            request_key: context.requestKey,
            ...(source !== undefined && { source: { label: source } }),
          },
          context.manager,
        );
        return { id: card.id };
      },
    },
    {
      toolName: 'nodia_teacher_flashcards_prepare_update',
      async prepare(input, context) {
        const { id, ...changes } = object(input, ['id', ...cardPatchFields]);
        const card = await requireCard(id, context);
        const command = patchCommand(changes, card.revision);
        if (command.image_side && !card.image)
          teacherError('invalid_input', 400);
        const deck = await requireDeck(
          command.deck_id ?? card.deck_id,
          context,
        );
        return {
          id: card.id,
          command,
          preconditions: { revision: card.revision },
          title: previewText(card.question, 120),
          preview: {
            ...command,
            current_question: card.question,
            deck_title: deck.title,
          },
        };
      },
      async verify(prepared, context) {
        await verifyRevision(prepared, context);
        if (prepared.command.deck_id !== undefined)
          await requireDeck(deckIdInput(prepared.command.deck_id), context);
      },
      async execute(prepared, context) {
        const revision = confirmedRevision(prepared);
        const { source, remove_image, ...command } = patchCommand(
          prepared.command,
          revision,
        );
        const card = await useCase.patchCard(
          actor(context),
          cardId(prepared.id),
          {
            ...command,
            revision,
            ...(source !== undefined && {
              source: source === null ? null : { label: source },
            }),
            ...(remove_image && { image: null }),
          },
          context.manager,
        );
        return { id: card.id };
      },
    },
    {
      toolName: 'nodia_teacher_flashcards_prepare_delete',
      async prepare(input, context) {
        const { id } = object(input, ['id']);
        const card = await requireCard(id, context);
        const deck = await requireDeck(card.deck_id, context);
        return {
          id: card.id,
          command: {},
          preconditions: { revision: card.revision },
          title: previewText(card.question, 120),
          preview: {
            question: card.question,
            deck_title: deck.title,
            removes_image: card.image !== null,
            removes_review_history: true,
          },
        };
      },
      verify: verifyRevision,
      async execute(prepared, context) {
        const id = cardId(prepared.id);
        await useCase.deleteCard(actor(context), id, {
          manager: context.manager,
          expectedRevision: confirmedRevision(prepared),
        });
        return { id };
      },
    },
    {
      toolName: 'nodia_teacher_flashcard_imports_prepare_create',
      async prepare(input, context) {
        const command = importCommand(input);
        const destination = command.destination;
        const title =
          destination.kind === 'new'
            ? destination.title
            : (await requireDeck(destination.deck_id, context)).title;
        return {
          command,
          preconditions: {},
          title,
          preview: { ...command, deck_title: title },
        };
      },
      async verify(prepared, context) {
        const { destination } = importCommand(prepared.command);
        if (destination.kind === 'existing')
          await requireDeck(destination.deck_id, context);
      },
      async execute(prepared, context) {
        const requestKey = requireUuid(context.requestKey).toLowerCase();
        await useCase.importCards(
          actor(context),
          { ...importCommand(prepared.command), request_key: requestKey },
          context.manager,
        );
        return { id: requestKey };
      },
    },
    {
      toolName: 'nodia_teacher_flashcard_reviews_prepare_create',
      async prepare(input, context) {
        const { id, remembered } = object(input, ['id', 'remembered']);
        const command = { remembered: rememberedInput(remembered) };
        const card = await requireCard(id, context);
        return {
          id: card.id,
          command,
          preconditions: { revision: card.revision },
          title: previewText(card.question, 120),
          preview: { ...command, question: card.question },
        };
      },
      verify: verifyRevision,
      async execute(prepared, context) {
        const id = cardId(prepared.id);
        await useCase.review(
          actor(context),
          id,
          {
            remembered: rememberedInput(prepared.command.remembered),
            request_key: context.requestKey,
          },
          {
            manager: context.manager,
            expectedRevision: confirmedRevision(prepared),
          },
        );
        return { id };
      },
    },
  ];
}
