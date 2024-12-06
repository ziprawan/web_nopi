import { Html } from "@elysiajs/html";
import { z } from "zod";
import { postgresDb } from "../../libs/database/client";
import TitlesAdminCreate from "../../pages/user/titles/create";
import { titleHoldersController } from "./title_holders";

const createTitleSchema = z.object(
  {
    titleName: z
      .string()
      .min(3, "shortTitle")
      .max(100, "longTitle")
      .regex(/^[a-zA-Z0-9]*$/, "invalidTitle"),
  },
  { invalid_type_error: "invalidBody" }
);

export const titleAdminsController = titleHoldersController
  .guard({ isParticipantAdmin: true })
  .get("/create", ({ redirect, groupInfo, request: { url }, query: { failReason } }) => {
    if (!groupInfo) return redirect("/");

    return <TitlesAdminCreate groupInfo={groupInfo} url={url} failReason={failReason} />;
  })
  .post("/create", async ({ redirect, groupInfo, body, request: { url: u } }) => {
    if (!groupInfo) return { ok: false, description: "Not a member of that group" };

    const url = new URL(u);
    const zodResult = createTitleSchema.safeParse(body);

    if (!zodResult.success) {
      try {
        const parsed = JSON.parse(zodResult.error.message);
        url.searchParams.set("failReason", parsed[0].message);
        return redirect(url.href);
      } catch (err) {
        console.error(err);
        url.searchParams.set("failReason", "invalidBody");
        return redirect(url.href);
      }
    }

    const { titleName } = zodResult.data;

    const executed = await postgresDb
      .insertInto("title")
      .values({ group_id: groupInfo.group.id, title_name: titleName.toLowerCase() })
      .returning("id")
      .onConflict((oc) => oc.columns(["group_id", "title_name"]).doNothing())
      .executeTakeFirst();

    if (!executed) {
      url.searchParams.set("failReason", "titleTaken");
      return redirect(url.href);
    }

    return { ok: true, message: "Title is not saved yet." };
  });
