export interface DeviceLabel {
  browser: string;
  os: string;
  label: string;
}

export function parseUserAgent(ua: string | null | undefined): DeviceLabel {
  if (!ua) return { browser: 'Desconhecido', os: 'Desconhecido', label: 'Dispositivo desconhecido' };

  let os = 'Desconhecido';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/iphone/i.test(ua)) os = 'iPhone';
  else if (/ipad/i.test(ua)) os = 'iPad';
  else if (/mac os/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/linux/i.test(ua)) os = 'Linux';

  let browser = 'Navegador';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/opr\/|opera/i.test(ua)) browser = 'Opera';
  else if (/chrome\//i.test(ua)) browser = 'Chrome';
  else if (/firefox\//i.test(ua)) browser = 'Firefox';
  else if (/safari\//i.test(ua)) browser = 'Safari';

  return { browser, os, label: `${browser} no ${os}` };
}
