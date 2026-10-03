import { Controller, Post, Body, UsePipes, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StorageService } from './storage.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  presignUploadSchema,
  PresignUploadDto,
  PresignUploadResponseDto,
} from '@diagramz/shared';

@ApiTags('Storage')
@ApiBearerAuth()
@Controller('storage')
export class StorageController {
  constructor(private storageService: StorageService) {}

  @Post('presign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate presigned upload URL for assets or thumbnails' })
  @UsePipes(new ZodValidationPipe(presignUploadSchema))
  async presign(@Body() dto: PresignUploadDto): Promise<PresignUploadResponseDto> {
    return this.storageService.generatePresignedUploadUrl(dto);
  }
}
