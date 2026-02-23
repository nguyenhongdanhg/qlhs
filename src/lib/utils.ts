import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Natural sort comparator - sorts strings with numbers in natural order
 * e.g., "1", "2", "10" instead of "1", "10", "2"
 */
export function naturalSortCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Sort an array of strings using natural sort order
 */
export function naturalSort(arr: string[]): string[] {
  return [...arr].sort(naturalSortCompare);
}

/**
 * Vietnamese name sort: sort by last name (tên) first, then middle name (tên đệm)
 * e.g., "Cao Bảo Ngọc" vs "Cáo Thị Á" → Á comes before Ngọc
 */
export function vietnameseNameSortCompare(a: string, b: string): number {
  const partsA = a.trim().split(/\s+/);
  const partsB = b.trim().split(/\s+/);
  const lastA = partsA[partsA.length - 1] || '';
  const lastB = partsB[partsB.length - 1] || '';
  const lastCmp = lastA.localeCompare(lastB, 'vi');
  if (lastCmp !== 0) return lastCmp;
  // Compare remaining parts (middle + first name) from left to right
  const midA = partsA.slice(0, -1).join(' ');
  const midB = partsB.slice(0, -1).join(' ');
  return midA.localeCompare(midB, 'vi');
}
