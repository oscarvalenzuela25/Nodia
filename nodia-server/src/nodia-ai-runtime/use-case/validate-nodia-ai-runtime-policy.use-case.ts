import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { AnySchema } from 'ajv';
import type { NodiaAiRuntimePolicy } from '../config/runtime-policy.js';

@Injectable()
export class ValidateNodiaAiRuntimePolicyUseCase {
  execute(input: unknown): NodiaAiRuntimePolicy {
    try {
      if (!input || typeof input !== 'object' || Array.isArray(input))
        throw Error();
      const envelope = input as Record<string, unknown>;
      const keys = [
        'schema_version',
        'policyHash',
        'policy',
        'schema',
        'contentHash',
      ];
      if (
        Object.keys(envelope).length !== keys.length ||
        keys.some((key) => !(key in envelope)) ||
        envelope.schema_version !== 1 ||
        typeof envelope.policyHash !== 'string' ||
        !/^[a-f0-9]{64}$/.test(envelope.policyHash)
      )
        throw Error();
      const payload = {
        schema_version: 1,
        policyHash: envelope.policyHash,
        policy: envelope.policy,
        schema: envelope.schema,
      };
      if (
        createHash('sha256').update(JSON.stringify(payload)).digest('hex') !==
        envelope.contentHash
      )
        throw Error();
      if (
        !envelope.schema ||
        typeof envelope.schema !== 'object' ||
        Array.isArray(envelope.schema)
      )
        throw Error();
      const validate = new Ajv2020({ strict: true, allErrors: true }).compile(
        envelope.schema as AnySchema,
      );
      if (!validate(envelope.policy)) throw Error();
      const raw = envelope.policy as Record<string, unknown>;
      const {
        $schema: _schema,
        status: _status,
        policy_version,
        ...sections
      } = raw;
      const result = {
        policyVersion: policy_version,
        policyHash: envelope.policyHash,
        ...sections,
      } as NodiaAiRuntimePolicy;
      const {
        queue: q,
        timing: t,
        retry: r,
        budget: b,
        retention,
        admission: a,
        results,
      } = result;
      // Cross-field safety remains enforced after deployment, not only by build.
      if (
        t.heartbeat_seconds * 3 >= t.lease_seconds ||
        t.lease_seconds >= t.provider_dispatch_seconds ||
        q.wait_seconds + t.provider_dispatch_seconds >= t.run_seconds ||
        t.drain_seconds <
          t.provider_dispatch_seconds +
            t.cancellation_seconds +
            t.flush_seconds ||
        q.active_per_owner > q.foreground_workers ||
        q.waiting_per_owner > q.waiting_global ||
        b.provider_dispatches_per_run <
          1 + b.compactions_per_run + b.delegations_per_run ||
        r.pre_dispatch_delay_seconds.length !== r.pre_dispatch_retries ||
        r.cleanup_delay_seconds.length !== r.cleanup_attempts - 1 ||
        retention.sweep_seconds >= retention.physical_cleanup_target_seconds ||
        a.message_text_utf8_bytes >= a.http_json_bytes ||
        a.files_per_message >= a.parts_per_message ||
        a.title_utf8_bytes > a.message_text_utf8_bytes ||
        a.file_bytes > a.message_files_bytes ||
        a.message_files_bytes > a.file_bytes * a.files_per_message ||
        a.message_files_bytes > a.chat_storage_bytes ||
        a.chat_storage_bytes > a.owner_storage_bytes ||
        a.files_per_message > a.attachments_per_chat ||
        a.uploads_per_owner > a.uploads_global ||
        a.upload_seconds >= a.upload_intent_seconds ||
        a.parse_seconds >= t.provider_dispatch_seconds ||
        results.list_default_rows > results.list_max_rows ||
        results.list_max_rows > results.json_collection_items ||
        results.report_max_groups > results.json_collection_items ||
        results.report_max_filters > results.json_collection_items ||
        results.tool_result_utf8_bytes > results.assembled_context_utf8_bytes ||
        a.message_text_utf8_bytes >= results.assembled_context_utf8_bytes ||
        results.assistant_text_utf8_bytes > results.provider_stream_bytes ||
        results.delta_batch_utf8_bytes > results.assistant_text_utf8_bytes ||
        results.outbox_events_per_activity <=
          b.steps_per_proposal * 2 + b.tool_calls_per_run * 2 + 8 ||
        b.tool_calls_per_run > b.mcp_rpc_messages_per_run ||
        t.read_query_seconds > t.domain_step_seconds ||
        b.steps_per_proposal * t.domain_step_seconds + q.wait_seconds >
          t.execution_admission_seconds ||
        t.confirmation_challenge_seconds > t.proposal_seconds ||
        [r.pre_dispatch_delay_seconds, r.cleanup_delay_seconds].some((delays) =>
          delays.some(
            (delay, index) => index > 0 && delay <= delays[index - 1],
          ),
        ) ||
        r.pre_dispatch_delay_seconds.reduce(
          (total, delay) => total + delay,
          0,
        ) >= q.wait_seconds ||
        result.search.default_rows > result.search.max_rows ||
        retention.physical_cleanup_target_seconds >
          retention.backup_max_days * 86400
      )
        throw Error();
      return deepFreeze(result);
    } catch {
      throw new Error('nodia_ai_runtime_policy_unavailable');
    }
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}
