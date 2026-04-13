import { promises as fs } from "node:fs";
import path from "node:path";

function line(v: string) {
  return String(v ?? "").replace(/\r/g, "");
}

export async function appendAssistantDailyTxtLog(args: {
  userLabel: string;
  mode: "faq" | "llm" | "knowledge" | "miss" | "verified" | "pending_review";
  question: string;
  answer: string;
  at?: Date;
}) {
  const now = args.at ?? new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes(),
  ).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

  const dir = path.join(process.cwd(), "file", "meeting");
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${date}.txt`);

  const block = [
    "----------------------------------------",
    `[${time}] user=${line(args.userLabel)} mode=${args.mode}`,
    `Q: ${line(args.question)}`,
    `A: ${line(args.answer)}`,
    "",
  ].join("\n");

  await fs.appendFile(filePath, block, "utf8");
}
