// Speicher-Ersatz für Netlify Blobs: lokal und in Tests.
export function memoryStore() {
  const data = new Map();
  return {
    async get(key) { return data.has(key) ? JSON.parse(data.get(key)) : null; },
    async setJSON(key, value) { data.set(key, JSON.stringify(value)); return { modified: true }; },
    async delete(key) { data.delete(key); },
    async list({ prefix }) { return { blobs: [...data.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }; },
    size: () => data.size
  };
}
