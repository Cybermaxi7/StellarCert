import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue, Process, Processor } from '@nestjs/bull';
import type { Job, Queue } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Certificate } from '../entities/certificate.entity';
import { CertificateStatus } from '../constants/certificate-status.enum';
import { CertificateService } from '../certificate.service';
import { SorobanService } from '../../stellar/services/soroban.service';

export const CHAIN_RECONCILIATION_QUEUE = 'chain-reconciliation';
export const SCAN_JOB = 'scan';
export const SYNC_JOB = 'sync-certificate';

/** Max certificates enqueued per scan, so one run cannot flood the RPC. */
const SCAN_BATCH_SIZE = 50;

/**
 * Periodically finds active certificates with no `stellarTransactionHash`
 * (issued while anchoring was disabled, or after an RPC failure) and retries
 * on-chain issuance for each, with exponential backoff.
 */
@Injectable()
@Processor(CHAIN_RECONCILIATION_QUEUE)
export class ChainReconciliationProcessor implements OnModuleInit {
  private readonly logger = new Logger(ChainReconciliationProcessor.name);

  constructor(
    @InjectQueue(CHAIN_RECONCILIATION_QUEUE) private readonly queue: Queue,
    @InjectRepository(Certificate)
    private readonly certificateRepository: Repository<Certificate>,
    private readonly certificateService: CertificateService,
    private readonly sorobanService: SorobanService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.queue.add(
        SCAN_JOB,
        {},
        {
          repeat: {
            cron:
              this.configService.get<string>('CHAIN_RECONCILIATION_CRON') ||
              '*/15 * * * *',
          },
          removeOnComplete: true,
        },
      );
    } catch (err: any) {
      this.logger.error(
        `Could not schedule chain reconciliation: ${err?.message}`,
      );
    }
  }

  @Process(SCAN_JOB)
  async handleScan(): Promise<{ enqueued: number }> {
    const anchoringEnabled =
      this.configService.get<string>('STELLAR_ANCHORING_ENABLED') !== 'false';
    if (!anchoringEnabled || !this.sorobanService.isConfigured()) {
      this.logger.debug(
        'Chain reconciliation skipped: anchoring disabled or Soroban not configured',
      );
      return { enqueued: 0 };
    }

    const orphans = await this.certificateRepository
      .createQueryBuilder('certificate')
      .select('certificate.id', 'id')
      .where('certificate.stellarTransactionHash IS NULL')
      .andWhere('certificate.status = :status', {
        status: CertificateStatus.ACTIVE,
      })
      .andWhere("COALESCE(certificate.issuerStellarAddress, '') <> ''")
      .andWhere("COALESCE(certificate.recipientStellarAddress, '') <> ''")
      .orderBy('certificate.createdAt', 'ASC')
      .limit(SCAN_BATCH_SIZE)
      .getRawMany<{ id: string }>();

    for (const { id } of orphans) {
      // A stable jobId stops overlapping scans queueing the same certificate
      // while an earlier retry sequence is still in flight.
      await this.queue.add(
        SYNC_JOB,
        { certificateId: id },
        {
          jobId: `sync-${id}`,
          attempts: 5,
          backoff: { type: 'exponential', delay: 30_000 },
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
    }

    this.logger.log(`Chain reconciliation enqueued ${orphans.length} job(s)`);
    return { enqueued: orphans.length };
  }

  @Process(SYNC_JOB)
  async handleSync(job: Job<{ certificateId: string }>) {
    // Throws on failure so Bull retries with the configured backoff.
    const result = await this.certificateService.syncChain(
      job.data.certificateId,
    );
    return { stellarTransactionHash: result.stellarTransactionHash };
  }
}
