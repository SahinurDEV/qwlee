// Tiny fetch helpers for the admin "control" pages. Every call sends the
// admin token; the backend enforces the admin sub-role permissions and
// writes the audit log.
import { useCallback, useEffect, useState } from "react";
import url from "../baseUrl";

export async function adminFetch(path, { method = "GET", body } = {}) {
  const res = await fetch(`${url}/v1${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(json?.message || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return json?.data?.attributes ?? json?.data ?? json;
}

export function useAdminQuery(path, { skip = false } = {}) {
  const [state, setState] = useState({ data: null, loading: !skip, error: null });
  const load = useCallback(async () => {
    if (skip || !path) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await adminFetch(path);
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState({ data: null, loading: false, error });
    }
  }, [path, skip]);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, reload: load };
}

export const qs = (obj) => {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => v !== "" && v != null && p.set(k, v));
  const s = p.toString();
  return s ? `?${s}` : "";
};
