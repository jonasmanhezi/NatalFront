#!/usr/bin/env python3
"""
Pastebin caseiro — compartilhe trechos e pequenos arquivos de código na rede de casa.

Uso:
    python pastebin.py                 # porta 8000, sem PIN
    PIN=1234 python pastebin.py        # exige PIN (Linux/Mac)
    set PIN=1234 && python pastebin.py # exige PIN (Windows cmd)
    $env:PIN="1234"; python pastebin.py  # (Windows PowerShell)

Variáveis opcionais: PORT (padrão 8000), PIN, DATA_DIR (padrão ./dados).
Só usa a biblioteca padrão do Python 3.8+.
"""
import json
import os
import re
import socket
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, urlparse

PORT = int(os.environ.get("PORT", "8000"))
PIN = os.environ.get("PIN", "")
DATA = Path(os.environ.get("DATA_DIR", Path(__file__).resolve().parent / "dados"))
MAX_BYTES = 2 * 1024 * 1024  # 2 MB por arquivo
DATA.mkdir(parents=True, exist_ok=True)
ID_RX = r"([a-f0-9]{12})"


# ---------------------------------------------------------------- armazenamento
def path_of(item_id):
    return DATA / f"{item_id}.json"


def load(item_id):
    p = path_of(item_id)
    if not p.exists():
        return None
    return json.loads(p.read_text("utf-8"))


def save(item):
    tmp = DATA / f"{item['id']}.tmp"
    tmp.write_text(json.dumps(item, ensure_ascii=False), "utf-8")
    tmp.replace(path_of(item["id"]))


def list_items():
    items = []
    for p in DATA.glob("*.json"):
        try:
            it = json.loads(p.read_text("utf-8"))
        except Exception:
            continue
        items.append({
            "id": it["id"], "name": it["name"],
            "created": it["created"], "updated": it["updated"],
            "size": len(it["content"].encode("utf-8")),
        })
    items.sort(key=lambda i: i["updated"], reverse=True)
    return items


def clean_name(name):
    name = str(name or "").strip().replace("\\", "/").split("/")[-1]
    name = re.sub(r"[\x00-\x1f]", "", name)[:200]
    return name or "sem-nome.txt"


def check_content(content):
    if not isinstance(content, str):
        raise ValueError("conteúdo inválido")
    if len(content.encode("utf-8")) > MAX_BYTES:
        raise ValueError(f"arquivo maior que {MAX_BYTES // 1024 // 1024} MB")
    return content


# ---------------------------------------------------------------- servidor HTTP
class Handler(BaseHTTPRequestHandler):
    server_version = "PastebinCaseiro"

    def log_message(self, fmt, *args):
        pass  # silencioso

    def reply(self, code, body=b"", ctype="application/json; charset=utf-8", headers=None):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, ensure_ascii=False).encode("utf-8")
        elif isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > MAX_BYTES * 2:
            raise ValueError("requisição grande demais")
        data = json.loads(self.rfile.read(n) or b"{}")
        if not isinstance(data, dict):
            raise ValueError("JSON inválido")
        return data

    def authed(self, qs):
        if not PIN:
            return True
        return self.headers.get("X-Pin") == PIN or qs.get("pin", [""])[0] == PIN

    def route(self, method):
        url = urlparse(self.path)
        qs = parse_qs(url.query)
        path = url.path

        if method == "GET" and path == "/":
            return self.reply(200, PAGE, "text/html; charset=utf-8")
        if not self.authed(qs):
            return self.reply(401, {"erro": "PIN inválido"})

        if path == "/api/ping":
            return self.reply(200, {"ok": True, "max": MAX_BYTES})

        if path == "/api/items":
            if method == "GET":
                return self.reply(200, list_items())
            if method == "POST":
                data = self.read_json()
                now = time.time()
                item = {
                    "id": uuid.uuid4().hex[:12],
                    "name": clean_name(data.get("name")),
                    "content": check_content(data.get("content", "")),
                    "created": now, "updated": now,
                }
                save(item)
                return self.reply(201, item)

        m = re.fullmatch(r"/api/items/" + ID_RX, path)
        if m:
            item = load(m.group(1))
            if not item:
                return self.reply(404, {"erro": "não encontrado"})
            if method == "GET":
                return self.reply(200, item)
            if method == "PUT":
                data = self.read_json()
                if "name" in data:
                    item["name"] = clean_name(data["name"])
                if "content" in data:
                    item["content"] = check_content(data["content"])
                item["updated"] = time.time()
                save(item)
                return self.reply(200, item)
            if method == "DELETE":
                path_of(item["id"]).unlink(missing_ok=True)
                return self.reply(200, {"ok": True})

        m = re.fullmatch(r"/raw/" + ID_RX, path)
        if m and method == "GET":
            item = load(m.group(1))
            if not item:
                return self.reply(404, {"erro": "não encontrado"})
            disp = "attachment" if "dl" in qs else "inline"
            return self.reply(200, item["content"], "text/plain; charset=utf-8", {
                "Content-Disposition": f"{disp}; filename*=UTF-8''{quote(item['name'])}",
            })

        return self.reply(404, {"erro": "não encontrado"})

    def handle_method(self, method):
        try:
            self.route(method)
        except (ValueError, json.JSONDecodeError) as e:
            self.reply(400, {"erro": str(e)})
        except Exception as e:  # nunca derruba o servidor
            self.reply(500, {"erro": f"erro interno: {e}"})

    def do_GET(self):
        self.handle_method("GET")

    def do_POST(self):
        self.handle_method("POST")

    def do_PUT(self):
        self.handle_method("PUT")

    def do_DELETE(self):
        self.handle_method("DELETE")


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))  # não envia nada, só descobre a interface
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


# ---------------------------------------------------------------- página
PAGE = r"""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pastebin Caseiro</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
<style>
:root{--bg:#0d1117;--panel:#161b22;--line:#30363d;--fg:#e6edf3;--muted:#8b949e;--acc:#2f81f7;--danger:#f85149;--ok:#3fb950}
*{box-sizing:border-box}
html,body{height:100%;margin:0}
body{background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;display:flex;flex-direction:column}
button,.btn{background:var(--panel);color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:7px 12px;font:inherit;cursor:pointer;text-decoration:none;white-space:nowrap}
button:hover,.btn:hover{border-color:var(--muted)}
button.primary{background:var(--acc);border-color:var(--acc);color:#fff}
button.danger{color:var(--danger)}
input{background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:7px 10px;font:inherit;min-width:0}
input:focus,textarea:focus{outline:1px solid var(--acc);border-color:var(--acc)}
header{display:flex;gap:8px;align-items:center;padding:10px 14px;border-bottom:1px solid var(--line);background:var(--panel)}
header h1{font-size:15px;margin:0 auto 0 0;font-weight:600}
main{flex:1;display:flex;min-height:0}
aside{width:300px;border-right:1px solid var(--line);display:flex;flex-direction:column;min-height:0}
aside .search{padding:10px}
aside .search input{width:100%}
#list{list-style:none;margin:0;padding:0 6px 10px;overflow:auto;flex:1}
#list li{padding:8px 10px;border-radius:6px;cursor:pointer;display:flex;flex-direction:column;gap:2px}
#list li:hover{background:var(--panel)}
#list li.sel{background:#1f2a3a}
#list .n{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#list .m{color:var(--muted);font-size:12px}
#list .empty{color:var(--muted);cursor:default;text-align:center;padding:24px 10px}
section{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0}
.bar{display:flex;gap:8px;padding:10px;border-bottom:1px solid var(--line);flex-wrap:wrap;align-items:center}
.bar #name{flex:1 1 180px}
#back{display:none}
.code{flex:1;overflow:auto;min-height:0;background:#0d1117}
.code pre{margin:0}
.code code.hljs{padding:14px;background:transparent;font:13px/1.5 ui-monospace,SFMono-Regular,Consolas,Menlo,monospace;tab-size:4;min-height:100%}
textarea#editor{flex:1;width:100%;resize:none;border:0;background:#0d1117;color:var(--fg);padding:14px;font:13px/1.5 ui-monospace,SFMono-Regular,Consolas,Menlo,monospace;tab-size:4;white-space:pre;min-height:0}
.placeholder{flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:6px;color:var(--muted);text-align:center;padding:24px}
.placeholder b{color:var(--fg);font-size:16px}
#drop{position:fixed;inset:0;background:rgba(47,129,247,.18);border:3px dashed var(--acc);display:none;align-items:center;justify-content:center;font-size:22px;font-weight:600;z-index:10;pointer-events:none}
body.dragging #drop{display:flex}
#toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:var(--panel);border:1px solid var(--line);padding:9px 16px;border-radius:8px;opacity:0;transition:opacity .2s;pointer-events:none;z-index:20;max-width:90vw}
#toast.on{opacity:1}
#toast.err{border-color:var(--danger);color:var(--danger)}
.hide{display:none!important}
@media (max-width:760px){
  header{padding:8px 12px}
  header .lbl{display:none}
  aside{width:100%;border-right:0}
  section{display:none}
  body.show-item aside{display:none}
  body.show-item section{display:flex}
  #back{display:inline-block}
  .bar button,.bar .btn{padding:7px 10px}
}
</style>
</head>
<body>
<header>
  <h1>📋 Pastebin Caseiro</h1>
  <button id="newBtn" class="primary">+ <span class="lbl">Novo trecho</span></button>
  <button id="upBtn">⬆ <span class="lbl">Enviar arquivos</span></button>
  <input type="file" id="fileIn" multiple hidden>
</header>
<main>
  <aside>
    <div class="search"><input id="q" placeholder="Buscar…" autocomplete="off"></div>
    <ul id="list"></ul>
  </aside>
  <section>
    <div class="placeholder" id="ph">
      <b>Cole (Ctrl+V) em qualquer lugar</b>
      <span>ou arraste arquivos para cá · selecione um item na lista</span>
    </div>
    <div class="bar hide" id="bar">
      <button id="back">←</button>
      <input id="name" spellcheck="false" autocomplete="off">
      <button id="copyBtn" class="primary">Copiar tudo</button>
      <button id="editBtn">Editar</button>
      <button id="saveBtn" class="primary hide">Salvar</button>
      <button id="cancelBtn" class="hide">Cancelar</button>
      <a id="dlBtn" class="btn" href="#">Baixar</a>
      <button id="delBtn" class="danger">Apagar</button>
    </div>
    <div class="code hide" id="view"><pre><code id="code" class="hljs"></code></pre></div>
    <textarea id="editor" class="hide" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea>
  </section>
</main>
<div id="drop">Solte os arquivos para enviar</div>
<div id="toast"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
<script>
const $ = s => document.querySelector(s);
let PIN = '';
try { PIN = localStorage.getItem('pin') || ''; } catch (e) {}
let MAX = 2 * 1024 * 1024, items = [], cur = null, editing = false;

const LANG = {js:'javascript',mjs:'javascript',cjs:'javascript',jsx:'javascript',ts:'typescript',tsx:'typescript',
  py:'python',html:'xml',htm:'xml',xml:'xml',vue:'xml',svg:'xml',css:'css',scss:'scss',less:'less',json:'json',
  md:'markdown',sh:'bash',bash:'bash',ps1:'powershell',sql:'sql',java:'java',cs:'csharp',go:'go',rs:'rust',
  php:'php',rb:'ruby',yml:'yaml',yaml:'yaml',kt:'kotlin',c:'c',h:'c',cpp:'cpp',hpp:'cpp',swift:'swift',
  dart:'dart',lua:'lua',ini:'ini',toml:'ini',dockerfile:'dockerfile',txt:'plaintext'};

function toast(msg, err) {
  const t = $('#toast'); t.textContent = msg; t.className = 'on' + (err ? ' err' : '');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.className = '', 2200);
}

async function api(path, opts = {}) {
  opts.headers = Object.assign({'Content-Type': 'application/json'}, PIN ? {'X-Pin': PIN} : {});
  const r = await fetch(path, opts);
  if (r.status === 401) { askPin(); throw new Error('PIN necessário'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro || r.statusText);
  return j;
}

function askPin() {
  if (askPin.busy) return; askPin.busy = true;
  const p = prompt('Digite o PIN:');
  if (p === null) return;
  PIN = p.trim();
  try { localStorage.setItem('pin', PIN); } catch (e) {}
  location.reload();
}

function fmtSize(n) { return n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB'; }
function fmtTime(t) {
  const s = Date.now() / 1000 - t;
  if (s < 60) return 'agora';
  if (s < 3600) return Math.floor(s / 60) + ' min';
  if (s < 86400) return Math.floor(s / 3600) + ' h';
  return new Date(t * 1000).toLocaleDateString('pt-BR');
}

function renderList() {
  const q = $('#q').value.toLowerCase(), ul = $('#list');
  ul.innerHTML = '';
  const vis = items.filter(i => i.name.toLowerCase().includes(q));
  if (!vis.length) {
    const li = document.createElement('li'); li.className = 'empty';
    li.textContent = items.length ? 'Nada encontrado' : 'Nada por aqui ainda. Cole algo ou envie arquivos.';
    ul.appendChild(li); return;
  }
  for (const it of vis) {
    const li = document.createElement('li');
    if (cur && cur.id === it.id) li.className = 'sel';
    const n = document.createElement('span'); n.className = 'n'; n.textContent = it.name;
    const m = document.createElement('span'); m.className = 'm'; m.textContent = fmtSize(it.size) + ' · ' + fmtTime(it.updated);
    li.append(n, m);
    li.onclick = () => openItem(it.id);
    ul.appendChild(li);
  }
}

async function refresh() {
  try {
    items = await api('/api/items');
    renderList();
    if (cur && !editing) {
      const meta = items.find(i => i.id === cur.id);
      if (!meta) { cur = null; renderItem(); }
      else if (meta.updated !== cur.updated) openItem(cur.id, true);
    }
  } catch (e) {}
}

async function openItem(id, silent) {
  try {
    cur = await api('/api/items/' + id);
    editing = false; renderItem(); renderList();
    if (!silent) document.body.classList.add('show-item');
  } catch (e) { toast(e.message, true); }
}

function renderItem() {
  const has = !!cur;
  $('#ph').classList.toggle('hide', has);
  $('#bar').classList.toggle('hide', !has);
  $('#view').classList.toggle('hide', !has || editing);
  $('#editor').classList.toggle('hide', !has || !editing);
  for (const id of ['#copyBtn', '#editBtn', '#dlBtn', '#delBtn']) $(id).classList.toggle('hide', editing);
  for (const id of ['#saveBtn', '#cancelBtn']) $(id).classList.toggle('hide', !editing);
  if (!has) { document.body.classList.remove('show-item'); return; }
  if (document.activeElement !== $('#name')) $('#name').value = cur.name;
  $('#dlBtn').href = '/raw/' + cur.id + '?dl=1' + (PIN ? '&pin=' + encodeURIComponent(PIN) : '');
  if (editing) {
    $('#editor').value = cur.content; $('#editor').focus();
  } else {
    const el = $('#code'), ext = cur.name.toLowerCase().split('.').pop();
    el.textContent = cur.content; el.className = 'hljs';
    if (window.hljs && cur.content.length < 300000) {
      const lang = LANG[ext] || (cur.name.toLowerCase() === 'dockerfile' ? 'dockerfile' : null);
      try {
        el.innerHTML = lang && hljs.getLanguage(lang)
          ? hljs.highlight(cur.content, {language: lang}).value
          : hljs.highlightAuto(cur.content).value;
      } catch (e) { el.textContent = cur.content; }
    }
  }
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
  }
  // fallback para http:// na rede local (sem HTTPS)
  const ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
  document.body.appendChild(ta); ta.focus(); ta.select(); ta.setSelectionRange(0, text.length);
  let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
  ta.remove(); return ok;
}

async function create(name, content) {
  if (new Blob([content]).size > MAX) { toast(name + ': maior que ' + fmtSize(MAX), true); return null; }
  return api('/api/items', {method: 'POST', body: JSON.stringify({name, content})});
}

function stamp() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `trecho-${p(d.getDate())}${p(d.getMonth() + 1)}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.txt`;
}

async function uploadFiles(files) {
  let ok = 0, last = null;
  for (const f of files) {
    if (f.size > MAX) { toast(f.name + ': maior que ' + fmtSize(MAX), true); continue; }
    try {
      const text = await f.text();
      if (text.includes('\u0000')) { toast(f.name + ': parece binário, ignorado', true); continue; }
      last = await create(f.name, text); if (last) ok++;
    } catch (e) { toast(f.name + ': ' + e.message, true); }
  }
  if (ok) { toast(ok + ' arquivo(s) enviado(s)'); await refresh(); if (last) openItem(last.id); }
}

async function save() {
  try {
    cur = await api('/api/items/' + cur.id, {method: 'PUT', body: JSON.stringify({name: $('#name').value, content: $('#editor').value})});
    editing = false; renderItem(); toast('Salvo'); refresh();
  } catch (e) { toast(e.message, true); }
}

// ---- eventos
$('#newBtn').onclick = async () => {
  try { const it = await create(stamp(), ''); await refresh(); await openItem(it.id); editing = true; renderItem(); }
  catch (e) { toast(e.message, true); }
};
$('#upBtn').onclick = () => $('#fileIn').click();
$('#fileIn').onchange = e => { uploadFiles([...e.target.files]); e.target.value = ''; };
$('#q').oninput = renderList;
$('#back').onclick = () => document.body.classList.remove('show-item');
$('#copyBtn').onclick = async () => toast(await copyText(cur.content) ? 'Copiado!' : 'Não deu para copiar — selecione manualmente', !1);
$('#editBtn').onclick = () => { editing = true; renderItem(); };
$('#cancelBtn').onclick = () => { editing = false; renderItem(); };
$('#saveBtn').onclick = save;
$('#delBtn').onclick = async () => {
  if (!confirm('Apagar "' + cur.name + '"?')) return;
  try { await api('/api/items/' + cur.id, {method: 'DELETE'}); cur = null; renderItem(); refresh(); toast('Apagado'); }
  catch (e) { toast(e.message, true); }
};
$('#name').onchange = async () => {
  if (!cur || editing) return;
  try { cur = await api('/api/items/' + cur.id, {method: 'PUT', body: JSON.stringify({name: $('#name').value})}); renderItem(); refresh(); toast('Renomeado'); }
  catch (e) { toast(e.message, true); }
};
$('#name').onkeydown = e => { if (e.key === 'Enter') e.target.blur(); };

$('#editor').addEventListener('keydown', e => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const t = e.target, s = t.selectionStart;
    t.setRangeText('  ', s, t.selectionEnd, 'end');
  }
});
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && editing) { e.preventDefault(); save(); }
  if (e.key === 'Escape' && editing) { editing = false; renderItem(); }
});

// Ctrl+V fora de campos de texto = novo trecho
document.addEventListener('paste', async e => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;
  const files = [...(e.clipboardData.files || [])];
  if (files.length) { e.preventDefault(); return uploadFiles(files); }
  const text = e.clipboardData.getData('text');
  if (!text) return;
  e.preventDefault();
  try { const it = await create(stamp(), text); if (it) { toast('Trecho colado'); await refresh(); openItem(it.id); } }
  catch (err) { toast(err.message, true); }
});

// arrastar e soltar
let dragDepth = 0;
const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
document.addEventListener('dragenter', e => { if (hasFiles(e)) { dragDepth++; document.body.classList.add('dragging'); } });
document.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('dragging'); } });
document.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
document.addEventListener('drop', e => {
  if (!hasFiles(e)) return;
  e.preventDefault(); dragDepth = 0; document.body.classList.remove('dragging');
  uploadFiles([...e.dataTransfer.files]);
});

(async () => {
  try { const p = await api('/api/ping'); MAX = p.max; } catch (e) { return; }
  await refresh();
  setInterval(refresh, 3000);
})();
</script>
</body>
</html>
"""


def main():
    srv = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    ip = lan_ip()
    print("\n  Pastebin Caseiro rodando!")
    print(f"  Neste PC:        http://localhost:{PORT}")
    print(f"  Outros aparelhos: http://{ip}:{PORT}")
    print(f"  Arquivos em:     {DATA}")
    print(f"  PIN:             {'ativado' if PIN else 'desativado (use PIN=1234 para ativar)'}")
    print("\n  Ctrl+C para parar.\n")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n  Até mais!")


if __name__ == "__main__":
    main()
