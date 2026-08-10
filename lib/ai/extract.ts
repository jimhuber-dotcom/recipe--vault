/**
 * Recipe extraction from a photo using Claude's vision model. Server-only —
 * reads ANTHROPIC_API_KEY, which must never reach the browser. Uses a forced
 * tool call so the model returns a structured recipe object rather than prose.
 */

export interface ExtractedIngredient {
  section: string | null;
  quantity: number | null;
  unit: string | null;
  item: string;
  preparation: string | null;
  is_optional: boolean;
}

export interface ExtractedStep {
  section: string | null;
  instruction: string;
}

export interface ReviewFlag {
  field: string;
  reason: string;
}

export interface ExtractedRecipe {
  title: string;
  subtitle: string | null;
  description: string | null;
  cuisine: string | null;
  course: string | null;
  main_protein: string | null;
  main_type: string | null;
  cooking_method: string | null;
  yield_text: string | null;
  servings: number | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  difficulty: "easy" | "medium" | "hard" | null;
  notes: string | null;
  ingredients: ExtractedIngredient[];
  steps: ExtractedStep[];
  field_provenance: Record<string, string>;
  ai_review_flags: ReviewFlag[];
}

export interface ExtractionResult {
  recipe: ExtractedRecipe;
  model: string;
  usage: { input_tokens: number | null; output_tokens: number | null };
}

const SAVE_RECIPE_TOOL = {
  name: "save_recipe",
  description: "Save the recipe read from the image.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      subtitle: { type: "string" },
      description: { type: "string" },
      cuisine: { type: "string" },
      course: { type: "string" },
      main_protein: { type: "string" },
      main_type: { type: "string" },
      cooking_method: { type: "string" },
      yield_text: { type: "string" },
      servings: { type: "integer" },
      prep_minutes: { type: "integer" },
      cook_minutes: { type: "integer" },
      difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
      notes: { type: "string" },
      ingredients: {
        type: "array",
        items: {
          type: "object",
          properties: {
            section: { type: "string" },
            quantity: { type: "number" },
            unit: { type: "string" },
            item: { type: "string" },
            preparation: { type: "string" },
            is_optional: { type: "boolean" },
          },
          required: ["item"],
        },
      },
      steps: {
        type: "array",
        items: {
          type: "object",
          properties: {
            section: { type: "string" },
            instruction: { type: "string" },
          },
          required: ["instruction"],
        },
      },
      field_provenance: {
        type: "object",
        description:
          "Map of field name to origin: 'extracted' (read from the image), 'reconstructed' (completed from knowledge of the dish), or 'estimated' (a reasonable guess).",
        additionalProperties: {
          type: "string",
          enum: ["extracted", "reconstructed", "estimated"],
        },
      },
      ai_review_flags: {
        type: "array",
        description: "Fields a human should double-check.",
        items: {
          type: "object",
          properties: {
            field: { type: "string" },
            reason: { type: "string" },
          },
          required: ["field", "reason"],
        },
      },
    },
    required: ["title", "ingredients", "steps"],
  },
} as const;

const PROMPT =
  "Read the recipe in this image, then produce a COMPLETE, cookable version " +
  "with the save_recipe tool.\n\n" +
  "First, transcribe everything the image states — title, ingredients, steps, " +
  "and any amounts or times — exactly as written.\n\n" +
  "Then fill the gaps so someone could actually cook this dish: add sensible " +
  "ingredient quantities and units, include standard ingredients the dish needs " +
  "but the image omits (salt, oil, broth, and so on), estimate prep time, cook " +
  "time, and servings, and expand the method into clear, ordered steps. Base " +
  "these on well-known technique for this specific dish, stay consistent with " +
  "everything the image shows, and never contradict it.\n\n" +
  "In field_provenance, mark each field you set as 'extracted' (read directly " +
  "from the image), 'reconstructed' (completed from knowledge of the dish), or " +
  "'estimated' (a reasonable guess such as a time or serving count). In " +
  "ai_review_flags, list the fields most worth a human's double-check, each " +
  "with a short reason.";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function str(v: any): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function num(v: any): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = parseFloat(v);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(input: any): ExtractedRecipe {
  const rawIngredients = Array.isArray(input?.ingredients) ? input.ingredients : [];
  const rawSteps = Array.isArray(input?.steps) ? input.steps : [];
  const difficulty = str(input?.difficulty);
  return {
    title: str(input?.title) ?? "Untitled recipe",
    subtitle: str(input?.subtitle),
    description: str(input?.description),
    cuisine: str(input?.cuisine),
    course: str(input?.course),
    main_protein: str(input?.main_protein),
    main_type: str(input?.main_type),
    cooking_method: str(input?.cooking_method),
    yield_text: str(input?.yield_text),
    servings: num(input?.servings),
    prep_minutes: num(input?.prep_minutes),
    cook_minutes: num(input?.cook_minutes),
    difficulty:
      difficulty === "easy" || difficulty === "medium" || difficulty === "hard"
        ? difficulty
        : null,
    notes: str(input?.notes),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ingredients: rawIngredients
      .map((i: any) => ({
        section: str(i?.section),
        quantity: num(i?.quantity),
        unit: str(i?.unit),
        item: str(i?.item) ?? "",
        preparation: str(i?.preparation),
        is_optional: i?.is_optional === true,
      }))
      .filter((i: ExtractedIngredient) => i.item.length > 0),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    steps: rawSteps
      .map((s: any) => ({
        section: str(s?.section),
        instruction: str(s?.instruction) ?? "",
      }))
      .filter((s: ExtractedStep) => s.instruction.length > 0),
    field_provenance:
      input?.field_provenance && typeof input.field_provenance === "object"
        ? (input.field_provenance as Record<string, string>)
        : {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ai_review_flags: (Array.isArray(input?.ai_review_flags)
      ? input.ai_review_flags
      : []
    )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((f: any) => str(f?.field) && str(f?.reason))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((f: any) => ({ field: String(f.field), reason: String(f.reason) })),
  };
}

export async function extractRecipeFromImage(
  base64: string,
  mediaType: string,
): Promise<ExtractionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set for this deployment. Add it in Vercel → Settings → Environment Variables.",
    );
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-opus-5",
      max_tokens: 8000,
      // Forced tool call → structured output; thinking disabled is required with
      // a forced tool_choice and keeps latency/cost down for a single extraction.
      thinking: { type: "disabled" },
      tools: [SAVE_RECIPE_TOOL],
      tool_choice: { type: "tool", name: "save_recipe" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Claude API error ${response.status}: ${detail.slice(0, 500)}`,
    );
  }

  const data = await response.json();
  const toolBlock = (data?.content ?? []).find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (b: any) => b?.type === "tool_use" && b?.name === "save_recipe",
  );
  if (!toolBlock) {
    throw new Error("The model did not return a structured recipe.");
  }

  return {
    recipe: normalize(toolBlock.input),
    model: typeof data?.model === "string" ? data.model : "claude-opus-5",
    usage: {
      input_tokens: num(data?.usage?.input_tokens),
      output_tokens: num(data?.usage?.output_tokens),
    },
  };
}
