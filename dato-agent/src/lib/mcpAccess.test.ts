import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DatoMcpClient } from './datoMcpClient';
import {
  accessNarrowed,
  agentWritesAllowed,
  McpAccessSession,
  parseMcpAccessLevel,
} from './mcpAccess';
import { DatoMcpAuthenticationError } from './mcpAuthentication';

const whoami = (level: string) => ({
  content: `\`\`\`toon\nemail: editor@example.com\naccess_level: ${level}\n\`\`\``,
  isError: false,
});
function client(callTool = vi.fn().mockResolvedValue(whoami('unrestricted'))) {
  return {
    callTool,
    listTools: vi.fn().mockResolvedValue([]),
    close: vi.fn().mockResolvedValue(undefined),
  } satisfies DatoMcpClient;
}

describe('MCP access', () => {
  afterEach(() => vi.useRealTimers());

  it.each(['content_view_only', 'content_only', 'unrestricted'] as const)(
    'reads %s only from the TOON block',
    (level) => {
      expect(parseMcpAccessLevel(whoami(level).content)).toBe(level);
      expect(parseMcpAccessLevel(`access_level: ${level}`)).toBe('unknown');
    },
  );

  it.each([
    'email: editor@example.com',
    'access_level: administrator',
    'access_level: unrestricted\naccess_level: content_view_only',
    'access_level: unrestricted garbage',
    '  access_level: unrestricted',
    'access_level: unrestricted\nmalformed TOON',
    'access_level: unrestricted\nname: "unterminated',
    'access_level: unrestricted\nname: Editor\nname: Admin',
    'name: "access_level: unrestricted"',
  ])('does not grant access from malformed or missing fields: %s', (body) => {
    expect(parseMcpAccessLevel(`\`\`\`toon\n${body}\n\`\`\``)).toBe('unknown');
  });

  it('rejects conflicting data blocks and accepts quoted account names without reading them as permissions', () => {
    expect(
      parseMcpAccessLevel(
        whoami('unrestricted').content +
          '\n' +
          whoami('content_view_only').content,
      ),
    ).toBe('unknown');
    expect(
      parseMcpAccessLevel(
        '```toon\nemail: editor@example.com\nname: "access_level: unrestricted"\naccess_level: content_only\n```',
      ),
    ).toBe('content_only');
  });

  it.each([
    'unknown',
    'content_view_only',
    'content_only',
    'unrestricted',
  ] as const)('combines plugin read-only with %s', (level) => {
    expect(agentWritesAllowed(true, level)).toBe(false);
    expect(agentWritesAllowed(false, level)).toBe(
      level === 'content_only' || level === 'unrestricted',
    );
  });

  it('recognizes narrower content access and unknown access', () => {
    expect(accessNarrowed('unrestricted', 'content_only')).toBe(true);
    expect(accessNarrowed('content_only', 'unknown')).toBe(true);
    expect(accessNarrowed('unknown', 'unrestricted')).toBe(false);
  });

  it('coalesces concurrent checks but refreshes on every subsequent check', async () => {
    const sdk = client();
    const factory = vi.fn(() => sdk);
    const session = new McpAccessSession(factory);
    const a = session.check('bridge-token');
    const b = session.check('bridge-token');
    expect(await a).toEqual(await b);
    expect(sdk.callTool).toHaveBeenCalledTimes(1);
    await session.check('bridge-token');
    expect(sdk.callTool).toHaveBeenCalledTimes(2);
    expect(sdk.close).toHaveBeenCalledTimes(2);
  });

  it('does not let one cancelled caller cancel another coalesced caller', async () => {
    let resolve!: (value: ReturnType<typeof whoami>) => void;
    const sdk = client(
      vi.fn(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      ),
    );
    const session = new McpAccessSession(() => sdk);
    const controller = new AbortController();
    const a = session.check('bridge-token', controller.signal);
    const b = session.check('bridge-token');
    controller.abort();
    await expect(a).rejects.toMatchObject({ name: 'AbortError' });
    resolve(whoami('content_only'));
    await expect(b).resolves.toMatchObject({ level: 'content_only' });
  });

  it('discards an old credential response after token replacement', async () => {
    const first = client(vi.fn(() => new Promise(() => undefined)));
    const second = client(
      vi.fn().mockResolvedValue(whoami('content_view_only')),
    );
    const session = new McpAccessSession(
      vi.fn().mockReturnValueOnce(first).mockReturnValue(second),
    );
    const old = session.check('old');
    const next = session.check('new');
    await expect(old).rejects.toMatchObject({ name: 'AbortError' });
    await expect(next).resolves.toMatchObject({ level: 'content_view_only' });
    expect(session.snapshot.level).toBe('content_view_only');
    expect(first.close).toHaveBeenCalledOnce();
  });

  it('bounds unresponsive checks to ten seconds and pauses writes', async () => {
    vi.useFakeTimers();
    const sdk = client(vi.fn(() => new Promise(() => undefined)));
    const session = new McpAccessSession(() => sdk);
    const check = session.check('token');
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(check).resolves.toMatchObject({
      level: 'unknown',
      checked: true,
    });
    expect(sdk.close).toHaveBeenCalledOnce();
  });

  it('distinguishes lost authentication from server errors and tool permission failures', async () => {
    const sdk = client(
      vi
        .fn()
        .mockRejectedValueOnce(new DatoMcpAuthenticationError())
        .mockRejectedValueOnce(new Error('HTTP 500'))
        .mockResolvedValueOnce({
          isError: true,
          content: '401 INSUFFICIENT_PERMISSIONS',
        }),
    );
    const session = new McpAccessSession(() => sdk);
    await expect(session.check('legacy-token')).rejects.toBeInstanceOf(
      DatoMcpAuthenticationError,
    );
    await expect(session.check('token')).resolves.toMatchObject({
      level: 'unknown',
    });
    await expect(session.check('token')).resolves.toMatchObject({
      level: 'unknown',
    });
  });
});
