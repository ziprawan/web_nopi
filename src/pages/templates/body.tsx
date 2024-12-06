import { Html } from "@elysiajs/html";
import tailwindConfig from "../../../tailwind.config";

export default function HTMLTemplate({
  title,
  children,
  scripts,
}: {
  title?: string;
  scripts?: { content: string; position: "top" | "bottom" }[];
  children: any;
}) {
  return (
    <html lang="en">
      <head>
        <title>OPC Bot | {title ?? "-"}</title>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <script src="/assets/tailwindcss-3.4.15.js"></script>
        <script>tailwind.config = &#123;theme: {JSON.stringify(tailwindConfig.theme ?? {})}&#125;</script>
        {scripts && scripts.filter((s) => s.position === "top").map((s) => <script>{s.content}</script>)}
      </head>
      <body class={"bg-[#130f17] text-[#f8fafc]"}>{children}</body>
      {scripts && scripts.filter((s) => s.position === "bottom").map((s) => <script>{s.content}</script>)}
    </html>
  );
}
