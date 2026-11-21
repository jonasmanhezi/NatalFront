import { createHttpApi } from "./http.js";
import { createMockApi } from "./mock.js";

export { ApiError } from "./http.js";

/** Escolhe o backend real ou o modo demonstração, conforme js/config.js. */
export function createApi() {
  const base = String((window.APP_CONFIG && window.APP_CONFIG.apiBaseUrl) || "").trim();
  return base ? createHttpApi(base) : createMockApi();
}
