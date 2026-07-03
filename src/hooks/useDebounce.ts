import { useEffect, useState } from "react";

/**
 * Trả về giá trị sau khi delay (ms). Dùng cho ô tìm kiếm để tránh
 * gọi query mỗi lần gõ phím. KHÔNG thay đổi giá trị gốc.
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}
