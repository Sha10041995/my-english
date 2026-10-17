import { runTutor } from "@/lib/server/ai-services";
import { errorJson, guardExpensive, json, parseBody } from "@/lib/server/http";
import { tutorRequestSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const blocked = await guardExpensive(req, "tutor");
  if (blocked) return blocked;
  const body = await parseBody(req, tutorRequestSchema);
  if (!body.ok) return body.res;
  try {
    return json(await runTutor(body.data));
  } catch {
    return errorJson("bad_activity", "Unknown activity.", 400);
  }
}
