import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import { Certificate } from '../entities/certificate.entity';
import { CertificateStatus } from '../constants/certificate-status.enum';
import { SorobanService } from '../../stellar/services/soroban.service';

export interface CrlEntry {
  certificateId: string;
  issuerId: string;
  reason: string | null;
  revokedAt: Date;
}

export interface CrlPage {
  data: CrlEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CrlMerkleRoot {
  /** Root computed from the revocations in the database. */
  computed: string;
  /** Root published by the CRL contract, or null if it could not be read. */
  onChain: string | null;
  /** Null when the on-chain value is unavailable. */
  inSync: boolean | null;
  revokedCount: number;
}

const sha256 = (data: Buffer | string): Buffer =>
  createHash('sha256').update(data).digest();

/**
 * Same construction as the CRL contract's `build_merkle_root`: leaves are
 * sha256(certificateId), adjacent nodes are hashed together, an odd node is
 * paired with itself, and an empty list hashes the empty string.
 */
export function computeMerkleRoot(ids: string[]): string {
  if (ids.length === 0) {
    return sha256('').toString('hex');
  }

  let layer = ids.map((id) => sha256(id));
  while (layer.length > 1) {
    const next: Buffer[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = i + 1 < layer.length ? layer[i + 1] : left;
      next.push(sha256(Buffer.concat([left, right])));
    }
    layer = next;
  }
  return layer[0].toString('hex');
}

@Injectable()
export class CrlService {
  constructor(
    @InjectRepository(Certificate)
    private readonly certificateRepository: Repository<Certificate>,
    private readonly sorobanService: SorobanService,
  ) {}

  async list(page: number, limit: number, issuerId?: string): Promise<CrlPage> {
    const [certificates, total] = await this.certificateRepository.findAndCount(
      {
        where: {
          status: CertificateStatus.REVOKED,
          ...(issuerId ? { issuerId } : {}),
        },
        order: { updatedAt: 'ASC', id: 'ASC' },
        skip: (page - 1) * limit,
        take: limit,
      },
    );

    return {
      data: certificates.map((c) => ({
        certificateId: c.certificateId,
        issuerId: c.issuerId,
        reason: c.revocationReason ?? c.metadata?.revocationReason ?? null,
        revokedAt: c.revokedAt ?? c.metadata?.revokedAt ?? c.updatedAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getMerkleRoot(): Promise<CrlMerkleRoot> {
    const revoked = await this.certificateRepository.find({
      select: ['id', 'certificateId'],
      where: { status: CertificateStatus.REVOKED },
      order: { updatedAt: 'ASC', id: 'ASC' },
    });

    const computed = computeMerkleRoot(revoked.map((c) => c.certificateId));
    const onChain = await this.sorobanService.getCrlMerkleRoot();

    return {
      computed,
      onChain,
      inSync: onChain === null ? null : onChain === computed,
      revokedCount: revoked.length,
    };
  }
}
