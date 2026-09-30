import { Injectable, NestMiddleware } from '@nestjs/common';
import * as bodyParser from 'body-parser';

@Injectable()
export class RawBodyMiddleware implements NestMiddleware {
  private readonly parser = bodyParser.raw({ type: '*/*' });
  use(req: any, res: any, next: () => void) {
    this.parser(req, res, next);
  }
}