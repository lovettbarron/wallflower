import { create } from "zustand";
import type { BookmarkRecord, CreateBookmarkInput, UpdateBookmarkInput, BookmarkColor } from "@/lib/types";
import { createBookmark, getBookmarks, updateBookmark, deleteBookmark } from "@/lib/tauri";

const COLOR_ORDER: BookmarkColor[] = ["coral", "amber", "lime", "teal", "sky", "violet", "rose", "slate"];

interface BookmarkState {
  bookmarks: BookmarkRecord[];
  selectedBookmarkId: string | null;
  loading: boolean;

  // Actions
  loadBookmarks: (jamId: string) => Promise<void>;
  addBookmark: (input: CreateBookmarkInput) => Promise<BookmarkRecord>;
  editBookmark: (id: string, input: UpdateBookmarkInput) => Promise<void>;
  removeBookmark: (id: string) => Promise<void>;
  selectBookmark: (id: string | null) => void;
  getNextColor: () => BookmarkColor;
  getNextName: () => string;
  clear: () => void;
}

export const useBookmarkStore = create<BookmarkState>((set, get) => ({
  bookmarks: [],
  selectedBookmarkId: null,
  loading: false,

  loadBookmarks: async (jamId: string) => {
    set({ loading: true });
    try {
      const bookmarks = await getBookmarks(jamId);
      set({ bookmarks, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  addBookmark: async (input: CreateBookmarkInput) => {
    const result = await createBookmark(input);
    set((s) => ({ bookmarks: [...s.bookmarks, result] }));
    return result;
  },

  editBookmark: async (id: string, input: UpdateBookmarkInput) => {
    const result = await updateBookmark(id, input);
    set((s) => ({
      bookmarks: s.bookmarks.map((b) => (b.id === id ? result : b)),
    }));
  },

  removeBookmark: async (id: string) => {
    await deleteBookmark(id);
    set((s) => ({
      bookmarks: s.bookmarks.filter((b) => b.id !== id),
      selectedBookmarkId: s.selectedBookmarkId === id ? null : s.selectedBookmarkId,
    }));
  },

  selectBookmark: (id: string | null) => set({ selectedBookmarkId: id }),

  getNextColor: () => {
    const used = new Set(get().bookmarks.map((b) => b.color));
    return COLOR_ORDER.find((c) => !used.has(c)) ?? COLOR_ORDER[get().bookmarks.length % COLOR_ORDER.length];
  },

  getNextName: () => {
    const count = get().bookmarks.length;
    return `Bookmark ${count + 1}`;
  },

  clear: () => set({ bookmarks: [], selectedBookmarkId: null, loading: false }),
}));
