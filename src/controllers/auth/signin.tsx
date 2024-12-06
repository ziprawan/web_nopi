import { html, Html } from "@elysiajs/html";
import Elysia from "elysia";
import { z } from "zod";
import { postgresDb } from "../../libs/database/client";
import AuthIndexPage from "../../pages/auth";
import { authGuarded, authService } from "./service";

async function updateSigninCode(remoteJid: string) {
  const newCode = crypto.getRandomValues(new Uint32Array(1))[0].toString().slice(0, 6).padStart(6, "0");
  await postgresDb
    .updateTable("contact as c")
    .set({ signin_code: newCode })
    .from("entity as e")
    .whereRef("e.id", "=", "c.id")
    .where("e.remote_jid", "=", remoteJid)
    .where("e.creds_name", "=", process.env.SESSION_NAME ?? "")
    .execute();
}

const loginSchema = z.object({
  remoteJid: z.string(),
  code: z.string().length(6),
});

export const auth = new Elysia({ prefix: "/auth" })
  .use(authService)
  .use(html())
  .group("", (app) =>
    app
      .onBeforeHandle(async ({ cookie: { auth }, jwt, redirect }) => {
        if (auth && auth.value) {
          const verified = await jwt.verify(auth.value);

          if (verified && typeof verified.jid === "string") {
            const res = await postgresDb
              .selectFrom("entity as e")
              .where("e.creds_name", "=", process.env.SESSION_NAME ?? "")
              .where("e.remote_jid", "=", verified.jid)
              .executeTakeFirst();

            if (res) return redirect("/");
          }
        }
      })
      .all("/", async ({ query: { failReason } }) => {
        return <AuthIndexPage failReason={failReason} />;
      })
      .all("/signin", async ({ request: { method }, jwt, set, error, redirect, body, cookie: { auth } }) => {
        if (method.toLowerCase() !== "post") return error("Method Not Allowed");

        if (auth && auth.value) {
          console.log(auth, auth.value);
          const verified = await jwt.verify(auth.value);

          if (verified && typeof verified.jid === "string") {
            const res = await postgresDb
              .selectFrom("entity as e")
              .where("e.creds_name", "=", process.env.SESSION_NAME ?? "")
              .where("e.remote_jid", "=", verified.jid)
              .executeTakeFirst();

            console.log(verified.res);

            if (res) return redirect("/");
          }
        }

        const zodResult = loginSchema.safeParse(body);

        if (!zodResult.success) {
          try {
            const parsed = JSON.parse(zodResult.error.message)[0];
            const reason =
              parsed.code === "invalid_type"
                ? "invalidType"
                : parsed.code === "too_small"
                ? "invalidCodeLength"
                : "unknwonError";

            return redirect("/auth?failReason=" + reason);
          } catch (err) {
            console.log(err);
            set.status = "Internal Server Error";
            return { ok: false, description: "[Auth#00] Internal Server Error" };
          }
        }

        const remoteJid = zodResult.data.remoteJid + "@s.whatsapp.net";
        const code = zodResult.data.code;

        const serverCode = await postgresDb
          .selectFrom("contact as c")
          .select("c.signin_code as code")
          .innerJoin("entity as e", "e.id", "c.id")
          .where("e.remote_jid", "=", remoteJid)
          .where("e.creds_name", "=", process.env.SESSION_NAME ?? "")
          .executeTakeFirst();

        if (!serverCode || serverCode.code !== code) {
          await updateSigninCode(remoteJid);
          auth.remove();

          return redirect("/auth?failReason=invalidCode", 302);
        }

        await updateSigninCode(remoteJid);
        auth.value = await jwt.sign({ jid: remoteJid });
        auth.expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        return redirect("/");
      })
  )
  .use(authGuarded)
  .get("/profile", async ({ jwt, cookie: { auth } }) => {
    const jid = await jwt.verify(auth.value);

    return { ok: true, message: jid };
  })
  .get("/signout", ({ redirect, cookie: { auth }, query: { redirect: red } }) => {
    auth.remove();

    if (red === "home") return redirect("/");
    return redirect("/auth");
  });
