import { Html } from "@elysiajs/html";
import HTMLTemplate from "../templates/body";

export default function UserIndexPage() {
  return (
    <HTMLTemplate title="User">
      <div class={"p-6"}>
        <div class={"text-3xl"}>
          <a href="/" class={"underline"}>
            Back to Home
          </a>
        </div>
        <div>Nothing to do in here!</div>
      </div>
    </HTMLTemplate>
  );
}
