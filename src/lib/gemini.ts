import { GoogleGenerativeAI } from '@google/generative-ai';
import { VertexAI } from '@google-cloud/vertexai';

function getGeminiModel() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  const region = process.env.GOOGLE_CLOUD_REGION || 'australia-southeast1';
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  // On Cloud Run, use Vertex AI with Application Default Credentials
  if (projectId) {
    const vertexAI = new VertexAI({ project: projectId, location: region });
    return vertexAI.getGenerativeModel({ model: modelName });
  }

  // Local dev fallback: use API key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY or GOOGLE_CLOUD_PROJECT must be set');
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: modelName });
}

export { getGeminiModel };
