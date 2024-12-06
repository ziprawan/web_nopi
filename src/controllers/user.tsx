import { html, Html } from "@elysiajs/html";
import { Elysia } from "elysia";
import { sql } from "kysely";
import { postgresDb } from "../libs/database/client";
import { authGuarded } from "./auth/service";

import UserIndexPage from "../pages/user";
import UserTitlesPage from "../pages/user/titles";

export const user = new Elysia({ prefix: "/user" })
  .use(html())
  .use(authGuarded)
  .get("/", () => <UserIndexPage />)
  .get("/titles", async ({ redirect, loggedInAs }) => {
    if (!loggedInAs) return redirect("/");

    try {
      const groups = (
        await postgresDb
          .selectFrom("participant as p")
          .innerJoin("group as g", "g.id", "p.group_id")
          .innerJoin("entity as e", "e.id", "g.id")
          .select(["g.subject", "e.remote_jid"])
          .select(sql<string>`SUBSTRING("g"."desc" FROM 0 FOR 200)`.as("desc"))
          .where("p.participant_jid", "=", loggedInAs.jid)
          .where("e.creds_name", "=", process.env.SESSION_NAME ?? "")
          .execute()
      ).map(({ remote_jid, ...others }) => ({ ...others, remote_jid: remote_jid.split("@")[0] }));

      return <UserTitlesPage groups={groups} />;
    } catch (err) {
      return { ok: false, description: (err as Error).stack };
    }
  });
