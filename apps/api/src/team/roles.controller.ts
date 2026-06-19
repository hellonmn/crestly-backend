import { Body, Controller, Delete, Get, Param, Post, Put, UsePipes } from "@nestjs/common";
import { RolesService } from "./roles.service";
import { RequirePerm } from "../auth/require-perm.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { RolePermToggleSchema } from "@crestly/shared";
import type { RolePermToggle } from "@crestly/shared";
import { z } from "zod";

const RoleCreateSchema = z.object({
  slug: z.string().min(2).max(40).regex(/^[a-z0-9_-]+$/),
  name: z.string().min(1).max(80),
  description: z.string().max(255).nullable().optional(),
});

@Controller()
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get("roles")
  @RequirePerm("team.roles")
  listRoles() {
    return this.roles.listRoles();
  }

  @Get("permissions")
  @RequirePerm("team.roles")
  listPermissions() {
    return this.roles.listPermissions();
  }

  @Post("roles")
  @RequirePerm("team.roles")
  @UsePipes(new ZodPipe(RoleCreateSchema))
  createRole(@Body() body: z.infer<typeof RoleCreateSchema>) {
    return this.roles.createRole(body);
  }

  @Delete("roles/:slug")
  @RequirePerm("team.roles")
  deleteRole(@Param("slug") slug: string) {
    return this.roles.deleteRole(slug);
  }

  @Put("roles/:slug/permissions")
  @RequirePerm("team.roles")
  togglePermission(
    @Param("slug") slug: string,
    @Body(new ZodPipe(RolePermToggleSchema)) body: RolePermToggle,
  ) {
    return this.roles.togglePermission(slug, body);
  }
}
