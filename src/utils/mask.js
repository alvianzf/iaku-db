export const maskName = (fullName) => {
    if (!fullName || typeof fullName !== 'string') return '';
    
    const trimmedName = fullName.trim();
    if (!trimmedName) return '';
    
    const parts = trimmedName.split(' ');
    const first = parts[0];
    const rest = parts.slice(1).join(' ');

    const firstMasked = first.slice(0, 2) + '*'.repeat(Math.max(1, first.length - 2));
    const restMasked = rest
        ? rest
                .split(' ')
                .map((w) => w[0] + '*'.repeat(Math.max(0, w.length - 1)))
                .join(' ')
        : '';

    return `${firstMasked} ${restMasked}`.trim();
};

export const maskWhatsapp = (number) => {
    if (!number || typeof number !== 'string') return '';
    
    const trimmedNumber = number.trim();
    if (!trimmedNumber) return '';
    
    return trimmedNumber.slice(0, 2) + ' ' + '*'.repeat(trimmedNumber.length - 2);
};
