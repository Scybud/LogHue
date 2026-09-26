import { createClient } from "https://esm.sh/@supabase/supabase-js@2.111.0";

const SUPABASE_URL = "https://qqactsebaxdottiiyrng.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_fWWIiWF4l_q-eNHU-Rs5qQ_zlaMggjo";


const COOKIE_DOMAIN = ".loghue.com";
const CHUNK_SIZE = 3500;

function getCookie(name) {
  const match = document.cookie.match(
    new RegExp(
      "(?:^|; )" + name.replace(/[.$?*|{}()[\]\\/+^]/g, "\\$&") + "=([^;]*)",
    ),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name, value) {
  const maxAge = 60 * 60 * 24 * 365; // 1 year
  document.cookie = `${name}=${encodeURIComponent(value)}; Domain=${COOKIE_DOMAIN}; Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure`;
}

function deleteCookie(name) {
  document.cookie = `${name}=; Domain=${COOKIE_DOMAIN}; Path=/; Max-Age=0; SameSite=Lax; Secure`;
}

const cookieStorage = {
  getItem(key) {
    const chunkCount = getCookie(`${key}.chunks`);
    if (chunkCount === null) return null;

    let value = "";
    for (let i = 0; i < Number(chunkCount); i++) {
      const chunk = getCookie(`${key}.${i}`);
      if (chunk === null) return null; // a chunk went missing, treat as no session
      value += chunk;
    }
    return value;
  },

  setItem(key, value) {
    // Clear any previous chunk count first, in case the new value has fewer chunks
    this.removeItem(key);

    const chunks = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    chunks.forEach((chunk, i) => setCookie(`${key}.${i}`, chunk));
    setCookie(`${key}.chunks`, String(chunks.length));
  },

  removeItem(key) {
    const chunkCount = getCookie(`${key}.chunks`);
    if (chunkCount === null) return;

    for (let i = 0; i < Number(chunkCount); i++) {
      deleteCookie(`${key}.${i}`);
    }
    deleteCookie(`${key}.chunks`);
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: cookieStorage,
  },
});
