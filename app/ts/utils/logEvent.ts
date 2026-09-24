import { supabase } from "../../js/supabase.js";

/**
 * Logs a product event. Fire and forget: never throws, never blocks the UI.
 * @param {string} eventName - e.g. 'search_query', 'command_palette_open'
 * @param {object} [metadata] - small JSON-serializable payload, no PII beyond what's already in the DB
 */
export async function logEvent(eventName: string, metadata: object = {}) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("events").insert({
      user_id: user.id,
      event_name: eventName,
      metadata,
    });

    if (error) {
      console.error("logEvent failed:", eventName, error.message);
    }
  } catch (err) {
    // never let analytics break the app
    console.error("logEvent threw:", eventName, err);
  }
}
