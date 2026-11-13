// ============================================================================
// Connexion au dashboard (Supabase)
// À remplir avec les infos de TON projet : Supabase > Project Settings > API
// (ou bouton « Connect » en haut du projet).
//
// SUPABASE_KEY = la clé PUBLIQUE : « anon public » ou « publishable » (sb_publishable_...).
// NE METS JAMAIS la clé « service_role » ou « secret » (sb_secret_...) :
// ce fichier est distribué aux autres joueurs avec l'extension.
// ============================================================================
self.KYARA_CONFIG = {
  SUPABASE_URL: 'https://fwvzvbawkpncyubujtpn.supabase.co',
  SUPABASE_KEY: 'sb_publishable_BozpvbxIUArsO_1t_snmjg_4zUMVTkP',
};

// Vérifie que la config est remplie et que la clé n'est pas une clé secrète.
self.kyaraConfigProblem = function () {
  const c = self.KYARA_CONFIG || {};
  if (!c.SUPABASE_URL || /XXXX/.test(c.SUPABASE_URL) || !c.SUPABASE_KEY || /COLLE_ICI/.test(c.SUPABASE_KEY)) {
    return 'serveur non configuré (config.js)';
  }
  if (/^sb_secret_/.test(c.SUPABASE_KEY)) return 'config.js contient une clé SECRÈTE : mets la clé publique';
  if (/^eyJ/.test(c.SUPABASE_KEY)) {
    try {
      const p = JSON.parse(atob(c.SUPABASE_KEY.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (p.role && p.role !== 'anon') return 'config.js contient la clé service_role : mets la clé anon';
    } catch (e) { /* ignore */ }
  }
  return null;
};

self.kyaraHeaders = function () {
  const k = self.KYARA_CONFIG.SUPABASE_KEY;
  const h = { apikey: k };
  if (/^eyJ/.test(k)) h.Authorization = 'Bearer ' + k;   // ancienne clé anon (JWT)
  return h;
};
