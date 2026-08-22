import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { AppService } from './app.service'
import { Public } from '@/auth/auth.decorator'

@ApiTags('app')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Health check',
    description:
      'Returns a simple greeting confirming that the service is reachable and healthy.',
  })
  @ApiOkResponse({
    description: 'Service is up and responding',
    schema: { type: 'string', example: 'Hello World!' },
  })
  getHello(): string {
    return this.appService.getHello()
  }
}
