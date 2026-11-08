"""One CLI invocation's local closure fact; never a remote outcome or retry token."""
from dataclasses import dataclass, field
from uuid import UUID


@dataclass
class CliExecutionReceipt:
    operation_id: str
    _claimed: bool = field(default=False, init=False)
    _closed: bool = field(default=False, init=False)

    def __post_init__(self) -> None:
        if str(UUID(self.operation_id)) != self.operation_id:
            raise ValueError("Canonical operation identity required")

    @property
    def local_closed(self) -> bool:
        return self._claimed and self._closed

    def claim(self) -> None:
        if self._claimed:
            raise ValueError("A CLI receipt cannot be reused for another invocation")
        self._claimed = True

    def record_contained_closure(self) -> None:
        if not self._claimed:
            raise ValueError("No CLI invocation owns this receipt")
        self._closed = True
