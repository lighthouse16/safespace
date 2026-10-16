import { handleCorsPreflight, jsonResponse } from "@/lib/server/cors";
import { isGeminiConfigured } from "@/lib/server/ai/gemini-client";
import { getActiveTextModel, getActiveImageModel } from "@/lib/server/ai/model-config";

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function GET(request: Request) {
  const configured = isGeminiConfigured();
  return jsonResponse(
    {
      status: "ok",
      service: "SafeSpace Gemini Gateway",
      geminiConfigured: configured,
      models: {
        text: getActiveTextModel(),
        image: getActiveImageModel(),
      },
      timestamp: new Date().toISOString(),
    },
    200,
    request
  );
}
