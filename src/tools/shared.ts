import { z } from "zod";

export const patchOp = z.object({
  op: z.enum(["replace", "add", "remove"]),
  path: z.string(),
  value: z.unknown().optional(),
});

export const sentinelParams = {
  user_intent: z.string().min(20).describe(
    "Plain-English description of what the user asked for. " +
      "Must be at least 20 characters. Example: " +
      "'User asked to close ticket 12345 because they have billed it.'",
  ),
  user_quote: z.string().min(20).describe(
    "Verbatim quote of the user's actual words that motivated this action. " +
      "Do not paraphrase. If multiple turns, quote the most recent relevant message.",
  ),
};
