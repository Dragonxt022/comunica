let _cache: { cfg: any; statusEventos: any; metas: any[] } | null = null;
let _expiry = 0;

export function getConfigCache() {
  return _cache && Date.now() < _expiry ? _cache : null;
}

export function setConfigCache(cfg: any, statusEventos: any, metas: any[] = []) {
  _cache = { cfg, statusEventos, metas };
  _expiry = Date.now() + 30_000;
}

export function bustConfigCache() {
  _expiry = 0;
}
