import { Elysia } from "elysia";
import { index } from "./controllers";
import { assetsController } from "./controllers/assets/assets.controller";
import { auth } from "./controllers/auth/signin";
import { user } from "./controllers/user";
import { titleAdminsController } from "./controllers/user/title_admins";

const app = new Elysia()
  .onError((err) => {
    console.log("onError called");
    console.error(err);

    // return { ok: false, description: { summary: "Internal Server Error" }, error: err.error.message };
  })
  .use(index)
  .use(user)
  .use(auth)
  .use(assetsController)
  .use(titleAdminsController)
  .onError((err) => console.error(err))
  .listen(process.env.PORT ?? 3000);

console.log(`🦊 Elysia is running at ${app.server?.url}`);
