/** Private app-server server-request boundary. Never a model supplied capability. */
export type CodexServerRequestId = string | number;
export type CodexChatServerReply =
  | {
      result: {
        contentItems: { type: 'inputText'; text: string }[];
        success: boolean;
      };
    }
  | { error: { code: number; message: string } };

export interface CodexChatToolChannel {
  handle(
    method: string,
    params: unknown,
    requestId: CodexServerRequestId,
  ): Promise<CodexChatServerReply>;
  /** Revokes callbacks only. It never proves that the native process closed. */
  close(): void;
}
