import {
  Controller,
  Post,
  Body,
  Sse,
  UseGuards,
  UsePipes,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { AiService } from './ai.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  aiGenerateSchema,
  aiChatSchema,
  AiGenerateDto,
  AiChatDto,
  AiGenerationResult,
} from '@diagramz/shared';

@ApiTags('AI')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(private aiService: AiService) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate validated Mermaid diagram code from natural language prompt' })
  @UsePipes(new ZodValidationPipe(aiGenerateSchema))
  async generate(@Body() dto: AiGenerateDto): Promise<AiGenerationResult> {
    return this.aiService.generate(dto);
  }

  @Post('chat')
  @Sse()
  @ApiOperation({ summary: 'Stream AI conversational diagram refinement using Server-Sent Events' })
  @UsePipes(new ZodValidationPipe(aiChatSchema))
  chat(@Body() dto: AiChatDto): Observable<{ data: string }> {
    return this.aiService.streamChat(dto);
  }
}
