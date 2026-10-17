// Fails CI when a runtime the images are built on reaches end of life within
// EOL_WARN_DAYS (default 60), so it is moved on before security fixes stop, and
// warns once it has left active support. Versions are read from the files that
// pin them (FROM lines, go.mod, ci.yml); dates come from endoflife.date.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const API = 'https://endoflife.date/api';
const DOCKERFILES = ['Dockerfile.backend', 'Dockerfile.frontend', 'Dockerfile.sidecar'];
// Images whose tag pins no runtime tracked here; Trivy still reports their OS.
const UNTRACKED = new Set(['nginx-unprivileged', 'scratch']);
// endoflife.date only dates a Go release once it is already out of support.
const NEWER_RELEASE_NOTE = {
  go: 'Go patches only the two latest releases, so this one loses security fixes when the next ships',
};

async function getJson(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`${url} answered ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === 3) throw new Error(`${url}: ${err.cause?.code ?? err.message}`, { cause: err });
      await new Promise((resolve) => setTimeout(resolve, 5_000 * attempt));
    }
  }
}

async function main() {
  const warnDays = Number(process.env.EOL_WARN_DAYS || 60);
  if (!Number.isInteger(warnDays) || warnDays < 0) throw new Error('EOL_WARN_DAYS must be a whole number of days');

  // "product cycle" -> { product, cycle, files }
  const pins = new Map();
  const pin = (product, cycle, file) => {
    if (!cycle) throw new Error(`${file}: cannot read the ${product} version`);
    const key = `${product} ${cycle}`;
    if (!pins.has(key)) pins.set(key, { product, cycle, files: new Set() });
    pins.get(key).files.add(file);
  };

  // Debian is pinned by codename (bookworm, trixie...) inside image tags.
  const debianCycles = new Map(
    (await getJson(`${API}/debian.json`))
      .filter((r) => r.codename)
      .map((r) => [r.codename.toLowerCase(), r.cycle]),
  );

  for (const file of DOCKERFILES) {
    const stages = new Set();
    for (const [, ref, stage] of read(file).matchAll(/^\s*FROM\s+(?:--\S+\s+)*(\S+)(?:\s+AS\s+(\S+))?/gim)) {
      const isStage = stages.has(ref.toLowerCase());
      if (stage) stages.add(stage.toLowerCase());
      if (isStage) continue;
      // Split on the last colon outside the registry host, after dropping any digest.
      const [image, tag = ''] = ref.split('@')[0].split(/:(?=[^/]*$)/);
      const name = image.split('/').pop();
      if (UNTRACKED.has(name)) continue;
      const found = [];
      if (name === 'node') found.push(['nodejs', tag.match(/^(\d+)/)?.[1]]);
      if (name === 'golang') found.push(['go', tag.match(/^(\d+\.\d+)/)?.[1]]);
      for (const part of tag.split('-')) {
        if (debianCycles.has(part)) found.push(['debian', debianCycles.get(part)]);
      }
      if (!found.length) {
        throw new Error(`${file}: FROM ${ref} pins no runtime this check knows; give it an explicit version and Debian codename`);
      }
      if ((name === 'node' || name === 'golang') && !found.some(([product]) => product === 'debian')) {
        throw new Error(`${file}: FROM ${ref} hides its Debian release; use a tag such as -bookworm-slim`);
      }
      for (const [product, cycle] of found) pin(product, cycle, file);
    }
  }
  pin('go', read('packages/sidecar/go.mod').match(/^go (\d+\.\d+)/m)?.[1], 'packages/sidecar/go.mod');
  for (const [, major] of read('.github/workflows/ci.yml').matchAll(/node-version:\s*['"]?(\d+)/g)) {
    pin('nodejs', major, '.github/workflows/ci.yml');
  }

  const now = Date.now();
  let failed = false;
  for (const { product, cycle, files } of pins.values()) {
    const release = await getJson(`${API}/${product}/${cycle}.json`);
    const label = `${product} ${cycle}`;
    const where = [...files].join(', ');
    if (release.eol === false) {
      const latest = (await getJson(`${API}/${product}.json`))[0]?.cycle;
      if (latest && latest !== cycle) {
        const note = NEWER_RELEASE_NOTE[product] ? `: ${NEWER_RELEASE_NOTE[product]}` : '';
        console.log(`::warning::${label} has no end-of-life date yet but ${latest} is out${note} (${where})`);
      } else {
        console.log(`${label}: latest release, no end-of-life date announced (${where})`);
      }
      continue;
    }
    const eol = release.eol === true ? now : Date.parse(release.eol);
    if (Number.isNaN(eol)) throw new Error(`${label}: unreadable end-of-life date ${JSON.stringify(release.eol)}`);
    const days = Math.floor((eol - now) / 86_400_000);
    if (days <= warnDays) {
      failed = true;
      const when = days < 0 || release.eol === true ? 'reached end of life' : `reaches end of life on ${release.eol}, in ${days} days`;
      console.log(`::error::${label} ${when}: move ${where} to a supported release`);
    } else if (typeof release.support === 'string' && Date.parse(release.support) < now) {
      console.log(`::warning::${label} left active support on ${release.support}, security fixes until ${release.eol} (${where})`);
    } else {
      console.log(`${label}: supported until ${release.eol} (${where})`);
    }
  }
  return failed;
}

// exitCode rather than exit(): exiting with fetch sockets still open aborts Node on Windows.
main().then(
  (failed) => {
    process.exitCode = failed ? 1 : 0;
  },
  (err) => {
    console.log(`::error::${err.message}`);
    process.exitCode = 1;
  },
);
