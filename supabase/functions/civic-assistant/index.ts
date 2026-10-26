
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const MODEL = "gemini-3.5-flash-lite";
const MAX_MESSAGE_LENGTH = 1500;

const SYSTEM_INSTRUCTION = `
You are CivicQuest Civic Assistant, a helpful and respectful guide
for community participation.

Help people understand civic problems, identify constructive
community actions, and use civic engagement platforms responsibly.

Be practical, concise, and non-partisan.
Never claim that an issue has been officially reported or resolved
unless the user provides reliable evidence.
Do not claim to represent a government agency.
Do not invent local laws, emergency contacts, or official services.
For urgent danger, advise the user to contact appropriate local
emergency services or a trusted responsible person.
Do not ask users to provide passwords, API keys, or unnecessary
personal information.
You cannot approve contributions, change roles, award rewards,
or modify CivicQuest records.
If unsure, say so clearly.
`;

export default {
  fetch: withSupabase({ auth: "user" }, async (req, _ctx) => {
    if (req.method !== "POST") {
      return Response.json(
        { error: "Method not allowed." },
        { status: 405 },
      );
    }

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return Response.json(
        { error: "Request must contain valid JSON." },
        { status: 400 },
      );
    }

    if (
      typeof body !== "object" ||
      body === null ||
      !("message" in body) ||
      typeof body.message !== "string"
    ) {
      return Response.json(
        { error: "Please provide a message." },
        { status: 400 },
      );
    }

    const message = body.message.trim();

    if (!message) {
      return Response.json(
        { error: "Please enter a message." },
        { status: 400 },
      );
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return Response.json(
        { error: `Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer.` },
        { status: 400 },
      );
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      console.error("GEMINI_API_KEY is not configured.");

      return Response.json(
        { error: "The AI assistant is not configured yet." },
        { status: 503 },
      );
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
                parts: [{ text: message }],
              },
            ],
            generationConfig: {
              temperature: 0.5,
              maxOutputTokens: 500,
            },
          }),
          signal: AbortSignal.timeout(20000),
        },
      );

      if (!aiResponse.ok) {
        console.error("Gemini request failed with status:", aiResponse.status);

        if (aiResponse.status === 429) {
          return Response.json(
            { error: "The assistant is busy. Please try again later." },
            { status: 429 },
          );
        }

        return Response.json(
          { error: "The AI service could not answer right now." },
          { status: 502 },
        );
      }

      const result = await aiResponse.json();

      const answer = result?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text ?? "")
        .join("")
        .trim();

      if (!answer) {
        return Response.json(
          { error: "The assistant returned an empty answer. Please try again." },
          { status: 502 },
        );
      }

      return Response.json({ answer });
    } catch (error) {
      console.error(
        "Civic assistant request failed:",
        error instanceof Error ? error.name : "UnknownError",
      );

      return Response.json(
        { error: "Could not reach the AI service. Please try again." },
        { status: 502 },
      );
    }
  }),
};
