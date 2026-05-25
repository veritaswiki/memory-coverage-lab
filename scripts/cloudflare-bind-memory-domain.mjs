const token = process.env.CLOUDFLARE_API_TOKEN;
const zoneName = process.env.CLOUDFLARE_ZONE_NAME ?? "veritas.wiki";
const recordName = process.env.CLOUDFLARE_RECORD_NAME ?? "memory.veritas.wiki";
const target = process.env.CLOUDFLARE_RECORD_TARGET ?? "veritaswiki.github.io";

if (!token) {
  console.error("CLOUDFLARE_API_TOKEN is required. Use a token with Zone:Read and DNS:Edit for veritas.wiki.");
  process.exit(2);
}

const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

async function cloudflare(path, init = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => null);

  if (!response.ok || body?.success === false) {
    const messages = Array.isArray(body?.errors)
      ? body.errors.map((error) => error.message).join("; ")
      : response.statusText;
    throw new Error(`${init.method ?? "GET"} ${path} failed: ${messages}`);
  }

  return body;
}

const zones = await cloudflare(`/zones?name=${encodeURIComponent(zoneName)}`);
const zone = zones.result?.[0];
if (!zone?.id) {
  throw new Error(`Cloudflare zone not found: ${zoneName}`);
}

const existing = await cloudflare(
  `/zones/${zone.id}/dns_records?name=${encodeURIComponent(recordName)}`,
);

for (const record of existing.result ?? []) {
  if (record.type === "A" || record.type === "AAAA" || record.type === "CNAME") {
    await cloudflare(`/zones/${zone.id}/dns_records/${record.id}`, { method: "DELETE" });
    console.log(`deleted ${record.type} ${record.name} -> ${record.content}`);
  }
}

const created = await cloudflare(`/zones/${zone.id}/dns_records`, {
  method: "POST",
  body: JSON.stringify({
    type: "CNAME",
    name: recordName,
    content: target,
    ttl: 1,
    proxied: false,
    comment: "MemoryBench GitHub Pages custom domain",
  }),
});

console.log(
  JSON.stringify(
    {
      zone: zone.name,
      record: {
        id: created.result.id,
        type: created.result.type,
        name: created.result.name,
        content: created.result.content,
        proxied: created.result.proxied,
      },
    },
    null,
    2,
  ),
);
