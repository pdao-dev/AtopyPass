import type { AiOutput } from "@/types";

const LLM_API_KEY = process.env.LLM_API_KEY ?? "";
const LLM_MODEL = process.env.LLM_MODEL ?? "gpt-4o-mini";

const SYSTEM_PROMPT = `You are a medical record structuring assistant for atopic dermatitis (eczema).
Given a patient's free-text log, return ONLY a JSON object with these keys:
- summary_ko (string): Korean summary of the entry
- itch_score (number|null): subjective itch severity 0-10 if mentioned, else null
- triggers (string[]): potential triggers mentioned
- products (string[]): any skincare/medical products mentioned
- environment (string[]): environmental factors mentioned
- doctor_questions_ko (string[]): exactly 3 follow-up questions a doctor might ask, in Korean

Return ONLY valid JSON. No markdown, no explanation.`;

/**
 * Call LLM to structure a raw text entry.
 * Returns null if the call fails for any reason.
 */
export async function structureEntry(rawText: string): Promise<AiOutput | null> {
  if (!LLM_API_KEY) {
    console.warn("[llm] LLM_API_KEY not set, skipping AI structuring");
    return null;
  }

  try {
    // TODO: Replace with your preferred LLM provider's API
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: rawText },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      console.error("[llm] API error:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed: AiOutput = JSON.parse(content);
    return parsed;
  } catch (err) {
    console.error("[llm] Failed to structure entry:", err);
    return null;
  }
}
