const express = require('express');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;

// === JSON file paths ===
const ACCESS_FILE   = path.join(ROOT_DIR, 'access.json');
const USERS_FILE    = path.join(ROOT_DIR, 'users.json');
const PROJECTS_FILE = path.join(ROOT_DIR, 'projects.json');

app.use(express.json({ limit: '1mb' }));

// Serve static frontend files from the project root
app.use(express.static(ROOT_DIR));

// Serve the main HTML at root
app.get('/', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'add_app2.html'));
});

// ---------- Utilities ----------
async function loadJsonArray(filePath) {
  try {
    const raw = await fsp.readFile(filePath, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    if (err.code === 'ENOENT') return []; // file missing -> empty list
    console.error(`Failed to read ${path.basename(filePath)}:`, err);
    throw err;
  }
}

async function atomicWrite(filePath, data) {
  const dir = path.dirname(filePath);
  const tmp = path.join(dir, `.tmp-${path.basename(filePath)}-${Date.now()}`);
  await fsp.writeFile(tmp, data, 'utf8');
  await fsp.rename(tmp, filePath);
}

function isValidAccessItem(item) {
  return (
    item &&
    Number.isInteger(item.user_id) &&
    Number.isInteger(item.project_id) &&
    typeof item.read_access === 'boolean' &&
    typeof item.write_access === 'boolean'
  );
}

// ---------- READ APIs ----------
app.get('/api/access', async (req, res) => {
  try {
    const existing = await loadJsonArray(ACCESS_FILE);
    res.json(existing);
  } catch {
    res.status(500).json({ error: 'Failed to read access.json' });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await loadJsonArray(USERS_FILE);
    res.json(users);
  } catch {
    res.status(500).json({ error: 'Failed to read users.json' });
  }
});

app.get('/api/projects', async (req, res) => {
  try {
    const projects = await loadJsonArray(PROJECTS_FILE);
    res.json(projects);
  } catch {
    res.status(500).json({ error: 'Failed to read projects.json' });
  }
});

// ---------- WRITE API for access (merge/replace) ----------
/**
 * POST /api/access
 * Merge semantics (PATCH-like): updates or inserts items by (user_id, project_id).
 * Add ?mode=replace to fully replace the file.
 */
app.post('/api/access', async (req, res) => {
  const incoming = req.body;
  const mode = (req.query.mode || '').toLowerCase(); // 'replace' or default 'merge'

  if (!Array.isArray(incoming)) {
    return res.status(400).json({ error: 'Body must be an array of access items' });
  }
  if (!incoming.every(isValidAccessItem)) {
    return res.status(400).json({ error: 'Invalid access item(s) in payload' });
  }

  try {
    let result;

    if (mode === 'replace') {
      result = incoming;
    } else {
      const existing = await loadJsonArray(ACCESS_FILE);
      const byKey = new Map(existing.map(it => [`${it.user_id}:${it.project_id}`, it]));
      for (const it of incoming) {
        const key = `${it.user_id}:${it.project_id}`;
        byKey.set(key, { ...byKey.get(key), ...it });
      }
      result = Array.from(byKey.values());
    }

    result.sort((a, b) => a.user_id - b.user_id || a.project_id - b.project_id);

    await atomicWrite(ACCESS_FILE, JSON.stringify(result, null, 2));
    return res.json({ ok: true, count: result.length });
  } catch (err) {
    console.error('Failed to write access.json:', err);
    return res.status(500).json({ error: 'Failed to write access.json' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
