import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private allowedRoles: string[]) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // if no user
    if (!user) {
      throw new ForbiddenException('No user found in request');
    }

    // role check
    if (!this.allowedRoles.includes(user.role)) {
      throw new ForbiddenException(
        `${user.role} is not allowed to access this resource`,
      );
    }

    return true;
  }
}