import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { MAX_PAGE_LIMIT } from '../dto/export-filters.dto';
import { CrlService } from '../services/crl.service';

@ApiTags('CRL')
@Controller('crl')
export class CrlController {
  constructor(private readonly crlService: CrlService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List revoked certificates (public)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'issuerId', required: false })
  list(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('issuerId') issuerId?: string,
  ) {
    const pageNum = Math.max(1, Math.trunc(+page) || 1);
    const limitNum = Math.min(
      Math.max(1, Math.trunc(+limit) || 10),
      MAX_PAGE_LIMIT,
    );
    return this.crlService.list(pageNum, limitNum, issuerId || undefined);
  }

  @Get('merkle-root')
  @Public()
  @ApiOperation({
    summary: 'Current CRL Merkle root, computed locally and read on-chain',
  })
  getMerkleRoot() {
    return this.crlService.getMerkleRoot();
  }
}
