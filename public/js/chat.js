/**
 * ComunicaChat — E2E encrypted chat engine
 *
 * DMs:    ECDH P-256 key exchange + AES-256-GCM encryption (true E2E — server cannot read)
 * Groups: Base64 encoding (authentication-controlled access — server can read)
 *
 * Keys stored in IndexedDB (persist across sessions on same device).
 */
(function (global) {
  'use strict';

  // ── IndexedDB helpers ──────────────────────────────────────────────────────

  const DB_NAME = 'comunica_chat_v1';
  const DB_VER  = 1;

  function openDB() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function (e) {
        e.target.result.createObjectStore('keys', { keyPath: 'id' });
      };
      req.onsuccess = function (e) { resolve(e.target.result); };
      req.onerror   = function (e) { reject(e); };
    });
  }

  function dbGet(key) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx  = db.transaction('keys', 'readonly');
        var req = tx.objectStore('keys').get(key);
        req.onsuccess = function (e) { resolve(e.target.result); };
        req.onerror   = reject;
      });
    });
  }

  function dbPut(record) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('keys', 'readwrite');
        tx.objectStore('keys').put(record);
        tx.oncomplete = resolve;
        tx.onerror    = reject;
      });
    });
  }

  // ── Utilities ──────────────────────────────────────────────────────────────

  function buf2b64(buf) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
  }
  function b64toBuf(b64) {
    var s = atob(b64);
    var buf = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) buf[i] = s.charCodeAt(i);
    return buf.buffer;
  }
  function hex2buf(hex) {
    var arr = new Uint8Array(hex.length / 2);
    for (var i = 0; i < hex.length; i += 2) arr[i / 2] = parseInt(hex.substr(i, 2), 16);
    return arr;
  }
  function buf2hex(buf) {
    return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  function str2buf(str) { return new TextEncoder().encode(str); }
  function buf2str(buf) { return new TextDecoder().decode(buf); }

  // ── Key pair management ────────────────────────────────────────────────────
  // Priority: server (cross-device) → IndexedDB (local cache) → generate new

  var myKeyPair = null;   // { publicKey, privateKey } CryptoKey objects
  var sharedKeyCache = {}; // userId -> CryptoKey (AES-GCM derived key)

  async function importKeyPair(pubJwk, privJwk) {
    var pub  = await crypto.subtle.importKey('jwk', pubJwk,  { name: 'ECDH', namedCurve: 'P-256' }, true, []);
    var priv = await crypto.subtle.importKey('jwk', privJwk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']);
    return { publicKey: pub, privateKey: priv };
  }

  async function loadOrCreateKeyPair() {
    // 1. Try server first — same key pair across all devices
    try {
      var res = await fetch('/chat/keys/me');
      if (res.ok) {
        var data = await res.json();
        if (data.public_key_jwk && data.private_key_jwk) {
          var pubJwk  = JSON.parse(data.public_key_jwk);
          var privJwk = JSON.parse(data.private_key_jwk);
          var kp = await importKeyPair(pubJwk, privJwk);
          // Cache locally so next page load skips the server round-trip
          await dbPut({ id: 'myKeyPair', pub: pubJwk, priv: privJwk });
          return kp;
        }
      }
    } catch (e) {
      console.warn('[Chat] Could not fetch key from server, falling back to IndexedDB…', e);
    }

    // 2. Try IndexedDB (local cache for performance)
    var record = await dbGet('myKeyPair');
    if (record) {
      try {
        return await importKeyPair(record.pub, record.priv);
      } catch (e) {
        console.warn('[Chat] IndexedDB key import failed, regenerating…', e);
      }
    }

    // 3. Generate brand-new key pair and persist to both IndexedDB and server
    var kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']);
    var pubJwk  = await crypto.subtle.exportKey('jwk', kp.publicKey);
    var privJwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
    await dbPut({ id: 'myKeyPair', pub: pubJwk, priv: privJwk });
    return kp;
  }

  async function getMyPublicKeyJwk() {
    if (!myKeyPair) throw new Error('Keys not initialized');
    return JSON.stringify(await crypto.subtle.exportKey('jwk', myKeyPair.publicKey));
  }

  // Returns null when the other user hasn't registered their ECDH key yet
  async function getDerivedKey(otherUserId) {
    if (sharedKeyCache[otherUserId]) return sharedKeyCache[otherUserId];

    var res = await fetch('/chat/keys/' + otherUserId);
    if (!res.ok) return null; // other user hasn't opened chat yet — fall back to group encoding

    var data = await res.json();

    var otherPub = await crypto.subtle.importKey(
      'jwk', JSON.parse(data.public_key_jwk),
      { name: 'ECDH', namedCurve: 'P-256' }, false, []
    );

    var derived = await crypto.subtle.deriveKey(
      { name: 'ECDH', public: otherPub },
      myKeyPair.privateKey,
      { name: 'AES-GCM', length: 256 }, false,
      ['encrypt', 'decrypt']
    );

    sharedKeyCache[otherUserId] = derived;
    return derived;
  }

  // ── Encrypt / Decrypt ──────────────────────────────────────────────────────

  async function encryptDM(texto, otherUserId) {
    var key = await getDerivedKey(otherUserId);
    if (!key) return encodeGrupo(texto); // other user has no key yet — use base64 fallback
    var iv  = crypto.getRandomValues(new Uint8Array(12));
    var enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, str2buf(texto));
    return { conteudo_enc: buf2b64(enc), iv_hex: buf2hex(iv.buffer) };
  }

  async function decryptDM(conteudo_enc, iv_hex, otherUserId) {
    try {
      var key = await getDerivedKey(otherUserId);
      // Message has iv_hex → was AES-GCM encrypted; if no key available, can't decrypt
      if (!key) return '🔒 [mensagem cifrada]';
      var dec = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: hex2buf(iv_hex) },
        key,
        b64toBuf(conteudo_enc)
      );
      return buf2str(dec);
    } catch (e) {
      return '🔒 [mensagem de outra sessão]';
    }
  }

  // Base64 encode/decode for group messages (UTF-8 safe)
  function encodeGrupo(texto) {
    return { conteudo_enc: btoa(encodeURIComponent(texto).replace(/%([0-9A-F]{2})/g, function(_, p1) { return String.fromCharCode(parseInt(p1, 16)); })), iv_hex: null };
  }
  function decodeGrupo(conteudo_enc) {
    try {
      return decodeURIComponent(Array.prototype.map.call(atob(conteudo_enc), function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
    } catch (e) { return conteudo_enc || ''; }
  }

  // Aliases used by public API
  var encryptGrupo = encodeGrupo;
  var decryptGrupo = decodeGrupo;

  // ── Public API ─────────────────────────────────────────────────────────────

  var ComunicaChat = {
    ready: false,
    _onMsg: null,
    _onConversa: null,

    async init() {
      try {
        myKeyPair = await loadOrCreateKeyPair();
        var pubJwk  = JSON.stringify(await crypto.subtle.exportKey('jwk', myKeyPair.publicKey));
        var privJwk = JSON.stringify(await crypto.subtle.exportKey('jwk', myKeyPair.privateKey));
        // Persist both keys to server so any device can load them after login
        await fetch('/chat/keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ public_key_jwk: pubJwk, private_key_jwk: privJwk }),
        });
        this.ready = true;
      } catch (e) {
        console.error('[Chat] Init failed:', e);
      }
    },

    // Called from SSE handler in main.ejs
    onSSEMensagem(data) {
      if (typeof this._onMsg === 'function') this._onMsg(data);
    },
    onSSEConversa(data) {
      if (typeof this._onConversa === 'function') this._onConversa(data);
    },

    // Encrypt a text message
    async encryptTexto(texto, conversa) {
      if (!texto) return { conteudo_enc: '', iv_hex: null };
      if (conversa.tipo === 'dm') {
        return encryptDM(texto, conversa.outro_user_id);
      }
      return encryptGrupo(texto);
    },

    // Decrypt a text message
    async decryptTexto(msg, conversa) {
      if (!msg.conteudo_enc) return '';
      if (conversa.tipo === 'dm' && msg.iv_hex) {
        return decryptDM(msg.conteudo_enc, msg.iv_hex, conversa.outro_user_id);
      }
      if (conversa.tipo === 'dm' && !msg.iv_hex) {
        // Old message without IV (plain DM before E2E)
        return decryptGrupo(msg.conteudo_enc);
      }
      return decryptGrupo(msg.conteudo_enc);
    },

    // Decrypt batch
    async decryptMensagens(msgs, conversa) {
      var result = [];
      for (var i = 0; i < msgs.length; i++) {
        var m = Object.assign({}, msgs[i]);
        if (m.tipo === 'texto') {
          m._texto = await this.decryptTexto(m, conversa);
        }
        result.push(m);
      }
      return result;
    },

    // Upload file and return {url, nome, tamanho, mime}
    async uploadArquivo(file) {
      var fd = new FormData();
      fd.append('file', file);
      var res = await fetch('/chat/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload falhou');
      return res.json();
    },

    // Encrypt a text message for preview in conversation list (groups only, or "Mídia" for DMs)
    previewMsg(msg, conversaTipo) {
      if (!msg) return '';
      if (msg.tipo === 'imagem') return '📷 Imagem';
      if (msg.tipo === 'audio')  return '🎤 Áudio';
      if (msg.tipo === 'arquivo') return '📎 Arquivo';
      if (conversaTipo === 'dm') return '🔒 Mensagem cifrada';
      // For group: we have plain base64
      try { return decryptGrupo(msg.conteudo_enc).substring(0, 60); }
      catch { return ''; }
    },
  };

  global.ComunicaChat = ComunicaChat;

}(window));
