/**
 * Prompt optimization service (backs the Rack / Mixer "Generate Prompt" action).
 */
import { API_URL } from './api';

export interface OptimizeResponse {
  text: string;
  error?: string;
}

export const optimizePrompt = async (
  promptFragments: string,
): Promise<OptimizeResponse> => {
  try {
    const res = await fetch(`${API_URL}/api/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: promptFragments }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.error || 'Failed to optimize prompt');
    }

    const data = await res.json();
    return { text: data.text };
  } catch (error: any) {
    console.error('Optimization Error:', error);
    return {
      text: '',
      error: error?.message || 'Failed to generate optimized prompt.',
    };
  }
};
