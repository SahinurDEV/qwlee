"use client";
// LocalStorage-backed "recently viewed gigs" tracker.
//
//   const { items, record, clear } = useRecentlyViewed();
//   record(gig);  // call from a gig detail page; adds {id, title, image, price}
//
// Stores the minimum snapshot needed to render a card — survives backend
// edits/deletes (and keeps cards fast on first paint). Cap at 50 items (home shows the first few, /history all).
// SSR-safe: starts empty, hydrates from localStorage in useEffect.

import { useCallback, useEffect, useState } from "react";

const KEY = "qwlee:gigs:recent";
const LIMIT = 50;

function readAll() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, LIMIT) : [];
  } catch {
    return [];
  }
}

function writeAll(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, LIMIT)));
  } catch {
    /* storage quota / disabled — silent ok */
  }
}

function shape(gig) {
  if (!gig) return null;
  const id = gig._id || gig.id;
  if (!id) return null;
  return {
    id: String(id),
    title: gig.title || "",
    image: Array.isArray(gig.images) ? gig.images[0] : gig.image || "",
    price: typeof gig.price === "number" ? gig.price : Number(gig.price) || 0,
    sellerName: gig.userId?.fullName || gig.seller?.fullName || "",
    sellerUsername: gig.userId?.username || gig.seller?.username || "",
    slug: gig.slug || "",
    viewedAt: Date.now(),
  };
}

export default function useRecentlyViewed() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    setItems(readAll());
  }, []);

  const record = useCallback((gig) => {
    const snap = shape(gig);
    if (!snap) return;
    const next = [snap, ...readAll().filter((x) => x.id !== snap.id)].slice(
      0,
      LIMIT
    );
    writeAll(next);
    setItems(next);
  }, []);

  const remove = useCallback((id) => {
    const next = readAll().filter((x) => x.id !== String(id));
    writeAll(next);
    setItems(next);
  }, []);

  const clear = useCallback(() => {
    writeAll([]);
    setItems([]);
  }, []);

  return { items, record, remove, clear };
}
