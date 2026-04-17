import { VertexAI, type GenerativeModel } from '@google-cloud/vertexai';

let cachedModel: GenerativeModel | null = null;

export function getGeminiModel(): GenerativeModel {
  if (cachedModel) return cachedModel;
  const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) throw new Error('Cannot determine GCP project ID');
  const region = process.env.GEMINI_REGION || 'us-central1';
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const vertexAI = new VertexAI({ project: projectId, location: region });
  cachedModel = vertexAI.getGenerativeModel({ model: modelName });
  return cachedModel;
}
