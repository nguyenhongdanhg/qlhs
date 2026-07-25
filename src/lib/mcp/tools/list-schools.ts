import { defineTool } from "@lovable.dev/mcp-js";
import { errorResult, supabaseForUser, textResult, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_schools",
  title: "List my schools",
  description:
    "List the schools (đơn vị/trường) the signed-in user belongs to, with the school id needed by other tools.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("school_memberships")
      .select("school_id, role, status, schools(id, name)")
      .eq("user_id", ctx.getUserId())
      .eq("status", "active");
    if (error) return errorResult(error.message);
    const schools = (data ?? []).map((m: any) => ({
      school_id: m.school_id,
      name: m.schools?.name ?? null,
      role: m.role,
    }));
    return { ...textResult(schools), structuredContent: { schools } };
  },
});
