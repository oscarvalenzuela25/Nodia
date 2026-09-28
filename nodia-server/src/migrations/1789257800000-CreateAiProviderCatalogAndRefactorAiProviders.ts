import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiProviderCatalogAndRefactorAiProviders1789257800000
  implements MigrationInterface
{
  name = 'CreateAiProviderCatalogAndRefactorAiProviders1789257800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create ai_provider_catalog table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ai_provider_catalog (
        id BIGSERIAL PRIMARY KEY,
        key VARCHAR(64) UNIQUE NOT NULL,
        name VARCHAR(128) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Seed initial supported catalogs
    await queryRunner.query(`
      INSERT INTO ai_provider_catalog (key, name)
      VALUES
        ('gemini', 'Google Gemini'),
        ('openai', 'OpenAI'),
        ('anthropic', 'Anthropic Claude'),
        ('mistral', 'Mistral AI'),
        ('deepseek', 'DeepSeek'),
        ('groq', 'Groq'),
        ('perplexity', 'Perplexity AI'),
        ('cohere', 'Cohere'),
        ('xai', 'xAI (Grok)'),
        ('meta', 'Meta Llama'),
        ('together', 'Together AI'),
        ('azure_openai', 'Azure OpenAI'),
        ('aws_bedrock', 'AWS Bedrock'),
        ('huggingface', 'Hugging Face'),
        ('ollama', 'Ollama (Self-Hosted)'),
        ('qwen', 'Alibaba Qwen')
      ON CONFLICT (key) DO NOTHING;
    `);

    // 3. Refactor ai_providers table
    await queryRunner.query(`
      ALTER TABLE ai_providers
      ADD COLUMN IF NOT EXISTS catalog_id BIGINT REFERENCES ai_provider_catalog(id) ON DELETE CASCADE;
    `);

    await queryRunner.query(`
      ALTER TABLE ai_providers
      ADD COLUMN IF NOT EXISTS name VARCHAR(128);
    `);

    // Drop unique constraint on key if present
    await queryRunner.query(`
      ALTER TABLE ai_providers DROP CONSTRAINT IF EXISTS "UQ_ebb21740e10748770b54434db59";
    `);

    // Make key nullable or default so accounts can rely primarily on catalog_id
    await queryRunner.query(`
      ALTER TABLE ai_providers ALTER COLUMN key DROP NOT NULL;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ai_providers DROP COLUMN IF EXISTS name;
    `);

    await queryRunner.query(`
      ALTER TABLE ai_providers DROP COLUMN IF EXISTS catalog_id;
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS ai_provider_catalog;
    `);
  }
}
