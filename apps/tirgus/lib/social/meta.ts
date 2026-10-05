// Meta Graph API — Facebook lapas foto ieraksts + Instagram ieraksts un Stories.
//
// Env:
//   META_GRAPH_VERSION        (neobligāts, noklusējums v23.0)
//   META_FB_PAGE_ID           svaigi.lv Facebook lapas ID
//   META_FB_PAGE_TOKEN        svaigi.lv lapas ilgtermiņa (never-expiring) Page access token
//   META_IG_USER_ID           tirgus.izipizi.lv Instagram Business konta ID
//   META_IG_ACCESS_TOKEN      tās FB lapas Page token, kurai piesaistīts IG konts
//                             (ja tā pati svaigi.lv lapa — var atstāt tukšu, ņems META_FB_PAGE_TOKEN)

const GRAPH = () => `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v23.0"}`;

type GraphError = { error?: { message?: string; code?: number; error_subcode?: number } };

async function graphPost<T>(path: string, params: Record<string, string>): Promise<T> {
  const res = await fetch(`${GRAPH()}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as T & GraphError;
  if (!res.ok || json.error) {
    throw new Error(`Graph ${path}: ${json.error?.message ?? res.status}`);
  }
  return json;
}

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${GRAPH()}/${path}?${qs}`);
  const json = (await res.json().catch(() => ({}))) as T & GraphError;
  if (!res.ok || json.error) {
    throw new Error(`Graph ${path}: ${json.error?.message ?? res.status}`);
  }
  return json;
}

export function metaConfig() {
  const fbPageId = process.env.META_FB_PAGE_ID ?? "";
  const fbToken = process.env.META_FB_PAGE_TOKEN ?? "";
  const igUserId = process.env.META_IG_USER_ID ?? "";
  const igToken = process.env.META_IG_ACCESS_TOKEN || fbToken;
  return {
    fbPageId,
    fbToken,
    igUserId,
    igToken,
    fbReady: Boolean(fbPageId && fbToken),
    igReady: Boolean(igUserId && igToken),
  };
}

/** Facebook lapā publicē foto ar tekstu. Atgriež post ID. */
export async function publishFacebookPhoto(opts: {
  pageId: string;
  token: string;
  imageUrl: string;
  message: string;
}): Promise<string> {
  const r = await graphPost<{ id: string; post_id?: string }>(`${opts.pageId}/photos`, {
    url: opts.imageUrl,
    message: opts.message,
    published: "true",
    access_token: opts.token,
  });
  return r.post_id ?? r.id;
}

/** Gaida, kamēr IG konteiners ir apstrādāts (attēliem parasti uzreiz). */
async function waitForContainer(containerId: string, token: string): Promise<void> {
  for (let i = 0; i < 10; i++) {
    const s = await graphGet<{ status_code?: string; status?: string }>(containerId, {
      fields: "status_code,status",
      access_token: token,
    });
    if (s.status_code === "FINISHED") return;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") {
      throw new Error(`IG konteiners ${s.status_code}: ${s.status ?? ""}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("IG konteiners netika apstrādāts laikā");
}

async function igCreateAndPublish(
  igUserId: string,
  token: string,
  params: Record<string, string>,
): Promise<string> {
  const container = await graphPost<{ id: string }>(`${igUserId}/media`, {
    ...params,
    access_token: token,
  });
  await waitForContainer(container.id, token);
  const published = await graphPost<{ id: string }>(`${igUserId}/media_publish`, {
    creation_id: container.id,
    access_token: token,
  });
  return published.id;
}

/** Instagram feed ieraksts (JPEG, malu attiecība 4:5 … 1.91:1). */
export function publishInstagramImage(opts: {
  igUserId: string;
  token: string;
  imageUrl: string;
  caption: string;
}): Promise<string> {
  return igCreateAndPublish(opts.igUserId, opts.token, {
    image_url: opts.imageUrl,
    caption: opts.caption,
  });
}

/** Instagram Stories ar to pašu foto (API nerāda tekstu uz Stories). */
export function publishInstagramStory(opts: {
  igUserId: string;
  token: string;
  imageUrl: string;
}): Promise<string> {
  return igCreateAndPublish(opts.igUserId, opts.token, {
    image_url: opts.imageUrl,
    media_type: "STORIES",
  });
}
