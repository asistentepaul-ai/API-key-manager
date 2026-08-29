/* github.js — GitHub REST Contents API sync */

var GITHUB_API = 'https://api.github.com';

function getConfig() {
  var raw = localStorage.getItem('skm_github_config');
  return raw ? JSON.parse(raw) : null;
}

function saveConfig(config) {
  localStorage.setItem('skm_github_config', JSON.stringify(config));
}

function clearConfig() {
  localStorage.removeItem('skm_github_config');
}

async function readVault() {
  var config = getConfig();
  if (!config) throw new Error('GitHub no configurado');
  var url = GITHUB_API + '/repos/' + encodeURIComponent(config.owner) + '/' + encodeURIComponent(config.repo) + '/contents/' + encodeURIComponent(config.path) + '?ref=' + encodeURIComponent(config.branch);
  var headers = {};
  if (config.token) headers['Authorization'] = 'Bearer ' + config.token;
  var res = await fetch(url, { headers: headers });
  if (res.status === 404) return null;
  if (!res.ok) {
    var errText = await res.text().catch(function () { return ''; });
    throw new Error('Error al leer desde GitHub: ' + res.status + ' ' + errText);
  }
  var data = await res.json();
  return {
    content: atob(data.content),
    sha: data.sha
  };
}

async function writeVault(content, sha) {
  var config = getConfig();
  if (!config) throw new Error('GitHub no configurado');
  if (!config.token) throw new Error('Se necesita un token de GitHub para escribir');
  var body = {
    message: 'Actualizar vault de API keys',
    content: btoa(content),
    branch: config.branch
  };
  if (sha) body.sha = sha;
  var res = await fetch(
    GITHUB_API + '/repos/' + encodeURIComponent(config.owner) + '/' + encodeURIComponent(config.repo) + '/contents/' + encodeURIComponent(config.path),
    {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + config.token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }
  );
  if (!res.ok) {
    var errData = await res.json().catch(function () { return {}; });
    throw new Error(errData.message || 'Error al escribir en GitHub: ' + res.status);
  }
  return res.json();
}