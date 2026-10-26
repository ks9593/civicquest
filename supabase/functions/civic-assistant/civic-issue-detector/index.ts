
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const MODEL = "gemini-2.5-flash";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const SYSTEM_INSTRUCTION = `
You are CivicQuest's visual civic-issue assistant.

Analyze the supplied image for a visible public or community issue.
Possible categories include Roads, Waste, Water & Drainage,
Street Lighting, Public Safety, Environment, Public Infrastructure,
and Other.

Return a preliminary assessment, not an official inspection.
Do not infer facts that cannot be seen. If the image is unclear,
say so and use low confidence. Do not identify people or describe
their personal characteristics.

Priority guidance:
- Low: minor, non-urgent visible issue.
- Medium: noticeable issue that likely needs attention.
- High: substantial visible issue or plausible safety concern.
- Critical: only when the image clearly suggests an immediate,
  serious danger. Do not use Critical merely because the image is
  uncertain.

Never claim that an authority has verified or received the report.
Give practical safety advice without encouraging anyone to approach
hazards. The generated report must describe only visible evidence
and should be reviewed by the user before submission.

Return JSON only, with exactly these fields:
{
  "issue": "short description",
  "category": "one category",
  "priority": "Low, Medium, High, or Critical",
  "confidence": "Low, Medium, or High",
  "reasoning": "brief explanation based on visible evidence",
  "reportDraft": "clear report draft for the user to review",
  "safetyAdvice": "brief safety advice, or an empty string"
}
`;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function safeText(value: unknown, maxLength: number): string {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

function isOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return typeof value === "string" &&
    allowed.includes(value as T);
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, _ctx) => {
    if (req.method !== "POST") {
      return jsonError("Method not allowed.", 405);
    }

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return jsonError("Request must contain valid JSON.", 400);
    }

    if (typeof body !== "object" || body === null) {
      return jsonError("Please provide an image.", 400);
    }

    const input = body as Record<string, unknown>;
    const imageBase64 = input.imageBase64;
    const mimeType = input.mimeType;

    if (
      typeof imageBase64 !== "string" ||
      typeof mimeType !== "string" ||
      !ALLOWED_TYPES.has(mimeType)
    ) {
      return jsonError(
        "Provide a JPEG, PNG, or WebP image.",
        400,
      );
    }

    // Accept either plain base64 or a data URL.
    const cleanedBase64 = imageBase64.replace(
      /^data:image\/[a-zA-Z0-9.+-]+;base64,/,
      "",
    );

    if (
      !cleanedBase64 ||
      cleanedBase64.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 8 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(cleanedBase64) ||
      cleanedBase64.length % 4 !== 0
    ) {
      return jsonError(
        "Image data is invalid or exceeds the 5 MB limit.",
        400,
      );
    }

    let imageBytes: Uint8Array;

    try {
      const binary = atob(cleanedBase64);
      imageBytes = Uint8Array.from(
        binary,
        (character) => character.charCodeAt(0),
      );
    } catch {
      return jsonError("Could not decode the image.", 400);
    }

    if (imageBytes.length === 0 || imageBytes.length > MAX_IMAGE_BYTES) {
      return jsonError(
        "Image must be smaller than or equal to 5 MB.",
        400,
      );
    }

    // Check that the file's actual signature matches the declared type.
    const isJpeg =
      imageBytes[0] === 0xff &&
      imageBytes[1] === 0xd8 &&
      imageBytes[2] === 0xff;

    const isPng =
      imageBytes[0] === 0x89 &&
      imageBytes[1] === 0x50 &&
      imageBytes[2] === 0x4e &&
      imageBytes[3] === 0x47;

    const isWebp =
      imageBytes.length >= 12 &&
      String.fromCharCode(...imageBytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...imageBytes.slice(8, 12)) === "WEBP";

    if (
      (mimeType === "image/jpeg" && !isJpeg) ||
      (mimeType === "image/png" && !isPng) ||
      (mimeType === "image/webp" && !isWebp)
    ) {
      return jsonError(
        "The image content does not match its file type.",
        400,
      );
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      console.error("GEMINI_API_KEY is not configured.");
      return jsonError("The AI service is not configured.", 503);
    }

    try {
      const aiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: SYSTEM_INSTRUCTION }],
            },
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: "Analyze this image and return the requested JSON assessment.",
                  },
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: cleanedBase64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 900,
              responseMimeType: "application/json",
            },
          }),
          signal: AbortSignal.timeout(30000),
        },
      );

      if (!aiResponse.ok) {
        console.error(
          "Gemini image request failed with status:",
          aiResponse.status,
        );

        if (aiResponse.status === 429) {
          return jsonError(
            "The AI service is busy. Please try again shortly.",
            429,
          );
        }

        return jsonError(
          "The AI service could not analyze this image.",
          502,
        );
      }

      const result = await aiResponse.json();

      const generatedText = result?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text ?? "")
        .join("")
        .trim();

      if (!generatedText) {
        return jsonError(
          "The AI returned no analysis. Please try another image.",
          502,
        );
      }

      let parsed: unknown;

      try {
        parsed = JSON.parse(generatedText);
      } catch {
        return jsonError(
          "The AI returned an unreadable assessment. Please try again.",
          502,
        );
      }

      if (typeof parsed !== "object" || parsed === null) {
        return jsonError("The AI assessment was invalid.", 502);
      }

      const value = parsed as Record<string, unknown>;

      const priorities = ["Low", "Medium", "High", "Critical"] as const;
      const confidenceLevels = ["Low", "Medium", "High"] as const;

      if (
        !safeText(value.issue, 200) ||
        !safeText(value.category, 80) ||
        !safeText(value.reportDraft, 1500) ||
        !isOneOf(value.priority, priorities) ||
        !isOneOf(value.confidence, confidenceLevels)
      ) {
        return jsonError(
          "The AI assessment was incomplete. Please try again.",
          502,
        );
      }

      const analysis = {
        issue: safeText(value.issue, 200),
        category: safeText(value.category, 80),
        priority: value.priority,
        confidence: value.confidence,
        reasoning: safeText(value.reasoning, 500),
        reportDraft: safeText(value.reportDraft, 1500),
        safetyAdvice: safeText(value.safetyAdvice, 400),
      };

      return Response.json({ analysis });
    } catch (error) {
      console.error(
        "Civic issue analysis failed:",
        error instanceof Error ? error.name : "UnknownError",
      );

      return jsonError(
        "Could not reach the AI service. Please try again.",
        502,
      );
    }
  }),
};
