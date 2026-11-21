// Cliente da API REST descrita em docs/API.md e docs/openapi.yaml.

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

function codeFor(status) {
  if (status === 400 || status === 422) return "invalid";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 413) return "too_large";
  if (status >= 500) return "server";
  return "error";
}

export function createHttpApi(baseUrl) {
  const base = baseUrl.replace(/\/+$/, "");
  let token = null;
  let adminKey = null;

  async function req(method, path, { body, auth = false, admin = false } = {}) {
    const headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (auth && token) headers.Authorization = `Bearer ${token}`;
    if (admin && adminKey) headers["X-Admin-Key"] = adminKey;
    let res;
    try {
      res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new ApiError(0, "network", "Sem conexão com o servidor.");
    }
    if (res.status === 204) return null;
    let data = null;
    try { data = await res.json(); } catch { /* corpo vazio */ }
    if (!res.ok) throw new ApiError(res.status, (data && data.code) || codeFor(res.status), data && data.message);
    return data;
  }

  return {
    mode: "http",
    setToken(t) { token = t || null; },
    setAdminKey(k) { adminKey = k || null; },

    getConfig: () => req("GET", "/config"),
    listParticipants: () => req("GET", "/participants"),
    register: (data) => req("POST", "/participants", { body: data }),
    getMe: () => req("GET", "/me", { auth: true }),
    updateMe: (data) => req("PUT", "/me", { body: data, auth: true }),
    deleteMe: () => req("DELETE", "/me", { auth: true }),
    getMyAssignment: () => req("GET", "/me/assignment", { auth: true }),
    getIdeas: () => req("POST", "/me/ideas", { auth: true }),

    admin: {
      check: () => req("GET", "/admin/check", { admin: true }),
      updateConfig: (patch) => req("PUT", "/admin/config", { body: patch, admin: true }),
      listParticipants: () => req("GET", "/admin/participants", { admin: true }),
      createParticipant: (data) => req("POST", "/admin/participants", { body: data, admin: true }),
      updateParticipant: (id, data) => req("PUT", `/admin/participants/${encodeURIComponent(id)}`, { body: data, admin: true }),
      deleteParticipant: (id) => req("DELETE", `/admin/participants/${encodeURIComponent(id)}`, { admin: true }),
      resetLink: (id) => req("POST", `/admin/participants/${encodeURIComponent(id)}/link`, { admin: true }),
      draw: () => req("POST", "/admin/draw", { admin: true }),
      reopen: () => req("POST", "/admin/reopen", { admin: true }),
    },
  };
}
