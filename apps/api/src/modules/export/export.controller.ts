import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Res,
  UsePipes,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ExportService } from './export.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  queueExportSchema,
  QueueExportDto,
  ExportStatusResponseDto,
  AuthSessionUser,
} from '@diagramz/shared';

@ApiTags('Export')
@Controller('export')
export class ExportController {
  constructor(private exportService: ExportService) {}

  @Post('queue')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Enqueue asynchronous diagram export job' })
  @UsePipes(new ZodValidationPipe(queueExportSchema))
  async queueExport(
    @Body() dto: QueueExportDto,
    @CurrentUser() user?: AuthSessionUser,
  ): Promise<{ jobId: string }> {
    return this.exportService.enqueueExport(dto, user?.id);
  }

  @Get('status/:jobId')
  @Public()
  @ApiOperation({ summary: 'Check status of export job' })
  getStatus(@Param('jobId') jobId: string): ExportStatusResponseDto {
    return this.exportService.getJobStatus(jobId);
  }

  @Get('download/:jobId')
  @Public()
  @ApiOperation({ summary: 'Download exported file directly' })
  downloadFile(@Param('jobId') jobId: string, @Res() res: Response) {
    const { buffer, contentType } = this.exportService.getJobBuffer(jobId);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="diagram-${jobId}.${contentType.includes('svg') ? 'svg' : contentType.includes('pdf') ? 'pdf' : 'png'}"`);
    res.send(buffer);
  }
}
