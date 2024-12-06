import type { GroupInfo } from "../../../types/titles";
import { Html } from "@elysiajs/html";
import HTMLTemplate from "../../templates/body";

declare global {
  namespace JSX {
    interface HtmlInputTag {
      autocapitalize?: "none" | "off" | "sentences" | "on" | "words" | "characters";
      autocorrect?: "" | "on" | "off";
    }
  }
}

export default function TitlesAdminCreate({
  groupInfo: g,
  url: u,
  failReason: fr,
}: {
  url: string;
  failReason: string | undefined;
  groupInfo: GroupInfo;
}) {
  if (g.me.role === "MEMBER") return <HTMLTemplate>Ada yang salah.</HTMLTemplate>;

  let err: string = "";

  switch (fr) {
    case "invalidBody": {
      err = "Invalid body was sent";
      break;
    }
    case "titleTaken": {
      err = "Title already created";
      break;
    }
    case "shortTitle": {
      err = "Title is too short (minimum characters is 3)";
      break;
    }
    case "longTitle": {
      err = "Title is too long (maximum characters is 100)";
      break;
    }
    case "invalidTitle": {
      err = "Title can only contains alphanumeric";
      break;
    }
    default: {
      err = "";
    }
  }

  return (
    <HTMLTemplate>
      <div class={"p-4"}>
        {err && <div class={"text-red-500 font-bold my-2"}>{err}</div>}
        <div class={"text-xl mb-2"}>
          Status kamu saat ini:{" "}
          <b class={"font-bold"} safe>
            {g.me.role}
          </b>
        </div>
        <form class={"flex flex-col gap-2 w-fit"} action={u} method="post">
          <input
            name="titleName"
            class={"bg-[#130f17] text-white border border-white px-4 py-2 rounded-sm"}
            placeholder="Title name"
            autocapitalize="off"
            autocorrect="off"
            autofocus="on"
          />
          <button type="submit">SUBMIT</button>
        </form>
      </div>
    </HTMLTemplate>
  );
}
