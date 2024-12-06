import jwt from "@elysiajs/jwt";
import { Elysia, redirect, t } from "elysia";
import { postgresDb } from "../../libs/database/client";

export const authService = new Elysia({ name: "auth/service" })
  .use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SECRET ?? "",
    })
  )
  .macro(({ onBeforeHandle }) => ({
    isSignedIn(enabled: boolean) {
      if (!enabled) return;

      onBeforeHandle(async ({ jwt, redirect, cookie: { auth } }) => {
        if (!auth.value) {
          auth.remove();
          return redirect("/auth");
        }

        const profile = await jwt.verify(auth.value);

        if (!profile || !profile.jid) {
          auth.remove();
          return redirect("/auth");
        }

        const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        auth.update({ expires });
      });
    },
  }));

export const authGuarded = new Elysia()
  .use(authService)
  .guard({ isSignedIn: true })
  .resolve(async ({ cookie: { auth }, jwt }) => {
    console.log("Resolve loggedInAs called");
    if (auth && auth.value) {
      const verified = await jwt.verify(auth.value);

      if (verified && typeof verified.jid === "string") {
        const res = await postgresDb
          .selectFrom("entity as e")
          .innerJoin("contact as c", "c.id", "e.id")
          .where("e.creds_name", "=", process.env.SESSION_NAME ?? "")
          .where("e.remote_jid", "=", verified.jid)
          .where("e.type", "=", "Contact")
          .select(["c.saved_name", "e.remote_jid"])
          .executeTakeFirst();

        if (res) return { loggedInAs: { name: res.saved_name, jid: res.remote_jid } };
      }
    }

    return { loggedInAs: null };
  })
  .as("plugin");
