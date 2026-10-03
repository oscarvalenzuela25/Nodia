import type { MigrationInterface, QueryRunner } from 'typeorm';
import {
  decryptSecret,
  encryptSecret,
  generateFingerprint,
} from '../ai-provider/helpers/ai-key-crypto.helper.js';

export class HardenAiApiKeyEncryption1790553600000 implements MigrationInterface {
  name = 'HardenAiApiKeyEncryption1790553600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const keys: Array<{ id: string; secret_ciphertext: string }> =
      await queryRunner.query(
        'SELECT id, secret_ciphertext FROM ai_api_keys FOR UPDATE',
      );

    for (const key of keys) {
      const secret = decryptSecret(key.secret_ciphertext);
      await queryRunner.query(
        'UPDATE ai_api_keys SET secret_ciphertext = $1, secret_fingerprint = $2 WHERE id = $3',
        [encryptSecret(secret), generateFingerprint(secret), key.id],
      );
    }
  }

  async down(): Promise<void> {
    // A downgrade would reintroduce weak key material and is intentionally unsupported.
  }
}
