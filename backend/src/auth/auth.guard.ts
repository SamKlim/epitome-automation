import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class BearerTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new UnauthorizedException('Invalid Authorization format. Use: Bearer <token>');
    }

    const token = parts[1];
    const validToken = process.env.API_KEY;

    if (!validToken) {
      throw new Error('API_KEY environment variable not set');
    }

    if (token !== validToken) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}
