const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const ACCESS_FILE = path.join(ROOT_DIR, 'access.json');

app.use(express.json({ limit: '1mb' }));

// Serve static frontend files from the project root
app.use(express.static(ROOT_DIR));

// Persist the entire access array to access.json
app.post('/api/access', (req, res) => {
  const incoming = req.body;
  if (!Array.isArray(incoming)) {
    return res.status(400).json({ error: 'Body must be an array of access items' });
  }

  // Minimal validation of items to avoid writing garbage
  const isValid = incoming.every(item =>
    item &&
    Number.isInteger(item.user_id) &&
    Number.isInteger(item.project_id) &&
    typeof item.read_access === 'boolean' &&
    typeof item.write_access === 'boolean'
  );
  if (!isValid) {
    return res.status(400).json({ error: 'Invalid access item(s) in payload' });
  }

  fs.writeFile(ACCESS_FILE, JSON.stringify(incoming, null, 2), 'utf8', (err) => {
    if (err) {
      console.error('Failed to write access.json:', err);
      return res.status(500).json({ error: 'Failed to write access.json' });
    }
    return res.json({ ok: true });
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});


