import html, { Html } from "@elysiajs/html";
import { Elysia } from "elysia";
import { postgresDb } from "../libs/database/client";
import IndexPage from "../pages";
import { authService } from "./auth/service";

export const index = new Elysia()
  .use(html())
  .use(authService)
  .resolve(async ({ cookie: { auth }, jwt }) => {
    if (auth && auth.value) {
      const verified = await jwt.verify(auth.value);

      if (verified && typeof verified.jid === "string") {
        const res = await postgresDb
          .selectFrom("entity as e")
          .innerJoin("contact as c", "c.id", "e.id")
          .where("e.creds_name", "=", process.env.SESSION_NAME ?? "")
          .where("e.remote_jid", "=", verified.jid)
          .where("e.type", "=", "Contact")
          .select("c.saved_name")
          .executeTakeFirst();

        if (res) return { loggedInAs: res.saved_name };
      }
    }

    return { loggedInAs: null };
  })
  .get("/", ({ loggedInAs }) => <IndexPage loggedInAs={loggedInAs} />);
