import { GetRentalAuditEventsUseCase } from '../../../rental-audit/use-case/get-rental-audit-events.use-case.js';
import { GetRentalBlockUseCase } from '../../../rental-block/use-case/get-rental-blocks.use-case.js';
import { GetRentalBlocksUseCase } from '../../../rental-block/use-case/get-rental-blocks.use-case.js';
import { GetRentalAvailabilityUseCase } from '../../../rental-calendar/use-case/get-rental-calendar.use-case.js';
import { GetRentalCalendarUseCase } from '../../../rental-calendar/use-case/get-rental-calendar.use-case.js';
import { GetRentalCancellationPolicyUseCase } from '../../../rental-cancellation-policy/use-case/get-rental-cancellation-policy.use-case.js';
import { GetRentalCancellationPoliciesUseCase } from '../../../rental-cancellation-policy/use-case/get-rental-cancellation-policies.use-case.js';
import { GetRentalCollaboratorCandidatesUseCase } from '../../../rental-collaborator/use-case/get-rental-collaborator-candidates.use-case.js';
import { GetRentalCollaboratorsUseCase } from '../../../rental-collaborator/use-case/get-rental-collaborators.use-case.js';
import { GetRentalExpenseUseCase } from '../../../rental-expense/use-case/get-rental-expenses.use-case.js';
import { GetRentalExpensesUseCase } from '../../../rental-expense/use-case/get-rental-expenses.use-case.js';
import { GetRentalPaymentUseCase } from '../../../rental-payment/use-case/get-rental-payments.use-case.js';
import { GetRentalPaymentsUseCase } from '../../../rental-payment/use-case/get-rental-payments.use-case.js';
import { GetRentalPropertyUseCase } from '../../../rental-property/use-case/get-rental-property.use-case.js';
import { GetRentalPropertiesUseCase } from '../../../rental-property/use-case/get-rental-properties.use-case.js';
import { PreviewRentalCancellationUseCase } from '../../../rental-reservation/use-case/preview-rental-cancellation.use-case.js';
import { GetRentalReservationUseCase } from '../../../rental-reservation/use-case/get-rental-reservation.use-case.js';
import { ListRentalReservationUseCase } from '../../../rental-reservation/use-case/list-rental-reservation.use-case.js';
import { GetRentalOverviewUseCase } from '../../../rental-overview/use-case/get-rental-overview.use-case.js';
import { GetRentalTurnoverUseCase } from '../../../rental-turnover/use-case/get-rental-turnover.use-case.js';
import { ListRentalTurnoverUseCase } from '../../../rental-turnover/use-case/list-rental-turnover.use-case.js';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../../nodia-ai-runtime/config/runtime-policy.js';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { RentalTransactionService } from '../../../rental-common/rental-transaction.service.js';
import type { ActorReference } from '../../../authorization/authority-transaction.js';
import type { NodiaAiJsonObject } from '../../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type {
  NodiaAiToolFamily,
  NodiaAiToolHandlerContext,
  NodiaAiToolRegistration,
} from '../../../nodia-ai-tools/types/tool-registry.types.js';

/** Dormant typed family. Publication requires reviewed knowledge bindings, never constructor side effects. */
@Injectable()
export class NodiaAiReservationsFamilyUseCase {
  private readonly schema = readFileSync(
    new URL('../../contracts/reservations.schema.json', import.meta.url),
    'utf8',
  );
  constructor(
    private readonly transactions: RentalTransactionService,
    private readonly port0: GetRentalAuditEventsUseCase,
    private readonly port1: GetRentalBlockUseCase,
    private readonly port2: GetRentalBlocksUseCase,
    private readonly port3: GetRentalAvailabilityUseCase,
    private readonly port4: GetRentalCalendarUseCase,
    private readonly port5: GetRentalCancellationPolicyUseCase,
    private readonly port6: GetRentalCancellationPoliciesUseCase,
    private readonly port7: GetRentalCollaboratorCandidatesUseCase,
    private readonly port8: GetRentalCollaboratorsUseCase,
    private readonly port9: GetRentalExpenseUseCase,
    private readonly port10: GetRentalExpensesUseCase,
    private readonly port11: GetRentalPaymentUseCase,
    private readonly port12: GetRentalPaymentsUseCase,
    private readonly port13: GetRentalPropertyUseCase,
    private readonly port14: GetRentalPropertiesUseCase,
    private readonly port15: PreviewRentalCancellationUseCase,
    private readonly port16: GetRentalReservationUseCase,
    private readonly port17: ListRentalReservationUseCase,
    private readonly port18: GetRentalOverviewUseCase,
    private readonly port19: GetRentalTurnoverUseCase,
    private readonly port20: ListRentalTurnoverUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}
  private identity(context: NodiaAiToolHandlerContext): ActorReference {
    if (context.signal?.aborted) throw new Error('nodia_ai:tool_cancelled');
    return {
      userId: context.actor.actorId,
      sessionId: context.actor.sessionId,
      transaction: context.manager,
      statementTimeoutMs: context.statementTimeoutMs,
    };
  }
  private result(value: unknown): NodiaAiJsonObject {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('nodia_ai:tool_output_invalid');
    const inspect = (node: unknown): void => {
      if (Array.isArray(node)) {
        if (node.length > this.policy.results.list_max_rows)
          throw new BadRequestException('rental:window_too_large');
        node.forEach(inspect);
      } else if (node && typeof node === 'object')
        Object.values(node).forEach(inspect);
    };
    inspect(value);
    return value as NodiaAiJsonObject;
  }
  private page(input: NodiaAiJsonObject, max = 100): NodiaAiJsonObject {
    const query = (input.query ?? {}) as NodiaAiJsonObject;
    const cap = Math.min(max, this.policy.results.list_max_rows);
    const limit =
      query.limit ?? Math.min(cap, this.policy.results.list_default_rows);
    if (
      typeof limit !== 'number' ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > cap
    )
      throw new BadRequestException('rental:invalid_input');
    return { ...query, page: query.page ?? 1, limit };
  }
  /** Historical changes are arbitrary JSON; expose closed event metadata rather than unsafe nested payloads. */
  private auditSummary(
    value: Awaited<ReturnType<GetRentalAuditEventsUseCase['execute']>>,
  ) {
    return {
      ...value,
      data: value.data.map((row) => ({
        id: row.id,
        property_id: row.property_id,
        actor_id: row.actor_id,
        action: row.action,
        resource_type: row.resource_type,
        resource_id: row.resource_id,
        created_at: row.created_at,
      })),
    };
  }
  private registration(
    name: string,
    resource: string,
    operation: string,
    definition: string,
    handler: NodiaAiToolRegistration['handler'],
    ownerOnly = false,
  ): NodiaAiToolRegistration {
    const sha256 = createHash('sha256').update(this.schema).digest('hex');
    return {
      capabilityId: name,
      toolName: name,
      revision: 1,
      publication: 'published',
      kind: 'read',
      moduleKey: 'rental_reservations',
      resourceKey: resource,
      operationKey: operation,
      descriptionKey: `nodia_ai:${name}`,
      description: `Nodia Reservas: ${resource} / ${operation}. Lectura autorizada sin modificar datos.`,
      requiredModuleRoutes: ['/tools/reservations'],
      actionKeys: [],
      effectKey: 'read',
      inputSchema: {
        sourceJson: this.schema,
        definition: definition + 'Input',
        sha256,
      },
      outputSchema: {
        sourceJson: this.schema,
        definition: definition + 'Output',
        sha256,
      },
      verifyAuthority: async (input, context) => {
        const actor = this.identity(context);
        if (name === 'nodia_rental_properties_list')
          await this.transactions.list(actor, async () => undefined);
        else
          await this.transactions.read(
            actor,
            input.property_id as string,
            async () => undefined,
            ownerOnly,
          );
      },
      ...([
        'nodia_rental_properties_list',
        'nodia_rental_properties_get',
      ].includes(name)
        ? {
            verifyResultAuthority: async (
              _input: NodiaAiJsonObject,
              result: NodiaAiJsonObject,
              context: NodiaAiToolHandlerContext,
            ) => {
              const records = name.endsWith('_list') ? result.data : [result];
              await this.port14.verifyResultAuthority(
                this.identity(context),
                records as unknown as Parameters<
                  GetRentalPropertiesUseCase['verifyResultAuthority']
                >[1],
              );
            },
          }
        : {}),
      handler,
    };
  }
  family(): NodiaAiToolFamily {
    const capabilities: NodiaAiToolRegistration[] = [
      this.registration(
        'nodia_rental_audit_list',
        'rental_audit',
        'list',
        'RentalAuditList',
        async (input, context) =>
          this.result(
            this.auditSummary(
              await this.port0.execute(
                this.identity(context),
                input.property_id as string,
                this.page(input) as unknown as Parameters<
                  GetRentalAuditEventsUseCase['execute']
                >[2],
              ),
            ),
          ),
        false,
      ),
      this.registration(
        'nodia_rental_blocks_get',
        'rental_blocks',
        'get',
        'RentalBlocksGet',
        async (input, context) =>
          this.result(
            await this.port1.execute(
              this.identity(context),
              input.property_id as string,
              input.id as string,
            ),
          ),
        false,
      ),
      this.registration(
        'nodia_rental_blocks_list',
        'rental_blocks',
        'list',
        'RentalBlocksList',
        async (input, context) =>
          this.result(
            await this.port2.execute(
              this.identity(context),
              input.property_id as string,
              this.page(input) as unknown as Parameters<
                GetRentalBlocksUseCase['execute']
              >[2],
            ),
          ),
        false,
      ),
      this.registration(
        'nodia_rental_calendar_availability',
        'rental_calendar',
        'availability',
        'RentalCalendarAvailability',
        async (input, context) =>
          this.result(
            await this.port3.execute(
              this.identity(context),
              input.property_id as string,
              (input.query ?? {}) as unknown as Parameters<
                GetRentalAvailabilityUseCase['execute']
              >[2],
            ),
          ),
        false,
      ),
      this.registration(
        'nodia_rental_calendar_calendar',
        'rental_calendar',
        'calendar',
        'RentalCalendarCalendar',
        async (input, context) =>
          this.result(
            await this.port4.execute(
              this.identity(context),
              input.property_id as string,
              (input.query ?? {}) as unknown as Parameters<
                GetRentalCalendarUseCase['execute']
              >[2],
              Math.min(100, this.policy.results.list_max_rows),
            ),
          ),
        false,
      ),
      this.registration(
        'nodia_rental_cancellation_policies_get',
        'rental_cancellation_policies',
        'get',
        'RentalCancellationPoliciesGet',
        async (input, context) =>
          this.result(
            await this.port5.execute(
              this.identity(context),
              input.property_id as string,
              input.id as string,
            ),
          ),
        false,
      ),
      this.registration(
        'nodia_rental_cancellation_policies_list',
        'rental_cancellation_policies',
        'list',
        'RentalCancellationPoliciesList',
        async (input, context) =>
          this.result(
            await this.port6.execute(
              this.identity(context),
              input.property_id as string,
              this.page(input) as unknown as Parameters<
                GetRentalCancellationPoliciesUseCase['execute']
              >[2],
            ),
          ),
        false,
      ),
      this.registration(
        'nodia_rental_collaborators_candidates',
        'rental_collaborators',
        'candidates',
        'RentalCollaboratorsCandidates',
        async (input, context) =>
          this.result(
            await this.port7.execute(
              this.identity(context),
              input.property_id as string,
              this.page(input, 20) as unknown as Parameters<
                GetRentalCollaboratorCandidatesUseCase['execute']
              >[2],
            ),
          ),
        true,
      ),
      this.registration(
        'nodia_rental_collaborators_list',
        'rental_collaborators',
        'list',
        'RentalCollaboratorsList',
        async (input, context) =>
          this.result(
            await this.port8.execute(
              this.identity(context),
              input.property_id as string,
              this.page(input) as unknown as Parameters<
                GetRentalCollaboratorsUseCase['execute']
              >[2],
            ),
          ),
        false,
      ),
      this.registration(
        'nodia_rental_expenses_get',
        'rental_expenses',
        'get',
        'RentalExpensesGet',
        async (input, context) =>
          this.result(
            await this.port9.execute(
              this.identity(context),
              input.property_id as string,
              input.id as string,
            ),
          ),
        false,
      ),
      this.registration(
        'nodia_rental_expenses_list',
        'rental_expenses',
        'list',
        'RentalExpensesList',
        async (input, context) =>
          this.result(
            await this.port10.execute(
              this.identity(context),
              input.property_id as string,
              this.page(input) as unknown as Parameters<
                GetRentalExpensesUseCase['execute']
              >[2],
            ),
          ),
        false,
      ),
      this.registration(
        'nodia_rental_payments_get',
        'rental_payments',
        'get',
        'RentalPaymentsGet',
        async (input, context) =>
          this.result(
            await this.port11.execute(
              this.identity(context),
              input.property_id as string,
              input.id as string,
            ),
          ),
        false,
      ),
      this.registration(
        'nodia_rental_payments_list',
        'rental_payments',
        'list',
        'RentalPaymentsList',
        async (input, context) =>
          this.result(
            await this.port12.execute(
              this.identity(context),
              input.property_id as string,
              this.page(input) as unknown as Parameters<
                GetRentalPaymentsUseCase['execute']
              >[2],
            ),
          ),
        false,
      ),
      this.registration(
        'nodia_rental_properties_get',
        'rental_properties',
        'get',
        'RentalPropertiesGet',
        async (input, context) =>
          this.result(
            await this.port13.execute(
              this.identity(context),
              input.property_id as string,
            ),
          ),
        false,
      ),
      this.registration(
        'nodia_rental_properties_list',
        'rental_properties',
        'list',
        'RentalPropertiesList',
        async (input, context) =>
          this.result(
            await this.port14.execute(
              this.identity(context),
              this.page(input) as unknown as Parameters<
                GetRentalPropertiesUseCase['execute']
              >[1],
            ),
          ),
        false,
      ),
      this.registration(
        'nodia_rental_reservations_cancellation_preview',
        'rental_reservations',
        'cancellation_preview',
        'RentalReservationsCancellationPreview',
        async (input, context) =>
          this.result(
            await this.port15.execute(
              this.identity(context),
              input.property_id as string,
              input.id as string,
              (input.command ?? {}) as unknown as Parameters<
                PreviewRentalCancellationUseCase['execute']
              >[3],
            ),
          ),
        false,
      ),
      this.registration(
        'nodia_rental_reservations_get',
        'rental_reservations',
        'get',
        'RentalReservationsGet',
        async (input, context) =>
          this.result(
            await this.port16.execute(
              this.identity(context),
              input.property_id as string,
              input.id as string,
            ),
          ),
        false,
      ),
      this.registration(
        'nodia_rental_reservations_list',
        'rental_reservations',
        'list',
        'RentalReservationsList',
        async (input, context) =>
          this.result(
            await this.port17.execute(
              this.identity(context),
              input.property_id as string,
              this.page(input) as unknown as Parameters<
                ListRentalReservationUseCase['execute']
              >[2],
            ),
          ),
        false,
      ),
      this.registration(
        'nodia_rental_summaries_overview',
        'rental_summaries',
        'overview',
        'RentalSummariesOverview',
        async (input, context) =>
          this.result(
            await this.port18.execute(
              this.identity(context),
              input.property_id as string,
              (input.query ?? {}) as unknown as Parameters<
                GetRentalOverviewUseCase['execute']
              >[2],
            ),
          ),
        false,
      ),
      this.registration(
        'nodia_rental_turnovers_get',
        'rental_turnovers',
        'get',
        'RentalTurnoversGet',
        async (input, context) =>
          this.result(
            await this.port19.execute(
              this.identity(context),
              input.property_id as string,
              input.id as string,
            ),
          ),
        false,
      ),
      this.registration(
        'nodia_rental_turnovers_list',
        'rental_turnovers',
        'list',
        'RentalTurnoversList',
        async (input, context) =>
          this.result(
            await this.port20.execute(
              this.identity(context),
              input.property_id as string,
              this.page(input) as unknown as Parameters<
                ListRentalTurnoverUseCase['execute']
              >[2],
            ),
          ),
        false,
      ),
    ];
    return {
      familyKey: 'reservations',
      modules: [
        {
          key: 'rental_reservations',
          route: '/tools/reservations',
          label: 'Reservas',
        },
      ],
      resources: [...new Set(capabilities.map((tool) => tool.resourceKey))].map(
        (key) => ({
          key,
          label: key,
          requiredModuleRoutes: ['/tools/reservations'],
        }),
      ),
      capabilities,
    };
  }
}
