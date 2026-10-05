/**
 * Database-driven email template loader.
 *
 * Templates are stored in `email_templates` table with {{variable}} placeholders.
 * This module provides:
 *   - loadTemplate(id): reads from DB with 60s in-memory cache
 *   - renderTemplate(html, vars): replaces {{var}} with values
 *   - loadAndRender(id, vars): combines both
 *
 * If DB is unavailable or template is missing, returns null (caller uses hardcoded fallback).
 */

import { createClient } from "@supabase/supabase-js";

export type EmailTemplate = {
  id: string;
  subject: string;
  body_html: string;
  variables: string[];
  updated_at: string;
};

// In-memory cache: { template, fetchedAt }
const cache = new Map<string, { template: EmailTemplate; fetchedAt: number }>();
const CACHE_TTL_MS = 60_000; // 60 seconds

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
}

/**
 * Load a template from DB. Returns null if not found or on error.
 * Results are cached for 60s to avoid hitting DB on every email send.
 */
export async function loadTemplate(id: string): Promise<EmailTemplate | null> {
  const cached = cache.get(id);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.template;
  }

  try {
    const { data, error } = await svc()
      .from("email_templates")
      .select("id, subject, body_html, variables, updated_at")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) return null;

    const template = data as EmailTemplate;
    cache.set(id, { template, fetchedAt: Date.now() });
    return template;
  } catch {
    return null;
  }
}

/**
 * Load all templates from DB.
 */
export async function loadAllTemplates(): Promise<EmailTemplate[]> {
  try {
    const { data, error } = await svc()
      .from("email_templates")
      .select("id, subject, body_html, variables, updated_at")
      .order("id");

    if (error || !data) return [];
    return data as EmailTemplate[];
  } catch {
    return [];
  }
}

/**
 * Replace {{variable}} placeholders in a string.
 * Unmatched placeholders are left as-is (visible in preview as reminder to fix).
 */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return vars[key] ?? match;
  });
}

/**
 * Load template from DB and render with variables.
 * Returns { subject, html } or null if template not found in DB.
 */
export async function loadAndRender(
  id: string,
  vars: Record<string, string>,
): Promise<{ subject: string; html: string } | null> {
  const tpl = await loadTemplate(id);
  if (!tpl) return null;

  return {
    subject: renderTemplate(tpl.subject, vars),
    html: renderTemplate(tpl.body_html, vars),
  };
}

/**
 * Invalidate cache for a specific template (after admin edit).
 */
export function invalidateCache(id?: string): void {
  if (id) {
    cache.delete(id);
  } else {
    cache.clear();
  }
}
