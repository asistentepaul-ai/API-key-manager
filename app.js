/* app.js — Secure Key Manager PWA (client-side only) */

/* ===== State ===== */
var masterPassword = null;  // NEVER persisted
var keysCache = [];
var currentKeyId = null;
var editingKeyId = null;
var vaultPayload = null;    // cached encrypted payload {salt, nonce, ciphertext}

/* ===== DOM helpers ===== */
var $ = function (id) { return document.getElementById(id); };

function showScreen(id) {
  var screens = document.querySelectorAll('.screen');
  for (var i = 0; i < screens.length; i++) {
    screens[i].classList.remove('active');
  }
  $(id).classList.add('active');
}

function statusMsg(el, msg, type) {
  el.textContent = msg || '';
  el.className = 'status' + (type ? ' ' + type : '');
}

function toast(msg) {
  var t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function () { t.classList.remove('show'); }, 2500);
}

function esc(s) {
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function showError(msg) { toast('❌ ' + msg); }

/* ===== Vault persistence (localStorage) ===== */
function saveVaultLocal(payload) {
  localStorage.setItem('skm_vault', JSON.stringify(payload));
}

function loadVaultLocal() {
  var raw = localStorage.getItem('skm_vault');
  return raw ? JSON.parse(raw) : null;
}

function clearVaultLocal() {
  localStorage.removeItem('skm_vault');
}

/* ===== Crypto operations ===== */
async function loadKeys() {
  if (!masterPassword) return;
  var payload = vaultPayload || loadVaultLocal();
  if (!payload) {
    keysCache = [];
    renderKeys([]);
    return;
  }
  try {
    var plain = await decryptVault(payload, masterPassword);
    var data = JSON.parse(plain);
    keysCache = data.keys || [];
    renderKeys(keysCache);
  } catch (e) {
    showError('Error al descifrar el vault: contraseña incorrecta o datos corruptos');
    lock();
  }
}

async function saveKeys() {
  var plaintext = JSON.stringify({ keys: keysCache });
  var payload = await encryptVault(plaintext, masterPassword);
  vaultPayload = payload;
  saveVaultLocal(payload);
}

/* ===== Lock / Unlock ===== */
function lock() {
  masterPassword = null;
  vaultPayload = null;
  keysCache = [];
  currentKeyId = null;
  editingKeyId = null;
  $('master-password').value = '';
  showScreen('screen-unlock');
  statusMsg($('unlock-status'), 'Sesión cerrada');
}

$('form-unlock').addEventListener('submit', async function (e) {
  e.preventDefault();
  var pw = $('master-password').value.trim();
  if (!pw) return;
  var btn = $('btn-unlock');
  var st = $('unlock-status');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Desbloqueando...';
  statusMsg(st, '');
  try {
    var payload = loadVaultLocal();
    if (payload) {
      // Verify password by trying to decrypt
      var plain = await decryptVault(payload, pw);
      var data = JSON.parse(plain);
      masterPassword = pw;
      vaultPayload = payload;
      keysCache = data.keys || [];
      renderKeys(keysCache);
    } else {
      // First use: create empty vault
      masterPassword = pw;
      keysCache = [];
      await saveKeys();
    }
    $('master-password').value = '';
    showScreen('screen-keys');
    statusMsg(st, '');
  } catch (err) {
    statusMsg(st, 'Contraseña incorrecta o vault corrupto', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Desbloquear';
  }
});

$('btn-lock').addEventListener('click', function () {
  lock();
});

/* ===== Keys list ===== */
function renderKeys(keys) {
  var list = $('key-list');
  if (!keys || !keys.length) {
    list.innerHTML = '<li class="empty-state">No hay claves guardadas. Añade una.</li>';
    return;
  }
  var html = '';
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    html += '<li class="key-item" data-id="' + esc(k.id) + '">' +
      '<div><div class="name">' + esc(k.name) + '</div>' +
      '<div class="meta">' + (k.notes ? esc(k.notes) : '—') + '</div></div>' +
      '<div class="actions">' +
      '<button class="btn btn-sm btn-outline view-key-btn" data-id="' + esc(k.id) + '">Ver</button>' +
      '<button class="btn btn-sm btn-danger delete-key-btn" data-id="' + esc(k.id) + '">✕</button>' +
      '</div></li>';
  }
  list.innerHTML = html;
}

$('search-keys').addEventListener('input', function (e) {
  var q = e.target.value.toLowerCase();
  var filtered = [];
  for (var i = 0; i < keysCache.length; i++) {
    var k = keysCache[i];
    if (k.name.toLowerCase().indexOf(q) !== -1 ||
        (k.notes && k.notes.toLowerCase().indexOf(q) !== -1)) {
      filtered.push(k);
    }
  }
  renderKeys(filtered);
});

$('key-list').addEventListener('click', function (e) {
  var btn = e.target.closest('button');
  if (!btn) return;
  var id = btn.dataset.id;
  if (btn.classList.contains('view-key-btn')) {
    viewKey(id);
  } else if (btn.classList.contains('delete-key-btn')) {
    deleteKey(id);
  }
});

$('btn-add-key').addEventListener('click', function () {
  editingKeyId = null;
  $('form-title').textContent = 'Añadir clave';
  $('form-key-name').value = '';
  $('form-key-value').value = '';
  $('form-key-notes').value = '';
  statusMsg($('form-status'), '');
  showScreen('screen-form');
});

/* ===== View key ===== */
async function viewKey(id) {
  currentKeyId = id;
  var st = $('view-status');
  statusMsg(st, 'Cargando...');
  $('view-value').classList.remove('visible');
  $('view-value').textContent = '';
  $('btn-view-show').textContent = 'Mostrar valor';
  $('btn-view-copy').disabled = true;
  var found = null;
  for (var i = 0; i < keysCache.length; i++) {
    if (keysCache[i].id === id) { found = keysCache[i]; break; }
  }
  if (!found) {
    statusMsg(st, 'Clave no encontrada', 'error');
    return;
  }
  $('view-name').textContent = found.name;
  $('view-notes').textContent = found.notes || 'Sin notas';
  $('view-value').dataset.value = found.value;
  showScreen('screen-view');
  statusMsg(st, '');
}

$('btn-view-show').addEventListener('click', function () {
  var box = $('view-value');
  var btn = $('btn-view-show');
  if (box.classList.contains('visible')) {
    box.classList.remove('visible');
    btn.textContent = 'Mostrar valor';
    $('btn-view-copy').disabled = true;
  } else {
    box.textContent = box.dataset.value || '';
    box.classList.add('visible');
    btn.textContent = 'Ocultar valor';
    $('btn-view-copy').disabled = false;
  }
});

$('btn-view-copy').addEventListener('click', async function () {
  var val = $('view-value').dataset.value;
  if (!val) return;
  try {
    await navigator.clipboard.writeText(val);
    toast('Copiado al portapapeles');
  } catch (_) {
    var ta = document.createElement('textarea');
    ta.value = val;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    toast('Copiado al portapapeles');
  }
});

$('btn-view-back').addEventListener('click', function () {
  showScreen('screen-keys');
});

$('btn-view-edit').addEventListener('click', function () {
  editingKeyId = currentKeyId;
  $('form-title').textContent = 'Editar clave';
  $('form-key-name').value = $('view-name').textContent;
  $('form-key-value').value = $('view-value').dataset.value || '';
  var notes = $('view-notes').textContent;
  $('form-key-notes').value = (notes === 'Sin notas') ? '' : notes;
  statusMsg($('form-status'), '');
  showScreen('screen-form');
});

$('btn-view-delete').addEventListener('click', async function () {
  if (!confirm('Eliminar esta clave definitivamente?')) return;
  var newKeys = [];
  for (var i = 0; i < keysCache.length; i++) {
    if (keysCache[i].id !== currentKeyId) newKeys.push(keysCache[i]);
  }
  keysCache = newKeys;
  await saveKeys();
  toast('Clave eliminada');
  showScreen('screen-keys');
});

/* ===== Add / Edit form ===== */
$('form-key').addEventListener('submit', async function (e) {
  e.preventDefault();
  var name = $('form-key-name').value.trim();
  var value = $('form-key-value').value.trim();
  var notes = $('form-key-notes').value.trim();
  if (!name || !value) return;
  var btn = $('btn-form-save');
  var st = $('form-status');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Guardando...';
  statusMsg(st, '');
  try {
    var now = new Date().toISOString();
    if (editingKeyId) {
      for (var i = 0; i < keysCache.length; i++) {
        if (keysCache[i].id === editingKeyId) {
          keysCache[i].name = name;
          keysCache[i].value = value;
          keysCache[i].notes = notes;
          keysCache[i].updated_at = now;
          break;
        }
      }
      toast('Clave actualizada');
    } else {
      var newKey = {
        id: generateId(),
        name: name,
        value: value,
        notes: notes,
        created_at: now,
        updated_at: now
      };
      keysCache.push(newKey);
      toast('Clave creada');
    }
    await saveKeys();
    showScreen('screen-keys');
  } catch (err) {
    statusMsg(st, err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar';
  }
});

function generateId() {
  var arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  var hex = '';
  for (var i = 0; i < arr.length; i++) {
    hex += arr[i].toString(16).padStart(2, '0');
  }
  return hex;
}

$('btn-form-cancel').addEventListener('click', function () {
  showScreen('screen-keys');
});

/* ===== Sync screen (GitHub) ===== */
$('btn-sync').addEventListener('click', function () {
  var config = getConfig();
  if (config) {
    $('sync-owner').value = config.owner;
    $('sync-repo').value = config.repo;
    $('sync-path').value = config.path;
    $('sync-branch').value = config.branch;
    $('sync-token').value = config.token;
  } else {
    $('sync-path').value = 'vault.enc';
    $('sync-branch').value = 'main';
  }
  $('sync-status').textContent = '';
  $('sync-result').textContent = '';
  showScreen('screen-sync');
});

$('btn-sync-back').addEventListener('click', function () {
  showScreen('screen-keys');
});

$('form-sync').addEventListener('submit', function (e) {
  e.preventDefault();
  var config = {
    owner: $('sync-owner').value.trim(),
    repo: $('sync-repo').value.trim(),
    path: $('sync-path').value.trim(),
    branch: $('sync-branch').value.trim(),
    token: $('sync-token').value.trim()
  };
  if (!config.owner || !config.repo || !config.path || !config.branch) {
    toast('Completa todos los campos');
    return;
  }
  if (!config.token) {
    toast('El token es necesario para leer/escribir en repos privados');
  }
  saveConfig(config);
  toast('Configuración guardada');
});

$('btn-sync-push').addEventListener('click', async function () {
  var st = $('sync-status');
  statusMsg(st, 'Subiendo vault a GitHub...');
  try {
    var payload = vaultPayload || loadVaultLocal();
    if (!payload) { statusMsg(st, 'No hay vault para subir', 'error'); return; }
    var content = JSON.stringify(payload);
    // Check if file already exists to get its SHA
    var existing = await readVault();
    var sha = existing ? existing.sha : null;
    await writeVault(content, sha);
    statusMsg(st, 'Vault subido correctamente a GitHub', 'success');
  } catch (err) {
    statusMsg(st, err.message, 'error');
  }
});

$('btn-sync-pull').addEventListener('click', async function () {
  var st = $('sync-status');
  statusMsg(st, 'Descargando vault desde GitHub...');
  try {
    var existing = await readVault();
    if (!existing) { statusMsg(st, 'No hay vault en GitHub todavia', 'error'); return; }
    var payload = JSON.parse(existing.content);
    // Verify it can be decrypted with current master password
    if (masterPassword) {
      await decryptVault(payload, masterPassword);
    }
    vaultPayload = payload;
    saveVaultLocal(payload);
    if (masterPassword) {
      await loadKeys();
    }
    statusMsg(st, 'Vault descargado y descifrado correctamente', 'success');
  } catch (err) {
    statusMsg(st, err.message, 'error');
  }
});

$('btn-sync-clear').addEventListener('click', function () {
  if (!confirm('Eliminar configuracion de GitHub?')) return;
  clearConfig();
  $('sync-owner').value = '';
  $('sync-repo').value = '';
  $('sync-path').value = 'vault.enc';
  $('sync-branch').value = 'main';
  $('sync-token').value = '';
  toast('Configuracion de GitHub eliminada');
});

/* ===== Init ===== */
(async function init() {
  var payload = loadVaultLocal();
  if (payload) {
    // Vault exists locally, show unlock screen
    showScreen('screen-unlock');
  } else {
    showScreen('screen-unlock');
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(function () {});
  }
})();