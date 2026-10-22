from pathlib import Path
p=Path('nodia-server/src/nodia-ai-context/use-case/process-nodia-ai-stage.use-case.ts')
t=p.read_text(encoding='utf-8')
a=t.index('    const visible = new Set(routes);',t.index('  private async history'))
b=t.index('    const preferences = await this.preferences.loadForContext(',a)
t=t[:a]+'''    const stored = await this.snapshots.latest(manager, claim.run.conversation_id, claim.run.input_through_seq);
    let snapshot: NodiaAiCompactionSnapshot | undefined;
    if (stored && stored.builder_contract_version === NODIA_AI_COMPACTION_BUILDER_VERSION &&
      BigInt(stored.through_message_seq) < BigInt(claim.run.input_through_seq) &&
      isDeepStrictEqual(stored.scope_manifest, { schema_version: 1, module_routes: routes }) &&
      isNodiaAiCompactionSummary(stored.summary, this.policy.results.json_collection_items)) {
      if (await this.historyReader.fingerprint(manager, claim.run.conversation_id, stored.through_message_seq) === stored.source_hash)
        snapshot = { id: stored.id, revision: stored.revision, throughSeq: stored.through_message_seq,
          sourceHash: stored.source_hash, summary: stored.summary,
          scopeManifest: { schema_version: 1, module_routes: routes }, builderContractVersion: stored.builder_contract_version };
    }
    const window = await this.historyReader.load(manager, {
      conversationId: claim.run.conversation_id, actorId: claim.identity.userId,
      throughSeq: claim.run.input_through_seq, moduleRoutes: routes, afterSeq: snapshot?.throughSeq ?? '0',
      maxBytes: Math.floor(this.policy.results.assembled_context_utf8_bytes * 3 / 4),
    });
    const sourceHash = await this.historyReader.fingerprint(manager, claim.run.conversation_id, claim.run.input_through_seq);
    const recoveryRefs = await this.recovery.load(manager, claim.identity, claim.run.conversation_id);
''' +t[b:]
t=t.replace('    return { routes, history, preferences };','    return { routes, history: window.history, preferences, snapshot, complete: window.complete, sourceHash, recoveryRefs };')
# append source guard before checkPreferences
idx=t.index('  private async checkPreferences(')
t=t[:idx]+'''  private async checkSources(
    manager: EntityManager,
    claim: NodiaAiClaim,
    data: Awaited<ReturnType<ProcessNodiaAiStageUseCase['history']>>,
  ) {
    await this.checkPreferences(manager, claim, data);
    const actor = await this.authorize.execute(claim.identity, {}, manager);
    const admitted = claim.run.context_manifest.module_routes;
    const routes = actor.modules.map((item) => item.route).filter((route) => Array.isArray(admitted) && admitted.includes(route)).sort();
    if (!isDeepStrictEqual(routes, data.routes) ||
      await this.historyReader.fingerprint(manager, claim.run.conversation_id, claim.run.input_through_seq) !== data.sourceHash ||
      !isDeepStrictEqual(await this.recovery.load(manager, claim.identity, claim.run.conversation_id), data.recoveryRefs))
      throw new NodiaAiKnownPreDispatchError('nodia_ai:context_sources_changed');
  }
  private async compact(
    claim: NodiaAiClaim,
    context: NodiaAiStageContext,
    selection: NodiaAiClaim['run']['selection_snapshot'],
    data: Awaited<ReturnType<ProcessNodiaAiStageUseCase['history']>>,
    history: ContextHistoryItem[],
  ): Promise<NodiaAiStageOutcome> {
    if (selection.mode === 'api_key') throw new NodiaAiKnownPreDispatchError('nodia_ai:mode_unavailable');
    const throughSeq = history[history.length - 1].seq;
    const sourceHash = await context.checkpoint((manager) => this.historyReader.fingerprint(manager, claim.run.conversation_id, throughSeq));
    const input = { history, moduleRoutes: data.routes, throughSeq, sourceHash, previousSnapshot: data.snapshot };
    let request: ReturnType<BuildNodiaAiCompactionUseCase['execute']>;
    try { request = this.compaction.execute(input); }
    catch { throw new NodiaAiKnownPreDispatchError('nodia_ai:context_limit'); }
    const observation = await this.adapter.observe(selection, context.signal);
    if (!observation.available || !observation.resourceKey ||
      observation.configurationGeneration !== claim.run.context_manifest.configuration_generation ||
      observation.sessionGeneration !== claim.run.context_manifest.session_generation ||
      observation.resourceKey !== claim.run.context_manifest.resource_key)
      throw new NodiaAiKnownPreDispatchError('nodia_ai:eligibility_changed');
    await context.checkpoint(async (manager) => {
      await this.checkSources(manager, claim, data);
      await this.adapter.verifyConfiguration(selection, observation.configurationGeneration, manager);
    });
    const reservation = await this.reserve.execute(claim, observation.resourceKey, claim.attempt.id);
    await context.armDispatch(selection, reservation, async (manager) => {
      await this.checkSources(manager, claim, data);
      const reserved: { id: string }[] = await manager.query(
        'UPDATE nodia_ai_runs SET compactions_used=compactions_used+1 WHERE id=$1 AND compactions_used<$2 RETURNING id',
        [claim.run.id, this.policy.budget.compactions_per_run],
      );
      if (reserved.length !== 1) throw new NodiaAiKnownPreDispatchError('nodia_ai:execution_limit');
    });
    const response = await this.adapter.execute({
      attemptId: claim.attempt.id, selection, canonicalPrompt: request.prompt,
      deadlineAt: new Date(Math.min(claim.run.deadline_at.getTime(), Date.now() + this.policy.timing.provider_dispatch_seconds * 1000)),
      resourceKey: observation.resourceKey, configurationGeneration: observation.configurationGeneration,
      sessionGeneration: observation.sessionGeneration,
    }, context.signal);
    const failure = (errorCode: string): NodiaAiStageOutcome => ({
      status: 'failed', errorCode, terminalProof: response.terminalProof,
      persist: async (manager) => { await this.release.execute(claim, reservation, response.terminalProof, manager); },
    });
    if (response.kind !== 'answer') return failure('nodia_ai:compaction_invalid');
    let summary: ReturnType<BuildNodiaAiCompactionUseCase['parse']>;
    try {
      summary = this.compaction.parse({ ...input, text: response.text });
      // A valid but expanding extraction cannot be advertised as a successful compaction.
      const before = Buffer.byteLength(JSON.stringify({ previous: data.snapshot?.summary ?? null, history }), 'utf8');
      if (Buffer.byteLength(JSON.stringify(summary), 'utf8') >= before) return failure('nodia_ai:context_limit');
      await context.checkpoint((manager) => this.checkSources(manager, claim, data));
    } catch (error: unknown) {
      return failure(error instanceof NodiaAiKnownPreDispatchError ? error.errorCode : 'nodia_ai:compaction_invalid');
    }
    return {
      status: 'continue', nextStage: 'inference', terminalProof: response.terminalProof,
      persist: async (manager) => {
        await this.checkSources(manager, claim, data);
        const bytes = Buffer.byteLength(JSON.stringify(summary), 'utf8') + Buffer.byteLength(JSON.stringify({schema_version:1,module_routes:data.routes}), 'utf8');
        const usage = this.attachments ? await this.attachments.usageForAdmission(manager, claim.run.conversation_id, claim.identity.userId, new Date()) : null;
        if (!usage || BigInt(usage.chat_bytes) + BigInt(bytes) > BigInt(this.policy.admission.chat_storage_bytes) ||
          BigInt(usage.owner_bytes) + BigInt(bytes) > BigInt(this.policy.admission.owner_storage_bytes))
          throw new Error('nodia_ai:storage_limit');
        const snapshot = await this.snapshots.insert(manager, {
          conversationId: claim.run.conversation_id, throughSeq, sourceHash,
          summary, scopeManifest: { schema_version: 1, module_routes: data.routes },
          builderContractVersion: NODIA_AI_COMPACTION_BUILDER_VERSION,
        });
        const run = await manager.getRepository(NodiaAiRun).findOneByOrFail({ id: claim.run.id });
        run.context_snapshot_id = snapshot.id;
        run.context_manifest = { ...run.context_manifest, compaction: {
          snapshot_id: snapshot.id, revision: snapshot.revision, through_seq: throughSeq, source_hash: sourceHash,
          builder_contract_version: NODIA_AI_COMPACTION_BUILDER_VERSION,
          request_sha256: createHash('sha256').update(request.prompt).digest('hex'), request_utf8_bytes: request.sourceBytes,
          summary_utf8_bytes: Buffer.byteLength(JSON.stringify(summary), 'utf8'),
          mode: selection.mode, model_id: selection.model_id,
        }};
        await manager.getRepository(NodiaAiRun).save(run);
        await this.release.execute(claim, reservation, response.terminalProof, manager);
      },
    };
  }
''' +t[idx:]
p.write_text(t,encoding='utf-8')
