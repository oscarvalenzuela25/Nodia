"""Stable response contracts for the private HTTP adapter."""

from typing import Annotated, Literal
from datetime import date

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator


def validate_user_bigint(value: str) -> str:
    if int(value) > 9223372036854775807:
        raise ValueError("User ID exceeds PostgreSQL BIGINT range")
    return value


# TypeORM exposes users.id as a string. Preserve its exact identity, including
# values above JavaScript's safe integer range; reject noncanonical spellings.
NodiaActorId = Annotated[str, Field(strict=True, pattern=r"^[1-9][0-9]{0,18}$", max_length=19),
                         AfterValidator(validate_user_bigint)]


class HealthResponse(BaseModel):
    status: Literal["ok"]


class LoginJobResponse(BaseModel):
    id: str = Field(pattern=r"^[0-9a-f]{32}$")
    state: Literal["running", "succeeded", "failed", "cancelled"]


class AgenticLoginJobResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(pattern=r"^[0-9a-f]{32}$")
    state: Literal["running", "waiting_code", "verifying", "succeeded", "failed", "cancelled"]
    authorization_url: str | None = None
    reason: Literal["agentic_login_timeout", "agentic_login_failed"] | None = None


class AgenticLoginCode(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    code: str = Field(pattern=r"^[A-Za-z0-9_./+~\-]{8,2048}$", max_length=2048)


class AgenticStatusResponse(BaseModel):
    engine: Literal["agentic"] = "agentic"
    available: bool
    has_active_session: bool = False
    quota_type: str = "antigravity_token_plan"
    model: str | None = None
    model_display: str | None = None
    models: list[dict[str, object]] = Field(default_factory=list)
    quota: dict[str, object] | None = None
    reason: str | None = None
    quota_source: Literal["agentic_cli"] | None = None
    quota_observed_at: float | None = None


class AgenticModelsResponse(BaseModel):
    engine: Literal["agentic"] = "agentic"
    available: bool
    authenticated: bool
    models: list[dict[str, object]]
    reason: str | None = None


class WebSupportedOptions(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    extended_thinking: bool | None = None


class WebStatusResponse(BaseModel):
    engine: Literal["web"] = "web"
    authenticated: bool
    has_cookies: bool
    has_browser_profile: bool
    last_refresh_time: float | str | None = None
    tier: str
    model: str | None = None
    model_display: str | None = None
    quota: dict[str, object] | None = None
    quota_source: Literal["web"] = "web"
    quota_observed_at: float | None = None
    supported_options: WebSupportedOptions | None = None


class DualEngineStatusResponse(BaseModel):
    status: Literal["ok"] = "ok"
    default_engine: Literal["agentic", "web"]
    agentic: AgenticStatusResponse
    web: WebStatusResponse


NonNegativeNumber = Annotated[float, Field(ge=0, allow_inf_nan=False, strict=True)]


class InvoiceItem(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    code: str | None = None
    name: str = Field(min_length=1, max_length=1024)
    quantity: NonNegativeNumber | None = None
    packages: NonNegativeNumber | None = None
    units_per_package: NonNegativeNumber | None = None
    cost_price: NonNegativeNumber | None = None
    cost_price_tax: NonNegativeNumber | None = None
    unit_price: NonNegativeNumber | None = None
    total_price: NonNegativeNumber | None = None


class InvoiceData(BaseModel):
    model_config = ConfigDict(extra="forbid")
    issue_date: str = ""
    items: list[InvoiceItem] = Field(min_length=1, max_length=2000)

    @field_validator("issue_date")
    @classmethod
    def valid_date(cls, value: str) -> str:
        if value and date.fromisoformat(value).isoformat() != value:
            raise ValueError("Invalid invoice date")
        return value


class InvoiceAnalysisResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str | None = Field(default=None, max_length=256)
    total_amount: NonNegativeNumber | None = None
    data: InvoiceData


class AnalysisOptions(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    engine: Literal["web", "agentic"] = "web"
    provider_fields: dict[str, object] | None = None
    provider_tax: int | None = Field(default=None, ge=0, le=100)
    model: str = Field(min_length=1, max_length=128)
    extended_thinking: bool = False
    thinking_level: Literal["low", "medium", "high"] | None = None


class RuntimeLimits(BaseModel):
    file_bytes: int = Field(default=10 * 1024 * 1024, ge=1, le=50 * 1024 * 1024)
    analysis_slots: int = Field(default=2, ge=1, le=8)
    upload_timeout: float = Field(default=30, gt=0, le=300)
    analysis_timeout: float = Field(default=300, gt=0, le=300)
    admission_timeout: float = Field(default=0.05, gt=0, le=1)

    @property
    def body_bytes(self) -> int:
        return self.file_bytes + 32 * 1024
