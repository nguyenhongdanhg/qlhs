UPDATE public.attendance_sessions 
SET label = CASE session_id
  WHEN 'morning' THEN 'Điểm danh thể dục buổi sáng'
  WHEN 'noon' THEN 'Điểm danh giờ ngủ trưa'
  WHEN 'night' THEN 'Điểm danh giờ ngủ tối'
  ELSE label
END
WHERE session_type = 'boarding' AND session_id IN ('morning', 'noon', 'night');