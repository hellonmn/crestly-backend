import { Controller, Get, Query } from "@nestjs/common";
import { SearchService } from "./search.service";
import { ZodPipe } from "../common/zod.pipe";
import { SearchQuerySchema } from "@crestly/shared";
import type { SearchQuery } from "@crestly/shared";

@Controller("search")
export class SearchController {
  constructor(private readonly svc: SearchService) {}

  /**
   * GET /api/search?q=…&limit=6
   *
   * Open to every logged-in user — results respect the existing per-row
   * permission gates via Prisma's RequestPrismaService (RLS). Cmd+K from
   * a teacher account only surfaces students they're allowed to see.
   */
  @Get()
  run(@Query(new ZodPipe(SearchQuerySchema)) query: SearchQuery) {
    return this.svc.search(query);
  }
}
