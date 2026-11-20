/* 药理闯关 · 本地存储（localStorage，键名统一加 pg_ 前缀） */
import { PG, reg } from "./registry.js";

reg({ LS: () => LS });

export const LS = {
  get(k, d) { try { const v = localStorage.getItem("pg_" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("pg_" + k, JSON.stringify(v)); } catch (e) { } }
};
