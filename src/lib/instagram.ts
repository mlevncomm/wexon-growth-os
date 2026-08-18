import { prisma } from "./prisma";
import { generateLlmReply } from "./llm";
import { getPlaybook } from "./playbook";
import { getSettings } from "./settings";

const GRAPH = "https://graph.facebook.com/v21.0";

export async function igConfigured(): Promise<boolean> {
  const s = await getSettings();
  return Boolean(s.igAccessToken && s.igUserId);
}

type GraphError = { error?: { message?: string } };

async function graph<T>(path: string, init?: RequestInit): Promise<T> {
  const settings = await getSettings();
  if (!settings.igAccessToken || !settings.igUserId) {
    throw new Error("Instagram token veya kullanıcı ID eksik");
  }
  const url = path.startsWith("http") ? path : `${GRAPH}/${path.replace(/^\//, "")}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${settings.igAccessToken}`,
    ...(init?.headers as Record<string, string> | undefined),
  };
  const res = await fetch(url, { ...init, headers });
  const json = (await res.json()) as T & GraphError;
  if (!res.ok) {
    throw new Error(json.error?.message || `Instagram API ${res.status}`);
  }
  return json;
}

type GraphParticipant = { id?: string; username?: string; name?: string };
type GraphMessage = {
  id?: string;
  message?: string;
  created_time?: string;
  from?: GraphParticipant;
};
type GraphConversation = {
  id?: string;
  updated_time?: string;
  participants?: { data?: GraphParticipant[] };
  messages?: { data?: GraphMessage[] };
};

export async function sendIgMessage(igsid: string, text: string): Promise<void> {
  const settings = await getSettings();
  await graph(`${settings.igUserId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: igsid },
      message: { text },
    }),
  });
}

export async function upsertInbound(opts: {
  igsid: string;
  username?: string;
  text: string;
  at?: Date;
}): Promise<{ id: string; draft: string }> {
  const id = opts.igsid;
  const at = opts.at ?? new Date();
  const thread = await prisma.igThread.upsert({
    where: { id },
    update: {
      igsid: opts.igsid,
      username: opts.username ?? undefined,
      lastText: opts.text.slice(0, 500),
      lastAt: at,
    },
    create: {
      id,
      igsid: opts.igsid,
      username: opts.username ?? "",
      lastText: opts.text.slice(0, 500),
      lastAt: at,
    },
  });
  await prisma.igMessage.create({
    data: { threadId: thread.id, direction: "in", body: opts.text.slice(0, 2000), createdAt: at },
  });

  let draft = thread.draft;
  const settings = await getSettings();
  if (settings.llmApiKey) {
    try {
      draft = await generateLlmReply({
        apiKey: settings.llmApiKey,
        baseUrl: settings.llmBaseUrl,
        model: settings.llmModel,
        inbound: opts.text,
        username: opts.username || thread.username,
        playbook: await getPlaybook(),
      });
      await prisma.igThread.update({ where: { id: thread.id }, data: { draft } });
    } catch {
      /* keep previous draft */
    }
  }
  return { id: thread.id, draft };
}

export async function refreshIgInbox(): Promise<{ threads: Awaited<ReturnType<typeof listLocalThreads>>; warning?: string }> {
  const settings = await getSettings();
  if (!settings.igAccessToken || !settings.igUserId) {
    return { threads: await listLocalThreads(), warning: "Instagram token yok" };
  }
  try {
    const json = await graph<{ data?: GraphConversation[] }>(
      `${settings.igUserId}/conversations?platform=instagram&fields=id,updated_time,participants{id,username,name},messages.limit(8){id,from,message,created_time}`,
    );
    for (const conv of json.data ?? []) {
      const others = (conv.participants?.data ?? []).filter((p) => p.id && p.id !== settings.igUserId);
      const peer = others[0];
      const igsid = peer?.id || conv.id;
      if (!igsid) continue;
      const inbound = (conv.messages?.data ?? []).find((m) => m.from?.id && m.from.id !== settings.igUserId);
      const last = inbound ?? conv.messages?.data?.[0];
      const text = last?.message?.trim() || "";
      const at = last?.created_time ? new Date(last.created_time) : conv.updated_time ? new Date(conv.updated_time) : new Date();
      await prisma.igThread.upsert({
        where: { id: igsid },
        update: {
          igsid,
          username: peer?.username || peer?.name || undefined,
          lastText: text.slice(0, 500),
          lastAt: at,
        },
        create: {
          id: igsid,
          igsid,
          username: peer?.username || peer?.name || "",
          lastText: text.slice(0, 500),
          lastAt: at,
        },
      });
      if (text) {
        const exists = await prisma.igMessage.findFirst({
          where: { threadId: igsid, body: text, direction: "in" },
        });
        if (!exists) {
          await prisma.igMessage.create({
            data: { threadId: igsid, direction: "in", body: text.slice(0, 2000), createdAt: at },
          });
        }
      }
    }
    return { threads: await listLocalThreads() };
  } catch (err) {
    const warning = err instanceof Error ? err.message : "Instagram okunamadı";
    return { threads: await listLocalThreads(), warning };
  }
}

export async function listLocalThreads() {
  const rows = await prisma.igThread.findMany({
    orderBy: [{ lastAt: "desc" }, { updatedAt: "desc" }],
    take: 40,
    include: { messages: { orderBy: { createdAt: "desc" }, take: 12 } },
  });
  return rows.map((t) => ({
    id: t.id,
    igsid: t.igsid || t.id,
    username: t.username,
    lastText: t.lastText,
    lastAt: t.lastAt,
    draft: t.draft,
    messages: t.messages
      .slice()
      .reverse()
      .map((m) => ({ id: m.id, direction: m.direction, body: m.body, createdAt: m.createdAt })),
  }));
}

export async function saveDraft(threadId: string, draft: string) {
  await prisma.igThread.update({
    where: { id: threadId },
    data: { draft: draft.slice(0, 2000) },
  });
}

export async function approveAndSend(threadId: string, text: string) {
  const thread = await prisma.igThread.findUnique({ where: { id: threadId } });
  if (!thread) throw new Error("Konuşma bulunamadı");
  const igsid = thread.igsid || thread.id;
  const body = text.trim();
  if (!body) throw new Error("Mesaj boş");
  await sendIgMessage(igsid, body);
  await prisma.igMessage.create({
    data: { threadId: thread.id, direction: "out", body: body.slice(0, 2000) },
  });
  await prisma.igThread.update({
    where: { id: thread.id },
    data: { lastText: body.slice(0, 500), lastAt: new Date(), draft: "" },
  });
}

export async function draftForThread(threadId: string, inbound?: string): Promise<string> {
  const thread = await prisma.igThread.findUnique({
    where: { id: threadId },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!thread) throw new Error("Konuşma bulunamadı");
  const settings = await getSettings();
  if (!settings.llmApiKey) throw new Error("AI anahtarı yok");
  const lastIn = inbound || thread.messages.find((m) => m.direction === "in")?.body || thread.lastText;
  if (!lastIn) throw new Error("Gelen mesaj yok");
  const draft = await generateLlmReply({
    apiKey: settings.llmApiKey,
    baseUrl: settings.llmBaseUrl,
    model: settings.llmModel,
    inbound: lastIn,
    username: thread.username,
    playbook: await getPlaybook(),
  });
  await prisma.igThread.update({ where: { id: thread.id }, data: { draft } });
  return draft;
}
