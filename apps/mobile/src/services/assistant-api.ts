import { apiRequest } from './api';

export type AssistantAskResponse = {
  answer: string;
  intent: string;
  period?: string;
  complexity?: string;
  model?: string;
};

export async function askAssistant(input: {
  workspaceId: string;
  message: string;
}) {
  return apiRequest<AssistantAskResponse>('/assistant/ask', {
    method: 'POST',
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      message: input.message,
    }),
  });
}
