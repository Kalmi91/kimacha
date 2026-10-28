// The owner's admin page, served by the Worker at /admin. One self-contained HTML document (no external script, font or
// image); it asks for the admin key, keeps it in localStorage and reads /api/admin/stats. Keep the page free of
// backticks, `${` and backslashes: it is a template literal.
export const ADMIN_PAGE = `<!doctype html>
<html lang="hu">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Kimacha admin</title>
<style>
:root {
  --bg: #f6f7f9;
  --card: #ffffff;
  --text: #1c2430;
  --muted: #5d6877;
  --line: #d9dee6;
  --accent: #1a5fb4;
  --accent-text: #ffffff;
  --error: #b3261e;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #12161c;
    --card: #1a2029;
    --text: #e6eaf0;
    --muted: #98a2b3;
    --line: #2d3644;
    --accent: #6ea8f0;
    --accent-text: #0b1118;
    --error: #f2b8b5;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 16px;
  background: var(--bg);
  color: var(--text);
  font: 16px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
main { max-width: 960px; margin: 0 auto; }
h1 { font-size: 1.4rem; margin: 0 0 16px; }
form { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
label { flex: 1 1 100%; color: var(--muted); font-size: 0.9rem; }
input {
  flex: 1 1 200px;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--card);
  color: var(--text);
  font: inherit;
}
button {
  padding: 10px 18px;
  border: 0;
  border-radius: 8px;
  background: var(--accent);
  color: var(--accent-text);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
#status { margin: 0 0 8px; color: var(--muted); }
#status.error { color: var(--error); }
.wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; background: var(--card); }
table { border-collapse: collapse; width: 100%; }
th, td { padding: 8px 12px; text-align: left; white-space: nowrap; border-bottom: 1px solid var(--line); }
th { color: var(--muted); font-size: 0.85rem; font-weight: 600; }
tr:last-child td { border-bottom: 0; }
th.num, td.num { text-align: right; }
</style>
</head>
<body>
<main>
<h1>Kimacha admin</h1>
<form id="form">
  <label for="key">Admin-kulcs</label>
  <input id="key" type="password" autocomplete="off" required>
  <button type="submit">Mutasd</button>
</form>
<p id="status"></p>
<div class="wrap" id="wrap" hidden>
<table>
<thead>
<tr><th>Név</th><th>Nyelvpár</th><th>Szint</th><th class="num">Perc (7 nap)</th><th class="num">Perc összesen</th><th class="num">Aktív napok</th><th>Utolsó aktív nap</th><th class="num">XP</th><th class="num">Sorozat (most/max)</th><th class="num">Belépések</th><th>Utolsó belépés</th><th>Első belépés</th><th>Utolsó mentés</th><th class="num">Haladás (KB)</th></tr>
</thead>
<tbody id="rows"></tbody>
</table>
</div>
</main>
<script>
(function () {
  var STORE = 'kimacha-admin-key';
  var keyInput = document.getElementById('key');
  var statusEl = document.getElementById('status');
  var wrap = document.getElementById('wrap');
  var rowsEl = document.getElementById('rows');

  function readKey() {
    try { return localStorage.getItem(STORE) || ''; } catch (e) { return ''; }
  }
  function saveKey(k) {
    try { localStorage.setItem(STORE, k); } catch (e) {}
  }
  function clearKey() {
    try { localStorage.removeItem(STORE); } catch (e) {}
  }
  function say(text, isError) {
    statusEl.textContent = text;
    statusEl.className = isError ? 'error' : '';
  }
  function when(iso) {
    return iso ? new Date(iso).toLocaleString('hu-HU') : '-';
  }
  function day(ymd) {
    if (!ymd) return '-';
    var p = ymd.split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])).toLocaleDateString('hu-HU');
  }
  function cell(tr, text, cls) {
    var td = document.createElement('td');
    td.textContent = text;
    if (cls) td.className = cls;
    tr.appendChild(td);
  }
  function show(users) {
    say(users.length + ' fiók', false);
    rowsEl.textContent = '';
    users.forEach(function (u) {
      var tr = document.createElement('tr');
      cell(tr, u.name);
      cell(tr, u.pair || '-');
      cell(tr, u.level || '-');
      cell(tr, String(u.minutes7d), 'num');
      cell(tr, String(u.minutesTotal), 'num');
      cell(tr, String(u.activeDays), 'num');
      cell(tr, day(u.lastActiveDay));
      cell(tr, String(u.xpTotal), 'num');
      cell(tr, u.streak + '/' + u.longestStreak, 'num');
      cell(tr, String(u.logins), 'num');
      cell(tr, when(u.lastLogin));
      cell(tr, when(u.firstLogin));
      cell(tr, when(u.lastSave));
      cell(tr, String(u.progressKb), 'num');
      rowsEl.appendChild(tr);
    });
    wrap.hidden = false;
  }
  function load(key) {
    wrap.hidden = true;
    say('Betöltés...', false);
    fetch('/api/admin/stats', { headers: { Authorization: 'Bearer ' + key } })
      .then(function (res) {
        if (res.status === 401) {
          clearKey();
          say('Rossz kulcs.', true);
          return null;
        }
        if (!res.ok) {
          say('Hiba: ' + res.status, true);
          return null;
        }
        saveKey(key);
        return res.json();
      })
      .then(function (data) {
        if (data) show(data.users);
      })
      .catch(function () {
        say('Hiba: hálózat', true);
      });
  }

  document.getElementById('form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var key = keyInput.value.trim();
    if (key) load(key);
  });

  var saved = readKey();
  if (saved) {
    keyInput.value = saved;
    load(saved);
  }
})();
</script>
</body>
</html>
`;
