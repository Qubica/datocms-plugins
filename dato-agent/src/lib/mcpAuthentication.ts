/** An authentication failure from DatoCMS MCP, never from a model provider. */
export class DatoMcpAuthenticationError extends Error {
  readonly code = 'mcp_auth_required' as const;

  constructor() {
    super(
      'Your DatoCMS connection needs to be renewed. Reconnect DatoCMS to continue.',
    );
    this.name = 'DatoMcpAuthenticationError';
  }
}

export function mcpAuthenticationChallenges(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  const metadata = (value as Record<string, unknown>)._meta;
  if (!metadata || typeof metadata !== 'object') return [];
  const challenges = (metadata as Record<string, unknown>)[
    'mcp/www_authenticate'
  ];
  if (!Array.isArray(challenges)) return [];
  return challenges.filter((challenge): challenge is string => {
    if (typeof challenge !== 'string' || !/^Bearer\s/i.test(challenge))
      return false;
    const match = /(?:^|[,\s])error\s*=\s*(?:"([^"\r\n]+)"|([a-z_]+))/i.exec(
      challenge,
    );
    const error = match?.[1] ?? match?.[2];
    return error === undefined || error === 'invalid_token';
  });
}
