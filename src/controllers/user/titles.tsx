import { html, Html } from "@elysiajs/html";
import { Elysia } from "elysia";
import { jsonArrayFrom } from "kysely/helpers/postgres";
import { postgresDb } from "../../libs/database/client";
import { isLiterallyNumeric } from "../../libs/utils/isNumeric";
import TitlesGroupPage from "../../pages/user/titles/group";
import type { GroupInfo, ParticipantInfo, Titles } from "../../types/titles";
import { authGuarded } from "../auth/service";

type SuccessType = "assign_title" | "assign_participant_title";

class Success {
  constructor() {}

  public assignTitleSuccess: Set<string> = new Set();
  public assignParticipantTitleSuccess: Set<string> = new Set();

  addSuccess(type: SuccessType): string {
    const code = crypto.getRandomValues(new Uint32Array(1))[0].toString().padStart(10, "0");

    if (type === "assign_title") this.assignTitleSuccess.add(code);
    else if (type === "assign_participant_title") this.assignParticipantTitleSuccess.add(code);

    return code;
  }

  checkSuccess(type: SuccessType, code: string): boolean {
    switch (type) {
      case "assign_title": {
        return this.assignTitleSuccess.delete(code);
      }
      case "assign_participant_title": {
        return this.assignParticipantTitleSuccess.delete(code);
      }
    }

    return false;
  }
}

export const titlesController = new Elysia({ prefix: "/user/titles/:group_id" })
  .use(authGuarded)
  .resolve(async ({ loggedInAs, params: { group_id: groupId } }) => {
    if (!loggedInAs) return { groupInfo: null, titles: null };

    const participantJid = loggedInAs.jid;
    const groupJid = groupId + "@g.us";

    const foundAllParticipants = await postgresDb
      .selectFrom("entity as e")
      .innerJoin("group as g", "g.id", "e.id")
      .innerJoin("participant as p", "p.group_id", "e.id")
      .select((eb) => [
        "e.id as group_id",
        "e.remote_jid as group_jid",
        "g.subject as group_name",
        jsonArrayFrom(
          eb
            .selectFrom("participant as p")
            .leftJoin("entity as ec", (cb) =>
              cb
                .onRef("ec.remote_jid", "=", "p.participant_jid")
                .on("ec.creds_name", "=", process.env.SESSION_NAME ?? "")
                .on("ec.type", "=", "Contact")
            )
            .leftJoin("contact as c", "c.id", "ec.id")
            .select(["c.saved_name as name", "p.role", "p.id", "p.participant_jid as jid"])
            .whereRef("p.group_id", "=", "e.id")
        ).as("participants"),
      ])
      .where("e.creds_name", "=", process.env.SESSION_NAME ?? "")
      .where("e.type", "=", "Group")
      .where("e.remote_jid", "=", groupJid)
      .where("p.participant_jid", "=", participantJid)
      .executeTakeFirst();

    if (!foundAllParticipants) {
      return { groupInfo: null };
    }

    console.log(foundAllParticipants);

    const groupInfo: GroupInfo = {
      me: foundAllParticipants.participants.find((p) => p.jid === participantJid) as ParticipantInfo,
      group: {
        id: foundAllParticipants.group_id,
        jid: foundAllParticipants.group_jid,
        participants: foundAllParticipants.participants,
        name: foundAllParticipants.group_name,
      },
    };

    const titlesQuery = postgresDb
      .selectFrom("title as t")
      .select((eb) => [
        "t.id",
        "t.title_name",
        "t.claimable",
        eb
          .exists(
            eb
              .selectFrom("title_holder as th")
              .whereRef("th.title_id", "=", "t.id")
              .where("th.participant_id", "=", groupInfo.me.id)
          )
          .as("holding"),
      ])
      .where("t.group_id", "=", groupInfo.group.id);

    const foundTitles: Titles[] = (await titlesQuery.execute()).map(({ holding, ...others }) => {
      return {
        ...others,
        holding: holding as boolean,
      };
    });

    return {
      groupInfo,
      titles: foundTitles,
    };
  })
  .macro(({ onBeforeHandle }) => ({
    isParticipantExists(enabled: boolean) {
      if (!enabled) return;

      onBeforeHandle(({ groupInfo, redirect }) => {
        if (!groupInfo) return redirect("/user/titles");
      });
    },
    isParticipantAdmin(enabled: boolean) {
      if (!enabled) return;

      onBeforeHandle(({ groupInfo, redirect }) => {
        if (!groupInfo) return redirect("/user/titles");
        if (groupInfo.me.role === "MEMBER") return { ok: false, description: "Kamu bukan admin mas" };
      });
    },
  }))
  .guard({ isParticipantExists: true })
  .use(html())
  .decorate("success", new Success())
  .get("/", async ({ titles, loggedInAs, redirect, groupInfo, query, success }) => {
    if (!loggedInAs || !groupInfo) return redirect("/");

    let result = "";

    if (query.success && query.failReason) result = "???";
    else if (typeof query.success === "string" && success.checkSuccess("assign_title", query.success)) {
      result = "success";
    } else if (typeof query.failReason === "string") result = query.failReason;

    return <TitlesGroupPage groupInfo={groupInfo} titles={titles} result={result} />;
  })
  .post("/assign", async ({ body, titles, groupInfo, set, success, redirect }) => {
    if (!titles) {
      // TODO: Redirect back to group titles list
      return { ok: false, description: "No titles found." };
    }

    if (!body || typeof body !== "object") {
      // TODO: redirect back to group titles list
      return { ok: false, description: "Received body is not an object" };
    }

    const adds: string[] = []; // Array of title_id to add from participant
    const rems: string[] = []; // Array of title_id to remove from participant
    const filteredTitles = titles.filter((t) => t.claimable).map((t) => ({ id: t.id, holding: t.holding }));

    const entries = Object.entries(body);
    const validBodyIds = entries.filter(([k, v]) => isLiterallyNumeric(k) && v === "y").map((k) => k[0]);

    filteredTitles.forEach(({ id, holding }) => {
      if (holding && !validBodyIds.includes(id)) {
        rems.push(id);
      } else if (!holding && validBodyIds.includes(id)) {
        adds.push(id);
      }
    });

    const ignoredLength = entries.length - adds.length;
    set.headers["x-ignored-length"] = String(ignoredLength);

    if (adds.length > 0) {
      // Insert all adds
      await postgresDb
        .insertInto("title_holder")
        .values(adds.map((add) => ({ participant_id: groupInfo.me.id, title_id: add })))
        .execute();
    }

    if (rems.length > 0) {
      // Delete all rems
      await postgresDb
        .deleteFrom("title_holder as th")
        .where("th.participant_id", "=", groupInfo.me.id)
        .where("th.title_id", "in", rems)
        .execute();
    }

    const modifiedLength = adds.length + rems.length;

    return redirect(
      `/user/titles/${groupInfo.group.jid.split("@")[0]}?` +
        (modifiedLength === 0 ? "failReason=notModified" : `success=${success.addSuccess("assign_title")}`)
    );
  });
