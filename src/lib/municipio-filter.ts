/**
 * Helpers para garantir isolamento por município em todas as queries.
 * super_admin respeita o município ativo da sessão quando selecionado.
 */

export function getActiveMid(req: any): number | null {
  const raw = req?.session?.activeMunicipioId;
  return raw ? parseInt(String(raw), 10) : null;
}

export function municipioWhere(user: any, extra: Record<string, any> = {}, activeMid?: number | null): Record<string, any> {
  if (user.role === 'super_admin') {
    if (activeMid) return { municipio_id: activeMid, ...extra };
    return extra;
  }
  return { municipio_id: user.municipio_id, ...extra };
}

export function secretariaWhere(user: any, extra: Record<string, any> = {}, activeMid?: number | null): Record<string, any> {
  if (user.role === 'super_admin') {
    if (activeMid) return { municipio_id: activeMid, ...extra };
    return extra;
  }
  if (user.role === 'secretaria') {
    return { municipio_id: user.municipio_id, secretaria_id: user.secretaria_id, ...extra };
  }
  return { municipio_id: user.municipio_id, ...extra };
}
