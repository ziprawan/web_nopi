import { Html } from "@elysiajs/html";
import { postgresDb } from "../../libs/database/client";
import TitleHoldersPage from "../../pages/user/titles/holders";
import type { GroupInfo, Titles, TitlesWithHolders } from "../../types/titles";
import { titlesController } from "./titles";

export const titleHoldersController = titlesController.group("/holders/:title_id", (app) =>
  app
    .onBeforeHandle(({ titles, redirect, groupInfo, params: { title_id } }) => {
      if (!groupInfo) {
        // TODO: Return group not found or maybe you are not participant of this group
        return redirect("/user/titles");
      }
      if (!titles || !titles.map((t) => t.id).includes(title_id)) {
        // TODO: Return title not found
        return { ok: false, message: `This title id (${title_id}) isn't exists` };
      }
    })
    .resolve(async ({ titles, params: { title_id } }) => {
      const holders = await postgresDb
        .selectFrom("title_holder as th")
        .innerJoin("participant as p", "p.id", "th.participant_id")
        .leftJoin("entity as e", (cb) =>
          cb
            .onRef("e.remote_jid", "=", "p.participant_jid")
            .on("e.creds_name", "=", process.env.SESSION_NAME ?? "")
            .on("e.type", "=", "Contact")
        )
        .leftJoin("contact as c", "c.id", "e.id")
        .select(["p.participant_jid as jid", "c.saved_name as name"])
        .where("th.title_id", "=", title_id)
        .execute();

      const filteredTitle = titles?.filter((t) => t.id === title_id)[0] as Titles;
      const titleInfo: TitlesWithHolders = {
        ...filteredTitle,
        holders,
      };

      return { titleInfo };
    })
    .all("/", async ({ success, titleInfo, query, groupInfo }) => {
      let result = "";

      if (query.success && query.failReason) result = "???";
      else if (typeof query.success === "string" && success.checkSuccess("assign_participant_title", query.success)) {
        result = "success";
      } else if (typeof query.failReason === "string") result = query.failReason;

      return <TitleHoldersPage groupInfo={groupInfo as GroupInfo} titleInfo={titleInfo} result={result} />;
    })
    .post(
      "/assign",
      async ({ success, redirect, body, groupInfo, titleInfo: { holders, id: title_id }, set: { headers } }) => {
        if (!body || typeof body !== "object") {
          // TODO: redirect back to title holders list
          return { ok: false, description: "Received body is not an object" };
        }

        const entries = Object.entries(body);
        const { participants, jid } = (groupInfo as GroupInfo).group; // Assume groupInfo is not null because already guarded

        const participantIds: Record<string, string> = {};
        const holdingStates: Record<string, boolean> = {};
        const validBodies: Record<string, true> = {};

        const adds: string[] = []; // Array of participant_jid to add to title holders
        const rems: string[] = []; // Array of participant_jid to remove to title holders

        // Well, O(h + 2 * p + e) time complexity? IDK tho
        // h for holders length
        // p for participants length
        // e for entries length

        holders.forEach(({ jid }) => {
          holdingStates[jid] = true;
        });

        participants.forEach(({ jid, id }) => {
          participantIds[jid] = id;
          if (holdingStates[jid] !== true) holdingStates[jid] = false;
        });

        entries.forEach(([jid, value]) => {
          const holdingState = holdingStates[jid];
          if (value !== "y" || holdingState === undefined) return;
          validBodies[jid] = true;
          if (holdingState === false) adds.push(participantIds[jid]);
        });

        participants.forEach(({ jid }) => {
          if (holdingStates[jid] === true && validBodies[jid] === undefined) rems.push(participantIds[jid]);
        });

        const ignoredLength = entries.length - adds.length;
        headers["x-ignored-length"] = String(ignoredLength);

        if (adds.length > 0) {
          // Insert all adds
          await postgresDb
            .insertInto("title_holder")
            .values(adds.map((add) => ({ participant_id: add, title_id })))
            .execute();
        }

        if (rems.length > 0) {
          // Delete all rems
          await postgresDb
            .deleteFrom("title_holder as th")
            .where("th.participant_id", "in", rems)
            .where("th.title_id", "=", title_id)
            .execute();
        }

        const modifiedLength = adds.length + rems.length;

        return redirect(
          `/user/titles/${jid.split("@")[0]}/holders/${title_id}?` +
            (modifiedLength === 0 ? "failReason=notModified" : `success=${success.addSuccess("assign_participant_title")}`)
        );
      }
    )
);
