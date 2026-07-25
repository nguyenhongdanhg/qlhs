import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, supabaseForUser, textResult, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_tasks",
  title: "List tasks",
  description:
    "List assigned work items (công việc & tiến độ) for a school, optionally filtered by status or category, ordered by deadline.",
  inputSchema: {
    school_id: z.string().describe("School id from list_schools."),
    status: z.string().optional().describe("Filter by task status, e.g. pending or completed."),
    category: z.string().optional().describe("Filter by task category."),
    limit: z.number().optional().describe("Max rows to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ school_id, status, category, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("tasks")
      .select("id, title, description, category, status, deadline, completed_at, assignee_id, created_at")
      .eq("school_id", school_id)
      .order("deadline", { ascending: true, nullsFirst: false })
      .limit(Math.min(Math.max(limit ?? 50, 1), 200));
    if (status) query = query.eq("status", status as never);
    if (category) query = query.eq("category", category as never);
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return { ...textResult(data ?? []), structuredContent: { tasks: data ?? [] } };
  },
});
