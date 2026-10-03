import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthSessionUser } from '@diagramz/shared';

export const CurrentUser = createParamDecorator(
  (data: keyof AuthSessionUser | undefined, ctx: ExecutionContext): AuthSessionUser | unknown => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthSessionUser | undefined;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
