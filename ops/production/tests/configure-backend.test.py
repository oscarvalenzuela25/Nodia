"""Pure serialization/validation tests; no production files, subprocesses or network."""
import base64
import importlib.util
from pathlib import Path
import re
import unittest
from unittest.mock import patch
import uuid

spec = importlib.util.spec_from_file_location("configure_backend", Path(__file__).parents[1] / "configure-backend.py")
configure = importlib.util.module_from_spec(spec)
spec.loader.exec_module(configure)


def defaults():
    return {"bootstrap_email": "fixture@example.invalid", "r2_bucket": "fixture-files",
            "google_client_id": "fixture.apps.googleusercontent.com", "postgres_host": "database.example.invalid",
            "postgres_port": 29102, "postgres_database": "fixture_db", "frontend_origin": "https://frontend.example.invalid"}


def entered():
    return {"postgres_user": "fixture_user", "postgres_password": "fixture-$;|`password\\with\"quotes",
            "r2_endpoint": "https://storage.example.invalid", "r2_account_id": "fixture-account",
            "r2_access_key_id": "fixture-access-key", "r2_secret_access_key": "fixture-secret-key",
            "recovery_bucket": "fixture-recovery"}


class ConfigurationTests(unittest.TestCase):
    def test_serialization_preserves_shell_characters_without_inserting_commands(self):
        value = '$HOME `false` $(false); | \\backslash "quoted" and spaces'
        serialized = configure.environment_file({"FIXTURE": value})
        self.assertEqual(serialized, 'FIXTURE="$HOME `false` $(false); | \\\\backslash \\"quoted\\" and spaces"\n')
        self.assertEqual(serialized.count("\n"), 1)

    def test_line_injection_and_invalid_keys_are_rejected_without_echoing_values(self):
        marker = "DO_NOT_PRINT_FIXTURE"
        for value in [marker + "\nOTHER=bad", marker + "\r", marker + "\x00", marker + "\x7f"]:
            with self.assertRaises(configure.ConfigurationError) as raised:
                configure.environment_file({"PASSWORD": value})
            self.assertNotIn(marker, str(raised.exception))
        with self.assertRaises(configure.ConfigurationError):
            configure.environment_file({"X\nY": "fixture"})

    def test_defaults_schema_ports_origins_and_credentials_embedded_in_host_are_rejected(self):
        for field, value in [("postgres_host", "postgres://fixture:secret@example.invalid"),
                             ("postgres_port", True), ("postgres_port", 65536),
                             ("frontend_origin", "https://frontend.example.invalid/"),
                             ("frontend_origin", "https://FRONTEND.example.invalid"),
                             ("frontend_origin", "https://frontend.example.invalid:443"),
                             ("frontend_origin", "http://frontend.example.invalid"),
                             ("google_client_id", "not-a-google-client")]:
            with self.assertRaises(configure.ConfigurationError):
                configure.validate_defaults(defaults() | {field: value})
        with self.assertRaises(configure.ConfigurationError):
            configure.validate_defaults(defaults() | {"unrecognized": "fixture"})

    def test_generated_configuration_has_expected_contract_and_no_external_effects(self):
        with patch.object(configure.subprocess, "run", side_effect=AssertionError("No subprocess allowed")):
            runtime, recovery = configure.build_configuration(defaults(), entered())
        self.assertEqual(runtime["PGSSLMODE"], "verify-full")
        self.assertEqual(runtime["POSTGRES_PASSWORD"], entered()["postgres_password"])
        self.assertEqual(runtime["AUTH_COOKIE_SAME_SITE"], "none")
        self.assertEqual(runtime["TRUST_PROXY"], "127.0.0.1,::1")
        for field in ["AUTH_JWT_SECRET", "AI_SECRET_MASTER_KEY", "GEMINI_SERVICE_TOKEN"]:
            self.assertRegex(runtime[field], re.compile(r"^[0-9a-f]{64}$"))
        self.assertEqual(len(base64.b64decode(recovery["journal_encryption_key"], validate=True)), 32)
        self.assertEqual(uuid.UUID(recovery["era_id"]).version, 4)
        self.assertEqual(set(recovery), {"schema_version", "deployment_id", "era_id", "endpoint", "bucket",
                                         "access_key_id", "secret_access_key", "journal_encryption_key"})
        self.assertEqual(recovery["bucket"], "fixture-recovery")
        self.assertEqual(recovery["endpoint"], "https://storage.example.invalid/")

    def test_invalid_input_is_rejected_before_generating_new_keys(self):
        for field, value in [("postgres_password", "nodia_password"), ("r2_secret_access_key", ""),
                             ("r2_endpoint", "https://fixture:secret@storage.example.invalid"),
                             ("r2_endpoint", "https://storage.example.invalid/path")]:
            with patch.object(configure.secrets, "token_hex", side_effect=AssertionError("Must validate first")):
                with self.assertRaises(configure.ConfigurationError):
                    configure.build_configuration(defaults(), entered() | {field: value})


if __name__ == "__main__":
    unittest.main()
