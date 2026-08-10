import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
};

@Injectable()
export class OpenAiClient {
  constructor(private readonly config: ConfigService) {}

  configured() {
    return Boolean(this.config.get<string>('OPENAI_API_KEY')?.trim());
  }

  fastModel() {
    return this.config.get<string>('OPENAI_MODEL_FAST') || 'gpt-4o-mini';
  }

  complexModel() {
    return this.config.get<string>('OPENAI_MODEL_COMPLEX') || 'gpt-4o';
  }

  async chat(input: {
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    maxTokens?: number;
    json?: boolean;
  }): Promise<string> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'OPENAI_API_KEY no está configurada en el servidor.',
      );
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: input.model,
        temperature: input.temperature ?? 0.2,
        max_tokens: input.maxTokens ?? 400,
        ...(input.json ? { response_format: { type: 'json_object' } } : {}),
        messages: input.messages,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new ServiceUnavailableException(
        `OpenAI error ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
      );
    }

    const body = (await response.json()) as ChatCompletionResponse;
    const content = body.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new ServiceUnavailableException('OpenAI no devolvió contenido.');
    }
    return content;
  }
}
