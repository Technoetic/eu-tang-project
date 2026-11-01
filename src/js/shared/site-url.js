export function normalizeBasePath(value = '/') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\?#\u0000-\u0020]/.test(value)) throw new Error('Invalid base path');
  if (value === '/') return '/';
  const segments = value.replace(/\/$/, '').slice(1).split('/');
  for (const segment of segments) {
    let decoded;
    try { decoded = decodeURIComponent(segment); } catch { throw new Error('Invalid base path'); }
    if (!decoded || decoded === '.' || decoded === '..' || /[\\/?#\u0000-\u0020]/.test(decoded) || /%[a-f0-9]{2}/i.test(decoded)) throw new Error('Invalid base path');
  }
  return value.endsWith('/') ? value : value + '/';
}
