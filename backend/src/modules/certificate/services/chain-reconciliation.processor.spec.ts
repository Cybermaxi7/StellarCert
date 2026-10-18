import {
  ChainReconciliationProcessor,
  SCAN_JOB,
  SYNC_JOB,
} from './chain-reconciliation.processor';

describe('ChainReconciliationProcessor', () => {
  let queue: { add: jest.Mock };
  let qb: any;
  let certificateService: { syncChain: jest.Mock };
  let soroban: { isConfigured: jest.Mock };
  let config: { get: jest.Mock };
  let processor: ChainReconciliationProcessor;

  beforeEach(() => {
    queue = { add: jest.fn().mockResolvedValue(undefined) };
    qb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }]),
    };
    certificateService = { syncChain: jest.fn() };
    soroban = { isConfigured: jest.fn().mockReturnValue(true) };
    config = { get: jest.fn().mockReturnValue(undefined) };
    processor = new ChainReconciliationProcessor(
      queue as any,
      { createQueryBuilder: jest.fn(() => qb) } as any,
      certificateService as any,
      soroban as any,
      config as any,
    );
  });

  it('registers a repeatable scan job on init', async () => {
    await processor.onModuleInit();
    expect(queue.add).toHaveBeenCalledWith(
      SCAN_JOB,
      {},
      expect.objectContaining({ repeat: { cron: '*/15 * * * *' } }),
    );
  });

  it('enqueues one deduplicated, backed-off sync job per orphan', async () => {
    const result = await processor.handleScan();
    expect(result).toEqual({ enqueued: 2 });
    expect(queue.add).toHaveBeenCalledWith(
      SYNC_JOB,
      { certificateId: 'a' },
      expect.objectContaining({
        jobId: 'sync-a',
        attempts: 5,
        backoff: expect.objectContaining({ type: 'exponential' }),
      }),
    );
  });

  it('does nothing when anchoring is disabled', async () => {
    config.get.mockReturnValue('false');
    expect(await processor.handleScan()).toEqual({ enqueued: 0 });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('does nothing when Soroban is not configured', async () => {
    soroban.isConfigured.mockReturnValue(false);
    expect(await processor.handleScan()).toEqual({ enqueued: 0 });
  });

  it('sync job delegates to syncChain and propagates failures for retry', async () => {
    certificateService.syncChain.mockResolvedValueOnce({
      stellarTransactionHash: 'hash',
    });
    await expect(
      processor.handleSync({ data: { certificateId: 'a' } } as any),
    ).resolves.toEqual({ stellarTransactionHash: 'hash' });

    certificateService.syncChain.mockRejectedValueOnce(new Error('rpc'));
    await expect(
      processor.handleSync({ data: { certificateId: 'a' } } as any),
    ).rejects.toThrow('rpc');
  });
});
