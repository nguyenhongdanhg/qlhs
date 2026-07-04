// Generate default password from Vietnamese full name.
// Rule: last word of name, remove diacritics, capitalize first letter, append "@123".
// Example: "Đặng Phương Nam" -> "Nam@123"
export function removeVietnameseDiacritics(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

export function getDefaultPassword(fullName: string): string {
  const name = (fullName || '').trim().replace(/\s+/g, ' ');
  if (!name) return '123456';
  const parts = name.split(' ');
  const last = removeVietnameseDiacritics(parts[parts.length - 1]).replace(/[^A-Za-z]/g, '');
  if (!last) return '123456';
  const cap = last.charAt(0).toUpperCase() + last.slice(1).toLowerCase();
  return `${cap}@123`;
}
