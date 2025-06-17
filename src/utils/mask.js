export const maskName = (fullName) => {
  if (!fullName) return '';
  const parts = fullName.trim().split(' ');
  const first = parts[0];
  const rest = parts.slice(1).join(' ');

  const firstMasked = first.slice(0, 2) + '*'.repeat(Math.max(1, first.length - 2));
  const restMasked = rest
    ? rest
        .split(' ')
        .map((w) => w[0] + '*'.repeat(w.length - 1))
        .join(' ')
    : '';

  return `${firstMasked} ${restMasked}`.trim();
};

export const maskWhatsapp = (number) => {
  if (!number) return '';
  return number.slice(0, 2) + ' ' + '*'.repeat(number.length - 2);
};
