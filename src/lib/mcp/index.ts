import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listSchools from "./tools/list-schools";
import listTasks from "./tools/list-tasks";
import createTask from "./tools/create-task";
import listStudents from "./tools/list-students";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "noitrubantru-mcp",
  title: "Quản lý nội trú/bán trú",
  version: "0.1.0",
  instructions:
    "Tools for the boarding/semi-boarding school management app. Call `list_schools` first to get a school_id, then use `list_tasks`, `create_task`, or `list_students` with that id. All data is scoped to the signed-in user's permissions.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listSchools, listTasks, createTask, listStudents],
});
