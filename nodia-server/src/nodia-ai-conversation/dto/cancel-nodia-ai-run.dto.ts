import { IsUUID } from 'class-validator';

/** CancelRunRequest from common-schema.json; cancellation is monotonic per run. */
export class CancelNodiaAiRunDto {
  @IsUUID('4') client_request_id!: string;
}
