import { Elysia } from "elysia";

const TAILWIND_VERSION = "3.4.15";

export const assetsController = new Elysia({ prefix: "/assets" }).get("/tailwindcss-3.4.15.js", async ({ set, headers }) => {
  if (headers["if-none-match"] === TAILWIND_VERSION) {
    set.status = "Not Modified";
    return;
  }

  set.headers.etag = TAILWIND_VERSION;
  set.headers["cache-control"] = "max-age=3600";

  // const file = Bun.file("src/assets/tailwindcss-3.4.15.js");
  // const content = await file.text();
  return Bun.file("src/assets/tailwindcss-3.4.15.js");
});
