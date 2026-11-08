# Teacher UI synthetic QA

Run the existing Client Vite server and open `/src/test/manual/teacher/index.html`.
All requests are handled by an in-memory Axios adapter in this fixture. It does not
call providers, the operational Server or a database. It uses the production Teacher
components and the existing PageContent padding/theme; navigation authority is tested
separately by the real router/Server checks.

Query parameters: `scenario=list|empty|draft|review|plan|lesson|final|practice|graded|failed|paused|unknown|error`,
`lang=es|en`, `theme=light|dark`, `topic=english` for the second topic/organization,
`fail=pause` for a rejected pause that preserves the draft, or `fail=lost` for a
committed command with a lost response recovered only through its original receipt.
Synthetic model names and illustrative scores exist only in this fixture.

The production client preserves only opaque pending-request metadata in tab-scoped
sessionStorage. It contains actor scope, request UUID, path and method, with no
request body, answers, prompts or secrets. It is removed after a confirmed result
or known rejection; invalid metadata or another actor is discarded. It only enables
GET receipt reconciliation and never reconstructs a POST for replay. Browser storage
denial leaves in-memory recovery available, without promising recovery after reload.

For the separate browser → real HTTP → disposable PostgreSQL check, start
`node test/teacher-domain.integration.mjs --serve` from Server after the coordinated
build and use only the loopback URL printed by that harness. Append `realHttp` with
that URL and `actorId=9007199254740993` to this page. The fixture then leaves Axios's
real adapter enabled. It mirrors the selected session UUID into the page's query
string so a browser reload opens that same real session. Remote hosts are rejected.
The harness uses a synthetic actor and validated publisher outputs; this mode tests
DTOs, Server transactions and persistence, without qualifying a real provider or the
shared dispatch runtime. Never point it at the configured work/operational Server.

Answers autosave after 1500 ms of inactivity. Draft CAS and the original request
receipt remain distinct from practice submission/full final delivery. A failed or
uncertain version does not retry on a timer; later acknowledgement preserves the
input node, focus/caret and a newer local edit. Pause disables/cancels pending timers
and carries any still-local answer together with the cursor. Blank text is a durable
draft, while submission completeness belongs to Server and explicit “I don't know”
is a different answer.
