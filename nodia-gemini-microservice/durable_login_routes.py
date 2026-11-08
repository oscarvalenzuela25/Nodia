"""Private request-scoped login protocol; legacy jobs remain separate contracts."""
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, FastAPI, Header
from pydantic import BaseModel, ConfigDict, Field

from schemas import NodiaActorId


ProviderId = NodiaActorId  # PostgreSQL bigint, preserve exact canonical spelling.


class DurableLoginJob(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(pattern=r"^[0-9a-f]{32}$")
    state: Literal["running", "waiting_code", "verifying", "succeeded", "failed", "cancelled", "unknown"]
    authorization_url: str | None = None
    reason: Literal["agentic_login_timeout", "agentic_login_failed"] | None = None


class AcknowledgedLogin(BaseModel):
    acknowledged: Literal[True] = True


def register_durable_login_routes(application: FastAPI) -> None:
    def router_for(engine: str, prefix: str) -> APIRouter:
        router = APIRouter(prefix=prefix)

        @router.post("/requests/{request_id}", response_model=DurableLoginJob)
        async def start(request_id: UUID,
                        actor: Annotated[NodiaActorId, Header(alias="X-Nodia-Actor-Id")],
                        provider: Annotated[ProviderId, Header(alias="X-Nodia-Provider-Id")],
                        deadline: Annotated[str, Header(alias="X-Nodia-Login-Expires-At", max_length=64)]):
            return await application.state.durable_login.start(engine, str(request_id), actor, provider, deadline)

        @router.get("/requests/{request_id}", response_model=DurableLoginJob)
        async def observe(request_id: UUID,
                          actor: Annotated[NodiaActorId, Header(alias="X-Nodia-Actor-Id")],
                          provider: Annotated[ProviderId, Header(alias="X-Nodia-Provider-Id")]):
            return await application.state.durable_login.observe(engine, str(request_id), actor, provider)

        @router.post("/requests/{request_id}/cancel", response_model=DurableLoginJob)
        async def cancel(request_id: UUID,
                         actor: Annotated[NodiaActorId, Header(alias="X-Nodia-Actor-Id")],
                         provider: Annotated[ProviderId, Header(alias="X-Nodia-Provider-Id")]):
            return await application.state.durable_login.cancel(engine, str(request_id), actor, provider)

        @router.post("/requests/{request_id}/ack", response_model=AcknowledgedLogin)
        async def acknowledge(request_id: UUID,
                              actor: Annotated[NodiaActorId, Header(alias="X-Nodia-Actor-Id")],
                              provider: Annotated[ProviderId, Header(alias="X-Nodia-Provider-Id")]):
            return application.state.durable_login.acknowledge(engine, str(request_id), actor, provider)
        return router

    application.include_router(router_for("agentic", "/agentic/auth/login"))
