import { createApi } from "./api/index.js";
import { staticIdeas } from "./ideas.js";
import { ICON, BOW } from "./icons.js";

/* ================= constantes ================= */
const DEF = { title: "Natal 2026", drawDate: "", exchangeDate: "2026-12-24", budget: null, status: "open", drawnAt: null, drawCount: 0, features: { aiIdeas: false } };
const SHOES = Array.from({ length: 14 }, (_, i) => String(33 + i));
const PANTS_N = ["34", "36", "38", "40", "42", "44", "46", "48", "50", "52", "54"];
const PANTS_L = ["PP", "P", "M", "G", "GG", "XG"];
const SHIRTS = ["PP", "P", "M", "G", "GG", "XG", "XGG"];
const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
const POLL_MS = 30000;
const K_TOKEN = "amigo-secreto:token";
const K_ADMIN = "amigo-secreto:admin";

const api = createApi();

/* ================= estado ================= */
const S = {
  config: { ...DEF },
  people: [],            // lista pública: {id, name, photo, complete}
  me: null,              // meu cadastro completo
  token: null, tokenInvalid: false,
  adminKey: null, isAdmin: false, adminPeople: [],
  asg: null,             // {receiver, reason}
  loading: true, offline: false,
  view: "inicio", revealed: false, opening: false,
  autoOpen: false,       // chegou pelo link pessoal: abre o presente sozinho
  ai: { status: "idle", items: [], msg: "" },
  busy: false, sheetOpen: false, dlgDone: null,
};

/* ================= utilidades ================= */
const $ = (q, r = document) => r.querySelector(q);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const str = (v, max) => (typeof v === "string" ? v : v == null ? "" : String(v)).slice(0, max);
const safePhoto = (p) => (typeof p === "string" && p.length < 280000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p) ? p : null);
const TITLES = /^(dona|d\.|seu|sr\.?|sra\.?|tio|tia|vó|vô|vovó|vovô|avó|avô|dr\.?|dra\.?)$/i;
// Primeiro nome; com título junto ("Dona Célia", "Tio Beto") mantém os dois.
const first = (n) => { const w = str(n, 40).trim().split(/\s+/).filter(Boolean); return (w.length > 1 && TITLES.test(w[0]) ? `${w[0]} ${w[1]}` : w[0]) || "essa pessoa"; };
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtLong = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });
const fmtDM = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
const fmtDT = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
function parseDate(v) { if (!/^\d{4}-\d{2}-\d{2}$/.test(v || "")) return null; const [y, m, d] = v.split("-").map(Number); return new Date(y, m - 1, d); }
function daysUntil(v) { const d = parseDate(v); if (!d) return null; const t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((d - t) / 86400000); }
function setHTML(el, html) { if (el && el._h !== html) { el.innerHTML = html; el._h = html; } }
function splitList(v) { return str(v, 600).split(/\n|;|,(?!\d)/).map((x) => x.trim()).filter(Boolean).slice(0, 10); }
function complete(p) { return !!(p && (p.complete || (p.name && p.shoe && p.pants && p.shirt))); }
function sizesLine(p) { return [["Calçado", p.shoe], ["Calça", p.pants], ["Camisa", p.shirt]].filter((x) => x[1]).map((x) => `${x[0]} ${str(x[1], 16)}`).join(" · "); }
const byName = (a, b) => str(a.name, 40).localeCompare(str(b.name, 40), "pt-BR");
function store(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* navegador sem armazenamento */ } }
function read(k) { try { return localStorage.getItem(k); } catch { return null; } }

const AV_BG = ["linear-gradient(140deg,#2a8a63,#0f3a2b)", "linear-gradient(140deg,#d2475b,#6e1424)", "linear-gradient(140deg,#d9a441,#7d5410)", "linear-gradient(140deg,#4f86a8,#1b3446)"];
function avatar(p, size) {
  const name = str(p && p.name, 40) || "?";
  const ph = safePhoto(p && p.photo);
  if (ph) return `<span class="av" style="width:${size}px;height:${size}px;background-image:url('${ph}')" role="img" aria-label="${esc(name)}"></span>`;
  const ini = name.trim().split(/\s+/).slice(0, size < 32 ? 1 : 2).map((w) => w[0] || "").join("").toUpperCase() || "?";
  let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `<span class="av" style="width:${size}px;height:${size}px;background:${AV_BG[h % AV_BG.length]};font-size:${Math.round(size * 0.38)}px" aria-hidden="true">${esc(ini)}</span>`;
}

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("on");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("on"), 2800);
}

function errorCopy(e) {
  switch (e && e.code) {
    case "network": return "Sem conexão com o servidor. Confira a internet e tente de novo.";
    case "unauthorized": return "Seu link não vale mais. Peça um novo ao organizador.";
    case "forbidden": return "Só o organizador pode fazer isso.";
    case "too_large": return "A foto ficou grande demais. Tente outra.";
    case "conflict": case "invalid": return (e && e.message) || "Confira os dados e tente de novo.";
    default: return "Algo deu errado. Tente de novo em instantes.";
  }
}

function personalLink(token) { return `${location.origin}${location.pathname}#t=${encodeURIComponent(token)}`; }
function waHref(token, name) {
  const msg = S.config.status === "drawn"
    ? `Oi, ${first(name)}! O sorteio do Amigo Secreto de Natal já foi feito. Toque no link para ver quem você tirou e as ideias de presente:\n${personalLink(token)}`
    : `Oi, ${first(name)}! Este é o seu link do Amigo Secreto de Natal. Guarde: é por ele que você entra e, no dia do sorteio, vê quem tirou.\n${personalLink(token)}`;
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch { /* sem cópia */ } ta.remove();
  }
  toast("Link copiado");
}

/* ================= dados ================= */
async function refresh() {
  try {
    const [cfg, ppl] = await Promise.all([api.getConfig(), api.listParticipants()]);
    S.config = { ...DEF, ...(cfg || {}) };
    S.people = Array.isArray(ppl) ? ppl : [];
    S.offline = false;
  } catch { S.offline = true; }

  if (S.token) {
    try { S.me = await api.getMe(); S.tokenInvalid = false; }
    catch (e) {
      if (e.code === "unauthorized" || e.code === "not_found") { S.me = null; S.token = null; S.tokenInvalid = true; store(K_TOKEN, null); api.setToken(null); }
    }
    if (S.me && S.config.status === "drawn") { try { S.asg = await api.getMyAssignment(); } catch { /* mantém o que tinha */ } }
    else S.asg = null;
  } else { S.me = null; S.asg = null; }

  if (S.adminKey) {
    try { S.adminPeople = (await api.admin.listParticipants()) || []; S.isAdmin = true; }
    catch (e) {
      if (e.code === "unauthorized" || e.code === "forbidden") {
        S.isAdmin = false; S.adminKey = null; store(K_ADMIN, null); api.setAdminKey(null);
        toast("Chave de organizador inválida.");
      }
    }
  }
  S.loading = false;
  fillMyForm(); fillConfigForm(); render();
  autoOpenGift();
}

/** Quem chega pelo link pessoal depois do sorteio já vê quem tirou, sem precisar tocar no presente. */
function autoOpenGift() {
  if (!S.autoOpen || !S.token) return;
  if (S.me) S.autoOpen = false;
  if (S.revealed || !myReceiver()) return;
  go("inicio");
  setTimeout(openGift, REDUCE ? 0 : 700);
}

/* ================= formulário de pessoa ================= */
function sizeRow(prefix, key, label, groups, otherPh) {
  const chips = groups.map((g, gi) => (gi ? '<span class="chip-sep" aria-hidden="true"></span>' : "") +
    g.map((v) => `<button type="button" class="chip" role="radio" aria-checked="false" data-k="${key}" data-v="${v}">${v}</button>`).join("")).join("");
  return `<div>
    <div class="field-label" id="${prefix}-${key}-lbl">${label}</div>
    <div class="chips" role="radiogroup" aria-labelledby="${prefix}-${key}-lbl">${chips}<button type="button" class="chip" role="radio" aria-checked="false" data-k="${key}" data-v="__other">Outro</button></div>
    <input class="input other-input" id="${prefix}-${key}-other" maxlength="16" placeholder="${otherPh}" hidden aria-label="${label}: outro tamanho">
  </div>`;
}

function buildForm(root, prefix, { submitLabel, onSave }) {
  root.innerHTML = `<form class="form" novalidate>
    <div class="photo-pick">
      <button type="button" class="photo-circle" id="${prefix}-photo-btn" aria-label="Escolher foto">${ICON.camera}</button>
      <div>
        <div class="field-label" style="margin-left:0">Foto</div>
        <div class="photo-actions">
          <button type="button" class="btn btn-glass btn-sm" id="${prefix}-photo-choose">Escolher foto</button>
          <button type="button" class="btn btn-text btn-sm" id="${prefix}-photo-clear" hidden>Remover</button>
        </div>
        <p class="hint" style="margin-left:0">Uma foto de rosto ajuda quem te tirar.</p>
      </div>
      <input type="file" accept="image/*" id="${prefix}-photo" hidden>
    </div>
    <div><label class="field-label" for="${prefix}-name">Nome</label><input class="input" id="${prefix}-name" maxlength="40" autocomplete="name" placeholder="Como a família te chama"></div>
    ${sizeRow(prefix, "shoe", "Calçado", [SHOES], "Ex.: 37/38 ou infantil 30")}
    ${sizeRow(prefix, "pants", "Calça", [PANTS_N, PANTS_L], "Ex.: 38 jeans ou infantil 10")}
    ${sizeRow(prefix, "shirt", "Camisa", [SHIRTS], "Ex.: infantil 12 ou G3")}
    <div><label class="field-label" for="${prefix}-likes">Do que você gosta?</label><textarea class="input" id="${prefix}-likes" maxlength="300" placeholder="Café, livros de suspense, plantas, futebol…"></textarea></div>
    <div><label class="field-label" for="${prefix}-wish">Lista de desejos</label><textarea class="input" id="${prefix}-wish" maxlength="500" placeholder="Um item por linha"></textarea></div>
    <div><label class="field-label" for="${prefix}-avoid">Prefiro não ganhar</label><input class="input" id="${prefix}-avoid" maxlength="160" placeholder="Ex.: perfume, chocolate"></div>
    <div><button type="submit" class="btn btn-gold btn-block" id="${prefix}-save">${esc(submitLabel)}</button><p class="form-status" id="${prefix}-status" role="status"></p></div>
  </form>`;

  const form = root.querySelector("form");
  const F = (id) => root.querySelector(`#${prefix}-${id}`);
  let photo = null, dirty = false;
  const sizes = { shoe: "", pants: "", shirt: "" };
  const opts = { shoe: SHOES, pants: [...PANTS_N, ...PANTS_L], shirt: SHIRTS };

  function paintPhoto() {
    const b = F("photo-btn");
    b.style.backgroundImage = photo ? `url('${photo}')` : "";
    b.classList.toggle("has", !!photo);
    F("photo-clear").hidden = !photo;
  }
  function setSize(k, v) {
    sizes[k] = v;
    const isStd = opts[k].includes(v), other = F(`${k}-other`);
    root.querySelectorAll(`.chip[data-k="${k}"]`).forEach((c) => {
      const on = isStd ? c.dataset.v === v : (c.dataset.v === "__other" && (v !== "" || !other.hidden));
      c.setAttribute("aria-checked", on ? "true" : "false");
    });
    if (!isStd && v) { other.hidden = false; other.value = v; }
    if (isStd) other.hidden = true;
  }
  root.addEventListener("click", (e) => {
    const c = e.target.closest(".chip[data-k]"); if (!c) return;
    const k = c.dataset.k, v = c.dataset.v; dirty = true;
    if (v === "__other") {
      const other = F(`${k}-other`); other.hidden = false; sizes[k] = other.value.trim();
      root.querySelectorAll(`.chip[data-k="${k}"]`).forEach((x) => x.setAttribute("aria-checked", x === c ? "true" : "false"));
      other.focus();
    } else setSize(k, sizes[k] === v ? "" : v);
  });
  ["shoe", "pants", "shirt"].forEach((k) => F(`${k}-other`).addEventListener("input", (e) => { sizes[k] = e.target.value.trim(); dirty = true; }));
  form.addEventListener("input", () => { dirty = true; });

  const pick = () => F("photo").click();
  F("photo-btn").addEventListener("click", pick);
  F("photo-choose").addEventListener("click", pick);
  F("photo-clear").addEventListener("click", () => { photo = null; dirty = true; paintPhoto(); });
  F("photo").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0]; e.target.value = "";
    if (!file) return;
    try { photo = await shrinkPhoto(file); dirty = true; paintPhoto(); }
    catch { toast("Não consegui ler essa foto. Tente outra, em JPG ou PNG."); }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const st = F("status"), btn = F("save"), d = collect();
    if (!d.name) { st.className = "form-status err"; st.textContent = "Coloque o nome para continuar."; F("name").focus(); return; }
    btn.disabled = true; const lbl = btn.textContent; btn.textContent = "Salvando…"; st.className = "form-status"; st.textContent = "";
    try {
      await onSave(d);
      dirty = false; st.className = "form-status ok";
      st.textContent = complete(d) ? "Salvo." : "Salvo. Faltam alguns tamanhos, dá pra completar depois.";
    } catch (err) { st.className = "form-status err"; st.textContent = errorCopy(err); }
    finally { btn.disabled = false; btn.textContent = lbl; }
  });

  function collect() {
    return {
      name: F("name").value.trim().slice(0, 40), photo: photo || null,
      shoe: str(sizes.shoe, 16), pants: str(sizes.pants, 16), shirt: str(sizes.shirt, 16),
      likes: F("likes").value.trim().slice(0, 300), wishlist: F("wish").value.trim().slice(0, 500), avoid: F("avoid").value.trim().slice(0, 160),
    };
  }
  function fill(p) {
    p = p || {};
    F("name").value = str(p.name, 40); F("likes").value = str(p.likes, 300);
    F("wish").value = str(p.wishlist, 500); F("avoid").value = str(p.avoid, 160);
    photo = safePhoto(p.photo); paintPhoto();
    ["shoe", "pants", "shirt"].forEach((k) => { F(`${k}-other`).hidden = true; F(`${k}-other`).value = ""; setSize(k, str(p[k], 16)); });
    dirty = false;
  }
  return { fill, isDirty: () => dirty };
}

async function shrinkPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const side = Math.min(img.naturalWidth, img.naturalHeight); if (!side) throw new Error("vazia");
    const c = document.createElement("canvas"); c.width = c.height = 360;
    c.getContext("2d").drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 360, 360);
    return c.toDataURL("image/jpeg", 0.8);
  } finally { URL.revokeObjectURL(url); }
}

/* ================= folha e diálogo ================= */
function openSheet(build) {
  const body = $("#sheetBody"); body.innerHTML = ""; build(body);
  $("#scrim").classList.add("on"); const sh = $("#sheet"); sh.classList.add("on"); sh.setAttribute("aria-hidden", "false"); sh.scrollTop = 0;
  S.sheetOpen = true;
}
function closeSheet() {
  $("#scrim").classList.remove("on"); const sh = $("#sheet"); sh.classList.remove("on"); sh.setAttribute("aria-hidden", "true");
  S.sheetOpen = false; setTimeout(() => { if (!S.sheetOpen) $("#sheetBody").innerHTML = ""; }, 450);
}
function ask({ title, body, ok = "Confirmar", cancel = "Cancelar", danger = false }) {
  return new Promise((res) => {
    $("#dlgTitle").textContent = title; $("#dlgBody").textContent = body;
    const okB = $("#dlgOk"), cB = $("#dlgCancel");
    okB.textContent = ok; okB.className = "btn " + (danger ? "btn-danger" : "btn-gold"); cB.textContent = cancel;
    $("#dialog").classList.add("on"); $("#dlgScrim").classList.add("on"); setTimeout(() => cB.focus(), 30);
    const done = (v) => { $("#dialog").classList.remove("on"); $("#dlgScrim").classList.remove("on"); okB.onclick = cB.onclick = null; S.dlgDone = null; res(v); };
    okB.onclick = () => done(true); cB.onclick = () => done(false); S.dlgDone = done;
  });
}

function linkBoxHTML(token, name, { title = "Seu link pessoal", text = "Abra o app por ele em outro celular. Não passe para ninguém.", resetId = null } = {}) {
  return `<div class="linkbox inset">
    <div><b>${esc(title)}</b><span>${esc(text)}</span></div>
    <div class="link-url">${esc(personalLink(token))}</div>
    <div class="btn-row">
      <button class="btn btn-glass btn-sm" type="button" data-act="copy-link" data-v="${esc(token)}">${ICON.link} Copiar link</button>
      <a class="btn btn-glass btn-sm" href="${esc(waHref(token, name))}" target="_blank" rel="noopener">${ICON.chat} WhatsApp</a>
    </div>
    ${resetId ? `<button class="btn btn-text btn-sm" type="button" data-act="new-link" data-v="${esc(resetId)}">Trocar link (o atual para de funcionar)</button>` : ""}
  </div>`;
}

/* ================= render ================= */
function myReceiver() {
  if (S.config.status !== "drawn" || !S.asg) return undefined;
  if (S.asg.receiver) return { ...S.asg.receiver, _id: S.asg.receiver.id };
  return S.asg.reason === "receiver_left" ? null : undefined;
}

function renderHero() {
  $("#heroEyebrow").textContent = str(S.config.title, 50) || DEF.title;
  const r = myReceiver();
  $("#heroLede").textContent = S.config.status === "drawn"
    ? (r ? (S.revealed ? "Este é o seu amigo secreto. Guarde segredo até a troca!" : "O sorteio foi feito. Abra o presente para ver quem você tirou.") : "O sorteio foi feito. Cada pessoa vê aqui só quem tirou.")
    : "Cadastre sua foto e seus tamanhos. No dia do sorteio, você descobre aqui quem tirou.";
}

function statusHTML() {
  const c = S.config, n = S.people.length, drawn = c.status === "drawn";
  const date = drawn ? c.exchangeDate : c.drawDate, d = daysUntil(date);
  let big, unit = "", word = false;
  if (S.loading) { big = "…"; unit = "carregando"; }
  else if (d === null) { big = "—"; unit = "sem data"; }
  else if (d > 1) { big = String(d); unit = "dias"; }
  else if (d === 1) { big = "1"; unit = "dia"; }
  else if (d === 0) { big = "Hoje"; word = true; }
  else { big = drawn ? "Feliz" : "—"; unit = drawn ? "Natal" : "aguardando"; word = drawn; }
  const dateTxt = parseDate(date) ? fmtLong.format(parseDate(date)) : (S.isAdmin ? "Defina a data em Organizar" : "Data a definir");
  const eyebrow = drawn ? `Sorteado${c.drawnAt ? " em " + fmtDT.format(new Date(c.drawnAt)) : ""}` : "Inscrições abertas";
  const ppl = S.people.slice().sort(byName).slice(0, 5);
  const pills = [`<span class="pill">${ppl.length ? `<span class="stack">${ppl.map((p) => avatar(p, 24)).join("")}</span>` : ""}${n} ${n === 1 ? "pessoa" : "pessoas"}</span>`];
  if (Number(c.budget) > 0) pills.push(`<span class="pill gold">Até ${BRL.format(c.budget)}</span>`);
  if (!drawn && parseDate(c.exchangeDate)) pills.push(`<span class="pill">Troca em ${fmtDM.format(parseDate(c.exchangeDate))}</span>`);
  return `<div class="glass card status">
    <div><div class="eyebrow ${drawn ? "ok" : ""}">${esc(eyebrow)}</div><h2 class="card-title">${drawn ? "Troca de presentes" : "Sorteio"}</h2><div class="status-date">${esc(dateTxt)}</div></div>
    <div class="big ${word ? "word" : ""}">${esc(big)}${unit ? `<small>${unit}</small>` : ""}</div>
    <div class="pills">${pills.join("")}</div>
  </div>`;
}

function giftHTML() {
  return `<div class="glass gift">
    <button class="gift-btn" data-act="open-gift" id="giftBox" type="button" aria-label="Abrir o presente e ver quem você tirou">
      <span class="box-float"><span class="box">
        <span class="lid"><span class="rib"></span>${BOW}</span>
        <span class="base"><span class="rib"></span><span class="shine"></span></span>
      </span></span>
      <span class="gift-title">Seu amigo secreto<br>está aqui dentro</span>
      <span class="gift-sub">Toque no presente para abrir. Veja se ninguém está espiando.</span>
    </button>
  </div>`;
}

function ideaItem(t, w, price) {
  return `<li class="idea inset"><span class="idea-ico">${ICON.gift}</span><div><b>${esc(t)}</b>${w ? `<span>${esc(w)}</span>` : ""}</div>${price ? `<em>${esc(price)}</em>` : "<i></i>"}</li>`;
}

function ideasHTML(p) {
  const budget = Number(S.config.budget) > 0 ? `<span class="pill gold">Até ${BRL.format(S.config.budget)}</span>` : "";
  let aiPart = "";
  if (S.config.features && S.config.features.aiIdeas) {
    const st = S.ai, list = st.items.length ? `<ul class="idea-list">${st.items.map((x) => ideaItem(x.t, x.w, x.p)).join("")}</ul>` : "";
    if (st.status === "loading") aiPart = `${list}<div class="ai-loading inset" role="status"><span class="dots"><i></i><i></i><i></i></span><span>Pensando em presentes para ${esc(first(p.name))}…</span></div>`;
    else if (st.status === "done") aiPart = `<h4 class="mini">Sugestões com IA</h4>${list}<button class="btn btn-glass btn-block" type="button" data-act="ai">${ICON.spark} Outras ideias</button>`;
    else aiPart = `${st.msg ? `<p class="warn">${esc(st.msg)}</p>` : ""}<button class="btn btn-gold btn-block" type="button" data-act="ai">${ICON.spark} Pedir ideias com IA</button>`;
  }
  return `<div class="block">
    <div class="ideas-head"><h3 class="block-title">Ideias de presente</h3>${budget}</div>
    ${aiPart}${aiPart ? '<h4 class="mini">Pelo perfil</h4>' : ""}
    <ul class="idea-list">${staticIdeas(p).map(([t, w]) => ideaItem(t, w, "")).join("")}</ul>
  </div>`;
}

function receiverHTML(p) {
  const ph = safePhoto(p.photo), wish = splitList(p.wishlist);
  const sz = [["Calçado", p.shoe], ["Calça", p.pants], ["Camisa", p.shirt]];
  const photo = ph
    ? `<div class="rcv-photo" style="background-image:url('${ph}')" role="img" aria-label="Foto de ${esc(p.name)}"></div>`
    : `<div class="rcv-photo">${avatar(p, 136)}</div>`;
  return `<div class="rcv">
      ${photo}
      <div class="eyebrow">Você tirou</div>
      <h2 class="rcv-name">${esc(str(p.name, 40))}</h2>
      <div class="sizes">${sz.map(([l, v]) => { const t = str(v, 16); return `<div class="size inset ${t ? "" : "missing"}"><b class="${t.length > 3 ? "long" : ""}">${t ? esc(t) : "—"}</b><span>${l}</span></div>`; }).join("")}</div>
    </div>
    ${p.likes ? `<div class="block"><h3 class="block-title">Gosta de</h3><p>${esc(str(p.likes, 300))}</p></div>` : ""}
    ${wish.length ? `<div class="block"><h3 class="block-title">Lista de desejos</h3><ul class="wish">${wish.map((w) => `<li>${esc(w)}</li>`).join("")}</ul></div>` : ""}
    ${p.avoid ? `<div class="block"><h3 class="block-title">Prefere não ganhar</h3><p>${esc(str(p.avoid, 160))}</p></div>` : ""}
    ${ideasHTML(p)}`;
}

function noteCard(title, text, extra = "") {
  return `<div class="glass card stack-col"><div>${title ? `<h2 class="card-title">${esc(title)}</h2>` : ""}<p class="muted" style="margin-top:${title ? 8 : 0}px">${esc(text)}</p></div>${extra}</div>`;
}

function mineHTML() {
  if (S.loading) return "";
  if (S.offline && !S.people.length) return noteCard("Sem conexão", "Não consegui falar com o servidor. Confira a internet; a página tenta de novo sozinha.");
  const c = S.config, me = S.me;
  if (c.status === "drawn") {
    const r = myReceiver();
    if (r) return S.revealed
      ? `<div class="glass card reveal">${receiverHTML(r)}<button class="btn btn-glass btn-block" type="button" data-act="hide-gift">${ICON.eyeOff} Esconder</button></div>`
      : giftHTML();
    if (r === null) return noteCard("Ops, a corrente quebrou", "A pessoa que você tirou saiu da lista. Peça ao organizador para refazer o sorteio.");
    if (me) return noteCard("Você entrou depois do sorteio", "Seu cadastro está salvo, mas o sorteio já tinha sido feito. Peça ao organizador para refazer.");
    return noteCard("O sorteio já foi feito", S.tokenInvalid
      ? "Seu link não vale mais. Peça um novo ao organizador."
      : "Para ver quem você tirou, abra o link pessoal que você recebeu. Se você ficou de fora, fale com o organizador.");
  }
  if (me) {
    return `<div class="glass card stack-col">
      <div class="me-row">${avatar(me, 60)}<div><div class="eyebrow ok">Você está no sorteio</div><div class="me-name">${esc(str(me.name, 40))}</div><div class="faint">${esc(sizesLine(me))}</div></div></div>
      ${complete(me) ? "" : '<p class="warn">Faltam alguns tamanhos. Quem te tirar vai agradecer.</p>'}
      <button class="btn btn-glass btn-block" type="button" data-act="go" data-v="cadastro">${ICON.edit} Editar cadastro</button>
    </div>`;
  }
  return `<div class="glass card stack-col">
    <div><h2 class="card-title">Entre no sorteio</h2><p class="muted" style="margin-top:8px">${S.tokenInvalid ? "Seu link antigo não vale mais. Peça um novo ao organizador ou cadastre-se de novo." : "Foto, nome e tamanhos. Leva um minuto."}</p></div>
    <button class="btn btn-gold btn-block" type="button" data-act="go" data-v="cadastro">Fazer meu cadastro</button>
  </div>`;
}

function howHTML() {
  return `<div class="glass card">
    <h2 class="card-title">Como funciona</h2>
    <ol class="steps">
      <li><span class="num">1</span><div><b>Cadastre-se</b><span>Foto, nome e seus tamanhos de calçado, calça e camisa.</span></div></li>
      <li><span class="num">2</span><div><b>Dia do sorteio</b><span>O organizador sorteia. Ninguém tira a si mesmo.</span></div></li>
      <li><span class="num">3</span><div><b>Abra seu presente</b><span>Você vê quem tirou, os tamanhos e ideias de presente.</span></div></li>
    </ol>
  </div>`;
}

function renderHome() {
  if (S.opening) return;
  setHTML($("#homeStatus"), statusHTML());
  setHTML($("#homeMine"), mineHTML());
  setHTML($("#homeHow"), S.config.status === "drawn" ? "" : howHTML());
}

function renderNotice() {
  let html = "";
  if (api.mode === "mock") {
    html = `<div class="glass demo-bar"><p>Modo demonstração: os dados ficam só neste navegador. Configure o backend em js/config.js.</p>${
      S.isAdmin ? "" : '<button class="btn btn-glass btn-sm" type="button" data-act="demo-admin">Entrar como organizador</button>'}</div>`;
  } else if (S.offline && S.people.length) {
    html = '<div class="glass card" style="padding:14px 18px"><p class="warn">Sem conexão com o servidor. Mostrando os últimos dados.</p></div>';
  }
  setHTML($("#notice"), html);
}

function renderCadastro() {
  const me = S.me, drawn = S.config.status === "drawn";
  $("#cadTitle").textContent = me ? "Seu cadastro" : "Entrar no sorteio";
  const closed = drawn && !me;
  setHTML($("#cadMsg"), closed ? noteCard("", "O sorteio já foi feito, então as inscrições estão fechadas. Fale com o organizador se você ficou de fora.") : "");
  $("#myFormWrap").hidden = closed || S.loading;
  setHTML($("#cadLink"), me && S.token ? linkBoxHTML(S.token, me.name) : "");
  $("#cadLeave").hidden = !(me && !drawn);
}

function renderPeople() {
  const list = S.people.slice().sort(byName), n = list.length;
  $("#pplCount").textContent = `${n} ${n === 1 ? "pessoa" : "pessoas"} no sorteio`;
  if (!n) {
    setHTML($("#pplGrid"), noteCard("Ninguém ainda", S.loading ? "Carregando…" : "Seja a primeira pessoa a se cadastrar.",
      '<button class="btn btn-gold btn-block" type="button" data-act="go" data-v="cadastro">Fazer meu cadastro</button>'));
    return;
  }
  const myId = S.me && S.me.id;
  setHTML($("#pplGrid"), `<div class="grid">${list.map((p) => `<div class="person glass">${avatar(p, 76)}<div class="nm">${esc(str(p.name, 40))}</div>${
    p.id === myId ? '<span class="tag me">Você</span>' : !complete(p) ? '<span class="tag warn-t">Faltam tamanhos</span>' : '<span class="tag">Pronto</span>'}</div>`).join("")}</div>`);
}

function admDrawHTML() {
  const c = S.config, ppl = S.adminPeople, n = ppl.length;
  if (S.busy === "draw") return '<div class="glass card"><div class="eyebrow">Sorteio</div><h2 class="card-title">Sorteando…</h2><div class="progress"><span style="width:70%"></span></div><p class="muted">Não feche esta tela.</p></div>';
  if (c.status === "drawn") {
    const inDraw = ppl.filter((p) => p.inDraw).length;
    const late = n - inDraw, gone = Math.max(0, (Number(c.drawCount) || 0) - inDraw);
    let warn = "";
    if (gone) warn += `<p class="warn">${gone} ${gone === 1 ? "pessoa saiu" : "pessoas saíram"} depois do sorteio. Refaça para fechar a corrente.</p>`;
    if (late) warn += `<p class="warn">${late} ${late === 1 ? "pessoa entrou" : "pessoas entraram"} depois do sorteio e ainda não tem par.</p>`;
    return `<div class="glass card stack-col">
      <div><div class="eyebrow ok">Sorteio feito</div><h2 class="card-title">${Number(c.drawCount) || inDraw} pessoas sorteadas</h2>
      <p class="muted" style="margin-top:8px">${c.drawnAt ? "Em " + esc(fmtDT.format(new Date(c.drawnAt))) + ". " : ""}Cada pessoa abre o próprio link e vê só quem tirou. Nem você vê os pares.</p>
      <p class="muted" style="margin-top:8px">Para avisar quem tem dificuldade, toque em ${ICON.link} ao lado do nome em Participantes e mande pelo WhatsApp.</p></div>
      ${warn}
      <div class="btn-row"><button class="btn btn-glass" type="button" data-act="redraw">Refazer sorteio</button><button class="btn btn-glass" type="button" data-act="reopen">Reabrir inscrições</button></div>
    </div>`;
  }
  const inc = ppl.filter((p) => !complete(p)).length, d = daysUntil(c.drawDate);
  const when = d === null ? "Defina o dia do sorteio nos ajustes abaixo." : d > 0 ? `Marcado para ${fmtLong.format(parseDate(c.drawDate))}.` : d === 0 ? "Hoje é o dia do sorteio." : "O dia marcado já passou.";
  return `<div class="glass card stack-col">
    <div><div class="eyebrow">Inscrições abertas</div><h2 class="card-title">${n} ${n === 1 ? "pessoa" : "pessoas"} no sorteio</h2>
    <p class="muted" style="margin-top:8px">${esc(when)} ${n < 3 ? "O sorteio precisa de pelo menos 3 pessoas." : "Ninguém tira a si mesmo, e cada um vê só o seu par."}</p></div>
    ${inc ? `<p class="warn">${inc} ainda sem todos os tamanhos.</p>` : ""}
    <button class="btn btn-gold btn-block" type="button" data-act="draw" ${n < 3 ? "disabled" : ""}>${ICON.star} Sortear agora</button>
  </div>`;
}

function admPeopleHTML() {
  const list = S.adminPeople.slice().sort(byName), myId = S.me && S.me.id;
  const rows = list.map((p) => `<div class="row inset">${avatar(p, 42)}
    <div style="min-width:0"><div class="nm">${esc(str(p.name, 40))}${p.id === myId ? '<span class="tag me">Você</span>' : ""}${p.manual ? '<span class="tag">Cadastrado por você</span>' : ""}</div>
    <div class="sub">${esc(sizesLine(p) || "Sem tamanhos")}</div></div>
    <div class="acts">
      <button class="icon-btn" type="button" data-act="show-link" data-v="${esc(p.id)}" aria-label="Link pessoal de ${esc(p.name)}">${ICON.link}</button>
      <button class="icon-btn" type="button" data-act="edit-person" data-v="${esc(p.id)}" aria-label="Editar ${esc(p.name)}">${ICON.edit}</button>
      <button class="icon-btn danger" type="button" data-act="del-person" data-v="${esc(p.id)}" aria-label="Remover ${esc(p.name)}">${ICON.trash}</button>
    </div>
  </div>`).join("");
  const demo = api.mode === "mock"
    ? '<div class="btn-row" style="margin-top:14px"><button class="btn btn-glass btn-sm" type="button" data-act="demo-seed">Adicionar 4 pessoas de exemplo</button><button class="btn btn-text btn-sm" type="button" data-act="demo-reset">Apagar demonstração</button></div>'
    : "";
  return `<div class="glass card">
    <div class="card-head"><div><h2 class="card-title">Participantes</h2><p class="faint" style="margin-top:6px">Cadastre quem tem dificuldade e toque em ${ICON.link} para mandar o link de cada pessoa pelo WhatsApp. Quem abre o link depois do sorteio já vê quem tirou.</p></div>
    <button class="btn btn-glass btn-sm" type="button" data-act="add-person">${ICON.plus} Cadastrar</button></div>
    <div class="list">${rows || '<p class="muted">Ninguém cadastrado ainda.</p>'}</div>${demo}
  </div>`;
}

function renderAdmin() {
  if (!S.isAdmin) return;
  setHTML($("#admDraw"), admDrawHTML());
  setHTML($("#admPeople"), admPeopleHTML());
}

function renderTabs() {
  $("#tab-admin").hidden = !S.isAdmin;
  if (S.view === "admin" && !S.isAdmin) go("inicio");
  document.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-selected", t.dataset.tab === S.view ? "true" : "false"));
  requestAnimationFrame(() => {
    const t = document.querySelector(`.tab[data-tab="${S.view}"]`), ind = $("#tabInd");
    if (t && !t.hidden) { ind.style.width = `${t.offsetWidth}px`; ind.style.transform = `translateX(${t.offsetLeft}px)`; }
  });
}

function render() { renderHero(); renderNotice(); renderHome(); renderCadastro(); renderPeople(); renderAdmin(); renderTabs(); }

function go(view) {
  if (view === "admin" && !S.isAdmin) view = "inicio";
  S.view = view;
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("on", v.dataset.view === view));
  renderTabs();
  window.scrollTo({ top: 0, behavior: REDUCE ? "auto" : "smooth" });
}

/* ================= ações ================= */
async function openGift() {
  const el = $("#giftBox"); if (!el || S.opening) return;
  if (REDUCE) { S.revealed = true; render(); return; }
  S.opening = true; el.classList.add("opening");
  const box = el.querySelector(".box");
  for (let i = 0; i < 26; i++) {
    const sp = document.createElement("span"); sp.className = "spark";
    const ang = Math.random() * Math.PI * 2, dist = 70 + Math.random() * 90;
    sp.style.setProperty("--dx", `${Math.cos(ang) * dist}px`); sp.style.setProperty("--dy", `${Math.sin(ang) * dist - 30}px`);
    sp.style.animationDelay = `${(Math.random() * 0.18).toFixed(2)}s`;
    box.appendChild(sp);
  }
  await sleep(880);
  S.opening = false; S.revealed = true; render();
}

async function askAI() {
  if (S.ai.status === "loading") return;
  S.ai = { status: "loading", items: S.ai.items, msg: "" }; render();
  try {
    const res = await api.getIdeas();
    const items = (Array.isArray(res && res.ideas) ? res.ideas : []).filter((x) => x && x.titulo).slice(0, 6)
      .map((x) => ({ t: str(x.titulo, 90), w: str(x.porque, 180), p: str(x.preco, 30) }));
    if (!items.length) throw new Error("vazio");
    S.ai = { status: "done", items, msg: "" };
  } catch {
    S.ai = { status: "error", items: S.ai.items, msg: "Não deu certo desta vez. Tente de novo." };
  }
  render();
}

async function runDraw(again) {
  const n = S.adminPeople.length;
  if (n < 3) { toast("O sorteio precisa de pelo menos 3 pessoas."); return; }
  const inc = S.adminPeople.filter((p) => !complete(p)).length, d = daysUntil(S.config.drawDate);
  let body = again
    ? `Todos os pares mudam. Quem já viu quem tirou vai ganhar um novo amigo secreto. ${n} pessoas entram.`
    : `${n} pessoas entram no sorteio. Cada uma vai ver só quem tirou.`;
  if (inc) body += ` ${inc} ainda ${inc === 1 ? "está" : "estão"} sem todos os tamanhos.`;
  if (!again && d !== null && d > 0) body += ` O sorteio estava marcado para ${fmtDM.format(parseDate(S.config.drawDate))}.`;
  if (!(await ask({ title: again ? "Refazer o sorteio?" : "Fazer o sorteio agora?", body, ok: again ? "Refazer" : "Sortear", danger: again }))) return;
  S.busy = "draw"; renderAdmin();
  try { await api.admin.draw(); S.revealed = false; toast("Sorteio feito. Avise a família!"); }
  catch (e) { toast(errorCopy(e)); }
  finally { S.busy = false; await refresh(); }
}

async function reopen() {
  if (!(await ask({ title: "Reabrir inscrições?", body: "Os pares atuais deixam de valer. Novas pessoas podem se cadastrar, e depois você sorteia de novo.", ok: "Reabrir", danger: true }))) return;
  try { await api.admin.reopen(); toast("Inscrições reabertas"); } catch (e) { toast(errorCopy(e)); }
  refresh();
}

async function delPerson(id) {
  const p = S.adminPeople.find((x) => x.id === id); if (!p) return;
  const drawn = S.config.status === "drawn";
  if (!(await ask({ title: `Remover ${first(p.name)}?`, body: drawn ? "O sorteio já foi feito. Depois de remover, refaça o sorteio para ninguém ficar sem par." : "O cadastro dessa pessoa será apagado.", ok: "Remover", danger: true }))) return;
  try { await api.admin.deleteParticipant(id); toast("Removido"); } catch (e) { toast(errorCopy(e)); }
  refresh();
}

async function leave() {
  if (!(await ask({ title: "Sair do sorteio?", body: "Seu cadastro será apagado. Você pode se cadastrar de novo enquanto as inscrições estiverem abertas.", ok: "Sair", danger: true }))) return;
  try {
    await api.deleteMe();
    S.me = null; S.token = null; store(K_TOKEN, null); api.setToken(null); myForm.fill({});
    toast("Você saiu do sorteio"); go("inicio");
  } catch (e) { toast(errorCopy(e)); }
  refresh();
}

function showLinkSheet(token, name, { forSelf, resetId = null }) {
  openSheet((body) => {
    body.innerHTML = `<div class="sheet-head"><h2 class="card-title">${forSelf ? "Pronto, você está no sorteio" : `Link de ${esc(first(name))}`}</h2><button class="icon-btn" type="button" data-act="close-sheet" aria-label="Fechar">${ICON.x}</button></div>
      <p class="muted">${forSelf
        ? "Este celular já fica conectado. Guarde o link abaixo para abrir em outro aparelho."
        : `Mande este link só para ${esc(first(name))}. ${S.config.status === "drawn" ? `Ao abrir, ${esc(first(name))} já vê quem tirou e as ideias de presente.` : `É por ele que ${esc(first(name))} edita o cadastro e, no dia, vê quem tirou.`}`}</p>
      ${linkBoxHTML(token, name, forSelf ? {} : { title: "Link pessoal", text: "Não abra neste celular: ele passaria a entrar como essa pessoa.", resetId })}
      <button class="btn btn-gold btn-block" type="button" data-act="close-sheet">Fechar</button>`;
  });
}

function openPersonSheet(id) {
  const p = id ? S.adminPeople.find((x) => x.id === id) : null;
  openSheet((body) => {
    body.innerHTML = `<div class="sheet-head"><h2 class="card-title">${p ? "Editar " + esc(first(p.name)) : "Cadastrar alguém"}</h2><button class="icon-btn" type="button" data-act="close-sheet" aria-label="Fechar">${ICON.x}</button></div>
      ${p ? "" : '<p class="muted">Para quem tem dificuldade com o celular. No fim, você recebe o link pessoal dessa pessoa para mandar pelo WhatsApp.</p>'}
      <div id="admFormWrap"></div>`;
    const f = buildForm($("#admFormWrap"), "adm", {
      submitLabel: p ? "Salvar" : "Cadastrar",
      onSave: async (d) => {
        if (p) { await api.admin.updateParticipant(p.id, d); toast("Salvo"); closeSheet(); }
        else { const r = await api.admin.createParticipant(d); closeSheet(); setTimeout(() => showLinkSheet(r.token, d.name, { forSelf: false, resetId: r.participant && r.participant.id }), 460); }
        refresh();
      },
    });
    if (p) f.fill(p);
  });
}

function showLink(id) {
  const p = S.adminPeople.find((x) => x.id === id); if (!p) return;
  if (p.token) showLinkSheet(p.token, p.name, { forSelf: false, resetId: p.id });
  else newLink(id);
}

async function newLink(id) {
  const p = S.adminPeople.find((x) => x.id === id); if (!p) return;
  if (!(await ask({ title: `Novo link para ${first(p.name)}?`, body: "O link antigo para de funcionar. Use quando a pessoa perdeu o link ou trocou de celular.", ok: "Gerar link" }))) return;
  closeSheet();
  try { const r = await api.admin.resetLink(id); setTimeout(() => showLinkSheet(r.token, p.name, { forSelf: false, resetId: p.id }), 460); }
  catch (e) { toast(errorCopy(e)); }
  refresh();
}

/* ================= eventos ================= */
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-act]"); if (!b || b.disabled) return;
  const v = b.dataset.v;
  switch (b.dataset.act) {
    case "go": go(v); break;
    case "open-gift": openGift(); break;
    case "hide-gift": S.revealed = false; render(); window.scrollTo({ top: 0 }); break;
    case "ai": askAI(); break;
    case "draw": runDraw(false); break;
    case "redraw": runDraw(true); break;
    case "reopen": reopen(); break;
    case "add-person": openPersonSheet(null); break;
    case "edit-person": openPersonSheet(v); break;
    case "del-person": delPerson(v); break;
    case "show-link": showLink(v); break;
    case "new-link": newLink(v); break;
    case "copy-link": copyText(personalLink(v)); break;
    case "leave": leave(); break;
    case "close-sheet": closeSheet(); break;
    case "demo-admin": setAdminKey("demo"); await refresh(); go("admin"); break;
    case "demo-seed": await api.admin.seedDemo(); refresh(); break;
    case "demo-reset":
      if (await ask({ title: "Apagar a demonstração?", body: "Todos os cadastros e o sorteio de teste deste navegador somem.", ok: "Apagar", danger: true })) {
        await api.admin.resetDemo(); S.me = null; S.token = null; store(K_TOKEN, null); api.setToken(null); myForm.fill({}); refresh();
      }
      break;
  }
});
document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => go(t.dataset.tab)));
$("#scrim").addEventListener("click", closeSheet);
$("#dlgScrim").addEventListener("click", () => S.dlgDone && S.dlgDone(false));
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (S.dlgDone) S.dlgDone(false); else if (S.sheetOpen) closeSheet();
});
addEventListener("resize", renderTabs);

/* ================= ajustes do organizador ================= */
let cfgDirty = false;
$("#cfgForm").addEventListener("input", () => { cfgDirty = true; });
$("#cfgForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const st = $("#cfg-status"), btn = $("#cfg-save"), braw = $("#cfg-budget").value.trim();
  const patch = {
    title: $("#cfg-title").value.trim().slice(0, 50) || DEF.title,
    drawDate: $("#cfg-draw").value || "", exchangeDate: $("#cfg-ex").value || "",
    budget: braw === "" ? null : Math.max(0, Math.round(Number(braw)) || 0),
  };
  btn.disabled = true; st.className = "form-status"; st.textContent = "Salvando…";
  try { await api.admin.updateConfig(patch); cfgDirty = false; st.className = "form-status ok"; st.textContent = "Ajustes salvos."; refresh(); }
  catch (err) { st.className = "form-status err"; st.textContent = errorCopy(err); }
  finally { btn.disabled = false; }
});
function fillConfigForm() {
  if (cfgDirty || !S.isAdmin) return;
  const c = S.config;
  $("#cfg-title").value = str(c.title, 50);
  $("#cfg-draw").value = str(c.drawDate, 10);
  $("#cfg-ex").value = str(c.exchangeDate, 10);
  $("#cfg-budget").value = Number(c.budget) > 0 ? String(c.budget) : "";
}

/* ================= meu formulário ================= */
const myForm = buildForm($("#myFormWrap"), "me", {
  submitLabel: "Salvar cadastro",
  onSave: async (d) => {
    if (S.me) { S.me = await api.updateMe(d); }
    else {
      const r = await api.register(d);
      setToken(r.token); S.me = r.participant; S.tokenInvalid = false;
      showLinkSheet(r.token, d.name, { forSelf: true });
    }
    refresh();
  },
});
let myFilledAt = null;
function fillMyForm() {
  const me = S.me;
  if (!me || myForm.isDirty() || me.updatedAt === myFilledAt) return;
  myFilledAt = me.updatedAt; myForm.fill(me);
}

function setToken(t) { S.token = t || null; store(K_TOKEN, S.token); api.setToken(S.token); }
function setAdminKey(k) { S.adminKey = k || null; store(K_ADMIN, S.adminKey); api.setAdminKey(S.adminKey); }

/* ================= neve e luzes ================= */
function startSnow() {
  const c = $("#snow"), ctx = c.getContext("2d");
  let w = 0, h = 0, raf = 0;
  const flakes = [];
  function size() { const dpr = Math.min(2, devicePixelRatio || 1); w = innerWidth; h = innerHeight; c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  size(); addEventListener("resize", size);
  const N = Math.round(Math.min(110, Math.max(40, (w * h) / 9000)));
  for (let i = 0; i < N; i++) flakes.push({ x: Math.random() * w, y: Math.random() * h, r: 0.6 + Math.random() * 2.1, s: 0.25 + Math.random() * 0.75, a: Math.random() * 6.28, o: 0.25 + Math.random() * 0.55 });
  function draw() {
    ctx.clearRect(0, 0, w, h); ctx.fillStyle = "#fff";
    for (const f of flakes) { ctx.globalAlpha = f.o; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283); ctx.fill(); }
  }
  if (REDUCE) { draw(); return; }
  function tick() {
    for (const f of flakes) {
      f.y += f.s * (0.55 + f.r * 0.32); f.a += 0.012; f.x += Math.sin(f.a) * 0.35;
      if (f.y > h + 4) { f.y = -4; f.x = Math.random() * w; }
      if (f.x > w + 4) f.x = -4; else if (f.x < -4) f.x = w + 4;
    }
    draw(); raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);
  document.addEventListener("visibilitychange", () => { cancelAnimationFrame(raf); if (!document.hidden) raf = requestAnimationFrame(tick); });
}

function buildLights() {
  const svg = $("#lights"), ns = "http://www.w3.org/2000/svg";
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", "M-6 4 C 50 40, 120 42, 180 20 S 300 -2, 366 22"); path.setAttribute("class", "wire"); svg.appendChild(path);
  const L = path.getTotalLength(), cols = ["#f3c76a", "#e4475b", "#86dcaa", "#fff1cf"], N = 15;
  for (let i = 0; i < N; i++) {
    const pt = path.getPointAtLength((L * (i + 0.5)) / N);
    const b = document.createElementNS(ns, "ellipse");
    b.setAttribute("cx", pt.x.toFixed(1)); b.setAttribute("cy", (pt.y + 5).toFixed(1)); b.setAttribute("rx", "3.2"); b.setAttribute("ry", "4.2");
    b.setAttribute("fill", cols[i % 4]); b.setAttribute("class", "bulb");
    b.style.color = cols[i % 4]; b.style.animationDelay = `${(Math.random() * 3.2).toFixed(2)}s`;
    svg.appendChild(b);
  }
}

/* ================= início ================= */
function consumeHash() {
  const m = location.hash.match(/^#(t|admin)=(.+)$/);
  if (!m) return;
  const val = decodeURIComponent(m[2]).trim();
  if (m[1] === "t") { setToken(val); S.autoOpen = true; S.revealed = false; } else setAdminKey(val);
  history.replaceState(null, "", location.pathname + location.search);
}

function boot() {
  buildLights(); startSnow();
  setToken(read(K_TOKEN)); setAdminKey(read(K_ADMIN));
  consumeHash();
  render();
  refresh();
  setInterval(() => { if (!document.hidden && !S.busy) refresh(); }, POLL_MS);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
  addEventListener("hashchange", () => { consumeHash(); refresh(); });
}

boot();
