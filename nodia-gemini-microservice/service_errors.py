"""Public errors contain stable codes and safe messages, never provider output."""


class ServiceError(Exception):
    def __init__(self, code: str, message: str, status: int = 503, retry_after: int | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.retry_after = retry_after


class InvalidExtraction(ServiceError):
    def __init__(self):
        super().__init__("invalid_extraction", "El proveedor no devolvió una extracción válida.", 502)
