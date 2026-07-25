import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, supabaseForUser, textResult, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_students",
  title: "List students",
  description:
    "List students (học sinh) of a school, optionally searching by name or student code and filtering boarding students.",
  inputSchema: {
    school_id: z.string().describe("School id from list_schools."),
    search: z.string().optional().describe("Search text matched against full name or student code."),
    boarding_only: z.boolean().optional().describe("Only return boarding (nội trú) students."),
    limit: z.number().optional().describe("Max rows to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ school_id, search, boarding_only, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("students")
      .select("id, student_code, full_name, gender, date_of_birth, is_boarding, room_number, class_id, classes(name)")
      .eq("school_id", school_id)
      .eq("is_active", true)
      .limit(Math.min(Math.max(limit ?? 50, 1), 200));
    if (boarding_only) query = query.eq("is_boarding", true);
    if (search?.trim()) {
      const s = search.trim();
      query = query.or(`full_name.ilike.%${s}%,student_code.ilike.%${s}%`);
    }
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return { ...textResult(data ?? []), structuredContent: { students: data ?? [] } };
  },
});
