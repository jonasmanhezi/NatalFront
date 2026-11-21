// Modo demonstração: implementa o mesmo contrato da API guardando tudo no localStorage.
// Serve para ver o app funcionando antes do backend existir. Não use com a família de verdade:
// cada navegador teria o seu próprio sorteio.

import { ApiError } from "./http.js";
import { drawPairs } from "../draw.js";

const KEY = "amigo-secreto:demo:v1";
const DEFAULT_CONFIG = { title: "Natal 2026", drawDate: "", exchangeDate: "2026-12-24", budget: null, status: "open", drawnAt: null };

const wait = (ms = 140) => new Promise((r) => setTimeout(r, ms));
const s = (v, max) => (typeof v === "string" ? v : v == null ? "" : String(v)).trim().slice(0, max);
const PHOTO_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

function rnd(len) {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
}

function load() {
  try {
    const st = JSON.parse(localStorage.getItem(KEY));
    if (st && st.participants) return st;
  } catch { /* sem dados ainda */ }
  return { config: { ...DEFAULT_CONFIG }, participants: {}, assignments: {}, drawIds: [] };
}
function save(st) {
  try { localStorage.setItem(KEY, JSON.stringify(st)); }
  catch { throw new ApiError(413, "too_large", "O navegador ficou sem espaço. Use fotos menores."); }
}

function clean(d) {
  const photo = typeof d.photo === "string" && d.photo.length < 280000 && PHOTO_RE.test(d.photo) ? d.photo : null;
  const out = {
    name: s(d.name, 40), photo,
    shoe: s(d.shoe, 16), pants: s(d.pants, 16), shirt: s(d.shirt, 16),
    likes: s(d.likes, 300), wishlist: s(d.wishlist, 500), avoid: s(d.avoid, 160),
  };
  if (!out.name) throw new ApiError(422, "invalid", "Coloque um nome.");
  return out;
}
const complete = (p) => !!(p.name && p.shoe && p.pants && p.shirt);
const toPublic = (p) => ({ id: p.id, name: p.name, photo: p.photo, complete: complete(p) });
function toFull(p) { const { token, ...rest } = p; return rest; }
function toReceiver(p) {
  const { id, name, photo, shoe, pants, shirt, likes, wishlist, avoid } = p;
  return { id, name, photo, shoe, pants, shirt, likes, wishlist, avoid };
}
function publicConfig(st) {
  return { ...DEFAULT_CONFIG, ...st.config, drawCount: st.drawIds.length, features: { aiIdeas: false } };
}

export function createMockApi() {
  let token = null;
  let adminKey = null;

  function me(st) {
    const p = token ? Object.values(st.participants).find((x) => x.token === token) : null;
    if (!p) throw new ApiError(401, "unauthorized", "Link pessoal inválido.");
    return p;
  }
  function requireAdmin() {
    if (!adminKey) throw new ApiError(401, "unauthorized", "Chave de organizador ausente.");
  }

  return {
    mode: "mock",
    setToken(t) { token = t || null; },
    setAdminKey(k) { adminKey = k || null; },

    async getConfig() { await wait(); return publicConfig(load()); },
    async listParticipants() { await wait(); return Object.values(load().participants).map(toPublic); },

    async register(data) {
      await wait();
      const st = load();
      if (st.config.status === "drawn") throw new ApiError(409, "conflict", "O sorteio já foi feito. Fale com o organizador.");
      const now = Date.now();
      const p = { id: "p_" + rnd(10), ...clean(data), manual: false, createdAt: now, updatedAt: now, token: rnd(32) };
      st.participants[p.id] = p; save(st);
      return { participant: toFull(p), token: p.token };
    },
    async getMe() { await wait(); return toFull(me(load())); },
    async updateMe(data) {
      await wait();
      const st = load(), p = me(st);
      Object.assign(p, clean(data), { updatedAt: Date.now() }); save(st);
      return toFull(p);
    },
    async deleteMe() {
      await wait();
      const st = load(), p = me(st);
      delete st.participants[p.id]; save(st);
      return null;
    },
    async getMyAssignment() {
      await wait();
      const st = load(), p = me(st);
      if (st.config.status !== "drawn") return { receiver: null, reason: "not_drawn" };
      const rid = st.assignments[p.id];
      if (!rid || !st.drawIds.includes(p.id)) return { receiver: null, reason: "joined_after_draw" };
      const r = st.participants[rid];
      if (!r) return { receiver: null, reason: "receiver_left" };
      return { receiver: toReceiver(r), reason: null };
    },
    async getIdeas() { throw new ApiError(404, "not_found", "Ideias com IA precisam do backend."); },

    admin: {
      async check() { await wait(); requireAdmin(); return { ok: true }; },
      async updateConfig(patch) {
        await wait(); requireAdmin();
        const st = load();
        st.config = {
          ...st.config,
          title: s(patch.title, 50) || DEFAULT_CONFIG.title,
          drawDate: s(patch.drawDate, 10),
          exchangeDate: s(patch.exchangeDate, 10),
          budget: patch.budget == null || patch.budget === "" ? null : Math.max(0, Math.round(Number(patch.budget)) || 0),
        };
        save(st);
        return publicConfig(st);
      },
      async listParticipants() {
        await wait(); requireAdmin();
        const st = load();
        return Object.values(st.participants).map((p) => ({ ...toFull(p), complete: complete(p), inDraw: st.drawIds.includes(p.id) }));
      },
      async createParticipant(data) {
        await wait(); requireAdmin();
        const st = load(), now = Date.now();
        const p = { id: "p_" + rnd(10), ...clean(data), manual: true, createdAt: now, updatedAt: now, token: rnd(32) };
        st.participants[p.id] = p; save(st);
        return { participant: toFull(p), token: p.token };
      },
      async updateParticipant(id, data) {
        await wait(); requireAdmin();
        const st = load(), p = st.participants[id];
        if (!p) throw new ApiError(404, "not_found", "Pessoa não encontrada.");
        Object.assign(p, clean(data), { updatedAt: Date.now() }); save(st);
        return toFull(p);
      },
      async deleteParticipant(id) {
        await wait(); requireAdmin();
        const st = load(); delete st.participants[id]; save(st);
        return null;
      },
      async resetLink(id) {
        await wait(); requireAdmin();
        const st = load(), p = st.participants[id];
        if (!p) throw new ApiError(404, "not_found", "Pessoa não encontrada.");
        p.token = rnd(32); save(st);
        return { token: p.token };
      },
      async draw() {
        await wait(400); requireAdmin();
        const st = load(), ids = Object.keys(st.participants);
        if (ids.length < 3) throw new ApiError(409, "conflict", "O sorteio precisa de pelo menos 3 pessoas.");
        st.assignments = drawPairs(ids);
        st.drawIds = ids;
        st.config.status = "drawn";
        st.config.drawnAt = Date.now();
        save(st);
        return publicConfig(st);
      },
      async reopen() {
        await wait(); requireAdmin();
        const st = load();
        st.config.status = "open"; st.config.drawnAt = null;
        st.assignments = {}; st.drawIds = [];
        save(st);
        return publicConfig(st);
      },
      // Só existe no modo demonstração.
      async seedDemo() {
        await wait(); requireAdmin();
        const st = load(), now = Date.now();
        const sample = [
          { name: "Dona Célia", shoe: "37", pants: "44", shirt: "M", likes: "Plantas, café coado e crochê", wishlist: "Vaso de cerâmica\nPantufa quentinha", avoid: "perfume" },
          { name: "Seu Antônio", shoe: "41", pants: "46", shirt: "GG", likes: "Futebol, churrasco e viola caipira" },
          { name: "Marina", shoe: "36", pants: "38", shirt: "P", likes: "Livros de suspense e skincare", wishlist: "Livro novo da Agatha Christie" },
          { name: "Tio Beto", shoe: "42", pants: "44", shirt: "G", likes: "Cerveja artesanal e filmes de ação" },
        ];
        for (const d of sample) {
          const p = { id: "p_" + rnd(10), ...clean(d), manual: true, createdAt: now, updatedAt: now, token: rnd(32) };
          st.participants[p.id] = p;
        }
        save(st);
        return null;
      },
      async resetDemo() { localStorage.removeItem(KEY); return null; },
    },
  };
}
