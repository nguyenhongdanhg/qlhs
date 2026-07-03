/**
 * Bản đồ path -> dynamic import để prefetch chunk khi user hover menu.
 * Chỉ gọi import() (trình duyệt cache), KHÔNG render, KHÔNG thay đổi logic.
 */
const preloaders: Record<string, () => Promise<unknown>> = {
  "/students": () => import("@/pages/Students"),
  "/teachers": () => import("@/pages/Teachers"),
  "/tasks": () => import("@/pages/Tasks"),
  "/boarding": () => import("@/pages/Boarding"),
  "/evening-study": () => import("@/pages/EveningStudy"),
  "/dormitory-exit": () => import("@/pages/DormitoryExit"),
  "/meals": () => import("@/pages/Meals"),
  "/meal-menu": () => import("@/pages/MealMenu"),
  "/health": () => import("@/pages/Health"),
  "/emulation": () => import("@/pages/Emulation"),
  "/statistics": () => import("@/pages/Statistics"),
  "/duty-schedule": () => import("@/pages/DutySchedule"),
  "/user-management": () => import("@/pages/UserManagement"),
  "/settings": () => import("@/pages/Settings"),
  "/guide": () => import("@/pages/Guide"),
};

const prefetched = new Set<string>();

export function preloadRoute(path: string) {
  if (prefetched.has(path)) return;
  const loader = preloaders[path];
  if (!loader) return;
  prefetched.add(path);
  // Không await, không catch để lỗi mạng không tạo unhandled rejection lộ.
  loader().catch(() => prefetched.delete(path));
}
