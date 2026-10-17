import { runWritingFeedback } from "@/lib/server/ai-services";
import { errorJson, guardExpensive, json, parseBody } from "@/lib/server/http";
import { writingRequestSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const blocked = await guardExpensive(req, "writing");
  if (blocked) return blocked;
  const body = await parseBody(req, writingRequestSchema);
  if (!body.ok) return body.res;
  try {
    return json(await runWritingFeedback(body.data));
  } catch {
    return errorJson("bad_activity", "Unknown activity.", 400);
  }
}
