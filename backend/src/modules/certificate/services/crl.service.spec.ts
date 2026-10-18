import { createHash } from 'crypto';
import { CertificateStatus } from '../constants/certificate-status.enum';
import { CrlService, computeMerkleRoot } from './crl.service';

const sha = (d: Buffer | string) => createHash('sha256').update(d).digest();

describe('computeMerkleRoot', () => {
  it('hashes the empty string for an empty list', () => {
    expect(computeMerkleRoot([])).toBe(sha('').toString('hex'));
  });

  it('uses the leaf hash as the root for a single id', () => {
    expect(computeMerkleRoot(['a'])).toBe(sha('a').toString('hex'));
  });

  it('pairs leaves and duplicates an odd trailing node', () => {
    const [a, b, c] = ['a', 'b', 'c'].map(sha);
    const ab = sha(Buffer.concat([a, b]));
    const cc = sha(Buffer.concat([c, c]));
    expect(computeMerkleRoot(['a', 'b', 'c'])).toBe(
      sha(Buffer.concat([ab, cc])).toString('hex'),
    );
  });
});

describe('CrlService', () => {
  const repo = { findAndCount: jest.fn(), find: jest.fn() };
  const soroban = { getCrlMerkleRoot: jest.fn() };
  let service: CrlService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CrlService(repo as any, soroban as any);
  });

  it('lists revoked certificates, filtered by issuer and paginated', async () => {
    const updatedAt = new Date('2026-01-01');
    repo.findAndCount.mockResolvedValue([
      [
        {
          certificateId: 'CERT-1',
          issuerId: 'iss-1',
          revocationReason: 'fraud',
          updatedAt,
        },
      ],
      25,
    ]);

    const result = await service.list(2, 10, 'iss-1');

    expect(repo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: CertificateStatus.REVOKED, issuerId: 'iss-1' },
        skip: 10,
        take: 10,
      }),
    );
    expect(result).toEqual({
      data: [
        {
          certificateId: 'CERT-1',
          issuerId: 'iss-1',
          reason: 'fraud',
          revokedAt: updatedAt,
        },
      ],
      total: 25,
      page: 2,
      limit: 10,
      totalPages: 3,
    });
  });

  it('reports whether the computed root matches the on-chain root', async () => {
    repo.find.mockResolvedValue([{ certificateId: 'a' }]);
    const root = sha('a').toString('hex');

    soroban.getCrlMerkleRoot.mockResolvedValue(root);
    await expect(service.getMerkleRoot()).resolves.toEqual({
      computed: root,
      onChain: root,
      inSync: true,
      revokedCount: 1,
    });

    soroban.getCrlMerkleRoot.mockResolvedValue('deadbeef');
    expect((await service.getMerkleRoot()).inSync).toBe(false);

    soroban.getCrlMerkleRoot.mockResolvedValue(null);
    expect((await service.getMerkleRoot()).inSync).toBeNull();
  });
});
