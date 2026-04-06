import { VertexAI } from '@google-cloud/vertexai';

let cachedProjectId: string | null = null;

async function getProjectId(): Promise<string> {
  // Explicit env var first
  if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;

  // Cloud Run metadata server
  if (!cachedProjectId) {
    try {
      const res = await fetch('http://metadata.google.internal/computeMetadata/v1/project/project-id', {
        headers: { 'Metadata-Flavor': 'Google' },
      });
      cachedProjectId = await res.text();
    } catch {
      throw new Error('Cannot determine GCP project ID');
    }
  }
  return cachedProjectId;
}

async function getGeminiModel() {
  const projectId = await getProjectId();
  const region = process.env.GOOGLE_CLOUD_REGION || 'australia-southeast1';
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  const vertexAI = new VertexAI({ project: projectId, location: region });
  return vertexAI.getGenerativeModel({ model: modelName });
}

export { getGeminiModel };
