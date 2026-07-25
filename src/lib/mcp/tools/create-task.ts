import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, supabaseForUser, textResult, unauthenticated } from "../supabase";

export default defineTool({
  name: "create_task",
  title: "Create task",
  description:
    "Create a new work item (công việc) for a school. The task is created as the signed-in user.",
  inputSchema: {
    school_id: z.string().describe("School id from list_schools."),
    title: z.string().describe("Task title."),
    category: z.string().describe("Task category, e.g. party, professional, boarding, youth_union."),
    description: z.string().optional().describe("Task details."),
    deadline: z.string().optional().describe("Deadline as an ISO date, e.g. 2026-08-01."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ school_id, title, category, description, deadline }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const trimmed = title.trim();
    if (!trimmed) return errorResult("Title is required.");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        school_id,
        title: trimmed,
        category: category as never,
        description: description?.trim() || null,
        deadline: deadline || null,
        created_by: ctx.getUserId(),
      })
      .select("id, title, category, status, deadline")
      .single();
    if (error) return errorResult(error.message);
    return { ...textResult(data), structuredContent: { task: data } };
  },
});
