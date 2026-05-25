import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const contentRoot = path.join(root, "content/research");
const dailyRoot = path.join(contentRoot, "daily");
const articlesRoot = path.join(contentRoot, "articles");
const digestPath = path.join(root, "src/data/researchDigest.json");
const sourcesPath = path.join(contentRoot, "sources.json");
const githubBaseUrl = "https://github.com/veritaswiki/memory-coverage-lab/blob/main/content/research";

const args = new Set(process.argv.slice(2));
const offline = args.has("--offline") || args.has("--index-only");
const today = process.env.RESEARCH_DATE ?? new Date().toISOString().slice(0, 10);

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function frontMatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) {
    return {};
  }

  return Object.fromEntries(
    match[1]
      .split("\n")
      .map((line) => line.match(/^([A-Za-z0-9_-]+):\s*"?([^"]*?)"?\s*$/))
      .filter(Boolean)
      .map((lineMatch) => [lineMatch[1], lineMatch[2]]),
  );
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeMarkdown(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\n+/g, " ");
}

async function fetchJson(url, token) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "memorybench-research-watch",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }

  return response.json();
}

function firstTagValue(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1]
    ?.replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchArxiv(query) {
  const params = new URLSearchParams({
    search_query: query.query,
    start: "0",
    max_results: "1",
    sortBy: "submittedDate",
    sortOrder: "descending",
  });
  const response = await fetch(`https://export.arxiv.org/api/query?${params}`, {
    headers: { "User-Agent": "memorybench-research-watch" },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`arXiv ${query.name} returned ${response.status}`);
  }

  const xml = await response.text();
  const entry = xml.match(/<entry>([\s\S]*?)<\/entry>/i)?.[1];
  if (!entry) {
    return null;
  }

  return {
    name: query.name,
    layer: query.layer,
    title: firstTagValue(entry, "title") ?? "Untitled arXiv result",
    updated: firstTagValue(entry, "updated")?.slice(0, 10) ?? "unknown",
    url: firstTagValue(entry, "id") ?? "https://arxiv.org/",
  };
}

async function collectSignals() {
  const sources = readJson(sourcesPath);
  const token = process.env.GITHUB_TOKEN;

  const repoSignals = await Promise.all(
    sources.githubRepos.map(async (source) => {
      const repo = await fetchJson(`https://api.github.com/repos/${source.repo}`, token);
      const releases = await fetchJson(`https://api.github.com/repos/${source.repo}/releases?per_page=1`, token).catch(
        () => [],
      );
      const latestRelease = Array.isArray(releases) ? releases[0] : null;

      return {
        type: "repo",
        name: source.name,
        layer: source.layer,
        title: repo.description || source.reason,
        url: repo.html_url,
        updated: repo.pushed_at?.slice(0, 10) ?? repo.updated_at?.slice(0, 10) ?? "unknown",
        detail: latestRelease?.tag_name
          ? `latest release ${latestRelease.tag_name}`
          : `${repo.stargazers_count ?? 0} stars / ${repo.open_issues_count ?? 0} open issues`,
      };
    }),
  );

  const arxivSignals = (
    await Promise.all(sources.arxivQueries.map((query) => fetchArxiv(query).catch(() => null)))
  ).filter(Boolean);

  return { repoSignals, arxivSignals, sources };
}

function writeDailyDigest({ repoSignals, arxivSignals, sources }) {
  mkdirSync(dailyRoot, { recursive: true });
  const slug = `${today}-ai-memory-watch`;
  const filePath = path.join(dailyRoot, `${slug}.md`);
  const signalCount = repoSignals.length + arxivSignals.length + sources.manualFeeds.length;
  const repoRows = repoSignals
    .map(
      (signal) =>
        `| ${escapeMarkdown(signal.layer)} | [${escapeMarkdown(signal.name)}](${signal.url}) | ${escapeMarkdown(signal.updated)} | ${escapeMarkdown(signal.detail)} |`,
    )
    .join("\n");
  const arxivRows = arxivSignals.length
    ? arxivSignals
        .map(
          (signal) =>
            `| ${escapeMarkdown(signal.layer)} | [${escapeMarkdown(signal.title)}](${signal.url}) | ${escapeMarkdown(signal.updated)} | ${escapeMarkdown(signal.name)} |`,
        )
        .join("\n")
    : "| Research Literature | No matching arXiv item returned | unknown | watch query needs review |";
  const manualRows = sources.manualFeeds
    .map((feed) => `| ${escapeMarkdown(feed.layer)} | [${escapeMarkdown(feed.name)}](${feed.url}) | manual review |`)
    .join("\n");

  const markdown = `---\ntitle: "AI memory watch: ${today}"\ndate: "${today}"\ncategory: "daily-watch"\nstatus: "published"\nsummary: "Daily MemoryBench watch digest for AI memory repositories, papers, and project surfaces."\nsourceCount: ${signalCount}\n---\n\n# AI memory watch: ${today}\n\nThis digest is generated by the MemoryBench research watch automation. It is a triage layer, not a benchmark verdict.\n\n## Repository Signals\n\n| Layer | Project | Updated | Signal |\n| --- | --- | --- | --- |\n${repoRows}\n\n## Literature Signals\n\n| Layer | Paper or query result | Updated | Watch query |\n| --- | --- | --- | --- |\n${arxivRows}\n\n## Manual Review Queue\n\n| Layer | Source | Mode |\n| --- | --- | --- |\n${manualRows}\n\n## Editorial Follow-up\n\n- Check whether any repository release changes the project scorecard.\n- Promote important changes into a durable article under \`content/research/articles/\`.\n- Keep marketing claims separate from benchmark evidence.\n`;

  writeFileSync(filePath, markdown);
  return filePath;
}

function markdownFiles(dir) {
  try {
    return readdirSync(dir)
      .filter((file) => file.endsWith(".md"))
      .map((file) => path.join(dir, file));
  } catch {
    return [];
  }
}

function buildIndex() {
  const files = [...markdownFiles(dailyRoot), ...markdownFiles(articlesRoot)];
  const entries = files
    .map((filePath) => {
      const markdown = readFileSync(filePath, "utf8");
      const meta = frontMatter(markdown);
      const relativePath = path.relative(root, filePath);
      const id = slugify(path.basename(filePath, ".md"));

      return {
        id,
        date: meta.date ?? "1970-01-01",
        title: meta.title ?? id,
        category: meta.category ?? "research",
        status: meta.status ?? "draft",
        summary: meta.summary ?? "",
        sourceCount: Number(meta.sourceCount ?? 0),
        githubPath: relativePath,
        githubUrl: `https://github.com/veritaswiki/memory-coverage-lab/blob/main/${relativePath}`,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));

  const digest = {
    generatedAt: new Date().toISOString(),
    sourcePath: "content/research",
    githubBaseUrl,
    entries,
  };

  writeFileSync(digestPath, `${JSON.stringify(digest, null, 2)}\n`);
  return entries.length;
}

if (!offline) {
  const signals = await collectSignals();
  writeDailyDigest(signals);
}

const count = buildIndex();
console.log(`research_digest_indexed=${count}`);
