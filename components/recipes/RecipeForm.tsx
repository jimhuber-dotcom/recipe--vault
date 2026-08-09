"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRecipe, updateRecipe } from "@/app/(app)/recipes/actions";
import { completeImport } from "@/app/(app)/import/actions";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  RECIPE_STATUSES,
  RECIPE_STATUS_LABELS,
  type Difficulty,
  type RecipeStatus,
  type Tag,
  type Collection,
  type RecipeFormInput,
} from "@/lib/types";

interface IngredientRow {
  key: string;
  section: string;
  quantity: string;
  unit: string;
  item: string;
  preparation: string;
  is_optional: boolean;
}

interface StepRow {
  key: string;
  section: string;
  instruction: string;
}

export interface RecipeFormInitial {
  title: string;
  subtitle: string;
  description: string;
  cuisine: string;
  cooking_method: string;
  course: string;
  main_type: string;
  main_protein: string;
  yield_text: string;
  notes: string;
  servings: string;
  prep_minutes: string;
  cook_minutes: string;
  difficulty: Difficulty | "";
  recipe_status: RecipeStatus;
  is_favorite: boolean;
  ingredients: Omit<IngredientRow, "key">[];
  steps: Omit<StepRow, "key">[];
  tagIds: string[];
  collectionIds: string[];
}

let keyCounter = 0;
const nextKey = () => `row-${keyCounter++}`;

function orNull(s: string): string | null {
  const t = s.trim();
  return t.length > 0 ? t : null;
}
function toIntOrNull(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = parseInt(t, 10);
  return Number.isNaN(n) ? null : n;
}
function toNumOrNull(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = parseFloat(t);
  return Number.isNaN(n) ? null : n;
}

const emptyInitial: RecipeFormInitial = {
  title: "",
  subtitle: "",
  description: "",
  cuisine: "",
  cooking_method: "",
  course: "",
  main_type: "",
  main_protein: "",
  yield_text: "",
  notes: "",
  servings: "",
  prep_minutes: "",
  cook_minutes: "",
  difficulty: "",
  recipe_status: "needs_review",
  is_favorite: false,
  ingredients: [],
  steps: [],
  tagIds: [],
  collectionIds: [],
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-sm font-medium text-foreground">
      {children}
    </span>
  );
}

export function RecipeForm({
  mode,
  recipeId,
  importId,
  tags,
  collections,
  initial,
}: {
  mode: "create" | "edit";
  recipeId?: string;
  importId?: string;
  tags: Tag[];
  collections: Collection[];
  initial?: RecipeFormInitial;
}) {
  const router = useRouter();
  const base = initial ?? emptyInitial;

  const [core, setCore] = useState({
    title: base.title,
    subtitle: base.subtitle,
    description: base.description,
    cuisine: base.cuisine,
    cooking_method: base.cooking_method,
    course: base.course,
    main_type: base.main_type,
    main_protein: base.main_protein,
    yield_text: base.yield_text,
    notes: base.notes,
    servings: base.servings,
    prep_minutes: base.prep_minutes,
    cook_minutes: base.cook_minutes,
    difficulty: base.difficulty,
    recipe_status: base.recipe_status,
    is_favorite: base.is_favorite,
  });

  const [ingredients, setIngredients] = useState<IngredientRow[]>(
    base.ingredients.length > 0
      ? base.ingredients.map((i) => ({ ...i, key: nextKey() }))
      : [
          {
            key: nextKey(),
            section: "",
            quantity: "",
            unit: "",
            item: "",
            preparation: "",
            is_optional: false,
          },
        ],
  );

  const [steps, setSteps] = useState<StepRow[]>(
    base.steps.length > 0
      ? base.steps.map((s) => ({ ...s, key: nextKey() }))
      : [{ key: nextKey(), section: "", instruction: "" }],
  );

  const [tagIds, setTagIds] = useState<string[]>(base.tagIds);
  const [collectionIds, setCollectionIds] = useState<string[]>(
    base.collectionIds,
  );

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function setCoreField<K extends keyof typeof core>(
    key: K,
    value: (typeof core)[K],
  ) {
    setCore((c) => ({ ...c, [key]: value }));
  }

  function updateIngredient(
    key: string,
    patch: Partial<Omit<IngredientRow, "key">>,
  ) {
    setIngredients((rows) =>
      rows.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  }
  function addIngredient() {
    setIngredients((rows) => [
      ...rows,
      {
        key: nextKey(),
        section: "",
        quantity: "",
        unit: "",
        item: "",
        preparation: "",
        is_optional: false,
      },
    ]);
  }
  function removeIngredient(key: string) {
    setIngredients((rows) => rows.filter((r) => r.key !== key));
  }

  function updateStep(key: string, patch: Partial<Omit<StepRow, "key">>) {
    setSteps((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function addStep() {
    setSteps((rows) => [
      ...rows,
      { key: nextKey(), section: "", instruction: "" },
    ]);
  }
  function removeStep(key: string) {
    setSteps((rows) => rows.filter((r) => r.key !== key));
  }

  function toggleTag(id: string) {
    setTagIds((ids) =>
      ids.includes(id) ? ids.filter((t) => t !== id) : [...ids, id],
    );
  }
  function toggleCollection(id: string) {
    setCollectionIds((ids) =>
      ids.includes(id) ? ids.filter((c) => c !== id) : [...ids, id],
    );
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (core.title.trim().length === 0) {
      setError("Please give the recipe a title.");
      return;
    }

    const payload: RecipeFormInput = {
      title: core.title.trim(),
      subtitle: orNull(core.subtitle),
      description: orNull(core.description),
      cuisine: orNull(core.cuisine),
      cooking_method: orNull(core.cooking_method),
      course: orNull(core.course),
      main_type: orNull(core.main_type),
      main_protein: orNull(core.main_protein),
      yield_text: orNull(core.yield_text),
      notes: orNull(core.notes),
      servings: toIntOrNull(core.servings),
      prep_minutes: toIntOrNull(core.prep_minutes),
      cook_minutes: toIntOrNull(core.cook_minutes),
      difficulty: core.difficulty === "" ? null : core.difficulty,
      recipe_status: core.recipe_status,
      is_favorite: core.is_favorite,
      ingredients: ingredients
        .filter((i) => i.item.trim().length > 0)
        .map((i) => ({
          section: orNull(i.section),
          quantity: toNumOrNull(i.quantity),
          unit: orNull(i.unit),
          item: i.item.trim(),
          preparation: orNull(i.preparation),
          is_optional: i.is_optional,
        })),
      steps: steps
        .filter((s) => s.instruction.trim().length > 0)
        .map((s) => ({
          section: orNull(s.section),
          instruction: s.instruction.trim(),
          duration_minutes: null,
        })),
      tagIds,
      collectionIds,
    };

    startTransition(async () => {
      const res =
        mode === "edit" && recipeId
          ? await updateRecipe(recipeId, payload)
          : await createRecipe(payload);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.id) {
        if (mode === "create" && importId) {
          await completeImport(importId, res.id);
        }
        router.push(`/recipes/${res.id}`);
        router.refresh();
      }
    });
  }

  const tagsByType = groupTags(tags);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      {/* Basics */}
      <section className="flex flex-col gap-4">
        <label>
          <Label>Title *</Label>
          <Input
            value={core.title}
            onChange={(e) => setCoreField("title", e.target.value)}
            placeholder="e.g. Blackstone Smash Burgers"
            required
          />
        </label>
        <label>
          <Label>Subtitle</Label>
          <Input
            value={core.subtitle}
            onChange={(e) => setCoreField("subtitle", e.target.value)}
            placeholder="A short tagline"
          />
        </label>
        <label>
          <Label>Description</Label>
          <textarea
            value={core.description}
            onChange={(e) => setCoreField("description", e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground-muted focus-visible:border-primary focus-visible:outline-none"
            placeholder="What makes this one good?"
          />
        </label>
      </section>

      {/* Details */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <TextField label="Cuisine" value={core.cuisine} onChange={(v) => setCoreField("cuisine", v)} />
        <TextField label="Course" value={core.course} onChange={(v) => setCoreField("course", v)} />
        <TextField label="Main protein" value={core.main_protein} onChange={(v) => setCoreField("main_protein", v)} />
        <TextField label="Main type" value={core.main_type} onChange={(v) => setCoreField("main_type", v)} />
        <TextField label="Cooking method" value={core.cooking_method} onChange={(v) => setCoreField("cooking_method", v)} />
        <TextField label="Yield" value={core.yield_text} onChange={(v) => setCoreField("yield_text", v)} placeholder="e.g. 12 cookies" />
        <NumberField label="Servings" value={core.servings} onChange={(v) => setCoreField("servings", v)} />
        <NumberField label="Prep (min)" value={core.prep_minutes} onChange={(v) => setCoreField("prep_minutes", v)} />
        <NumberField label="Cook (min)" value={core.cook_minutes} onChange={(v) => setCoreField("cook_minutes", v)} />
        <label>
          <Label>Difficulty</Label>
          <select
            value={core.difficulty}
            onChange={(e) =>
              setCoreField("difficulty", e.target.value as Difficulty | "")
            }
            className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground focus-visible:border-primary focus-visible:outline-none"
          >
            <option value="">—</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
        <label>
          <Label>Status</Label>
          <select
            value={core.recipe_status}
            onChange={(e) =>
              setCoreField("recipe_status", e.target.value as RecipeStatus)
            }
            className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground focus-visible:border-primary focus-visible:outline-none"
          >
            {RECIPE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {RECIPE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 self-end pb-2.5">
          <input
            type="checkbox"
            checked={core.is_favorite}
            onChange={(e) => setCoreField("is_favorite", e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          <span className="text-sm font-medium text-foreground">Favorite</span>
        </label>
      </section>

      {/* Ingredients */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-foreground">Ingredients</h2>
          <Button type="button" variant="secondary" size="sm" onClick={addIngredient}>
            + Add ingredient
          </Button>
        </div>
        <div className="flex flex-col gap-3">
          {ingredients.map((ing) => (
            <div
              key={ing.key}
              className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-surface p-3 sm:grid-cols-12"
            >
              <input
                value={ing.quantity}
                onChange={(e) => updateIngredient(ing.key, { quantity: e.target.value })}
                placeholder="Qty"
                inputMode="decimal"
                className="col-span-1 h-10 rounded-lg border border-border bg-surface px-2.5 text-sm sm:col-span-2"
              />
              <input
                value={ing.unit}
                onChange={(e) => updateIngredient(ing.key, { unit: e.target.value })}
                placeholder="Unit"
                className="col-span-1 h-10 rounded-lg border border-border bg-surface px-2.5 text-sm sm:col-span-2"
              />
              <input
                value={ing.item}
                onChange={(e) => updateIngredient(ing.key, { item: e.target.value })}
                placeholder="Ingredient"
                className="col-span-2 h-10 rounded-lg border border-border bg-surface px-2.5 text-sm sm:col-span-4"
              />
              <input
                value={ing.preparation}
                onChange={(e) => updateIngredient(ing.key, { preparation: e.target.value })}
                placeholder="Prep (e.g. diced)"
                className="col-span-2 h-10 rounded-lg border border-border bg-surface px-2.5 text-sm sm:col-span-3"
              />
              <button
                type="button"
                onClick={() => removeIngredient(ing.key)}
                aria-label="Remove ingredient"
                className="col-span-2 h-10 rounded-lg text-sm text-foreground-muted hover:text-danger sm:col-span-1"
              >
                Remove
              </button>
              <label className="col-span-2 flex items-center gap-2 text-xs text-foreground-muted sm:col-span-6">
                <input
                  type="checkbox"
                  checked={ing.is_optional}
                  onChange={(e) => updateIngredient(ing.key, { is_optional: e.target.checked })}
                  className="h-3.5 w-3.5 rounded border-border"
                />
                Optional
              </label>
              <input
                value={ing.section}
                onChange={(e) => updateIngredient(ing.key, { section: e.target.value })}
                placeholder="Section (optional, e.g. Sauce)"
                className="col-span-2 h-10 rounded-lg border border-border bg-surface px-2.5 text-sm text-foreground-muted sm:col-span-6"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-foreground">Steps</h2>
          <Button type="button" variant="secondary" size="sm" onClick={addStep}>
            + Add step
          </Button>
        </div>
        <div className="flex flex-col gap-3">
          {steps.map((step, index) => (
            <div key={step.key} className="flex gap-3">
              <span className="mt-2.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-sm font-medium text-primary">
                {index + 1}
              </span>
              <div className="flex-1">
                <textarea
                  value={step.instruction}
                  onChange={(e) => updateStep(step.key, { instruction: e.target.value })}
                  rows={2}
                  placeholder="Describe this step"
                  className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground focus-visible:border-primary focus-visible:outline-none"
                />
                <div className="mt-1.5 flex items-center gap-3">
                  <input
                    value={step.section}
                    onChange={(e) => updateStep(step.key, { section: e.target.value })}
                    placeholder="Section (optional)"
                    className="h-9 flex-1 rounded-lg border border-border bg-surface px-2.5 text-sm text-foreground-muted"
                  />
                  <button
                    type="button"
                    onClick={() => removeStep(step.key)}
                    className="text-sm text-foreground-muted hover:text-danger"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tags */}
      {tags.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl text-foreground">Tags</h2>
          <div className="flex flex-col gap-3">
            {tagsByType.map((group) => (
              <div key={group.type}>
                <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  {group.type}
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.tags.map((tag) => (
                    <Chip
                      key={tag.id}
                      active={tagIds.includes(tag.id)}
                      onClick={() => toggleTag(tag.id)}
                    >
                      {tag.name}
                    </Chip>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Collections */}
      {collections.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl text-foreground">Collections</h2>
          <div className="flex flex-wrap gap-2">
            {collections.map((c) => (
              <Chip
                key={c.id}
                active={collectionIds.includes(c.id)}
                onClick={() => toggleCollection(c.id)}
              >
                {c.name}
              </Chip>
            ))}
          </div>
        </section>
      ) : null}

      {/* Notes */}
      <label>
        <Label>Notes</Label>
        <textarea
          value={core.notes}
          onChange={(e) => setCoreField("notes", e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground focus-visible:border-primary focus-visible:outline-none"
          placeholder="Anything to remember for next time"
        />
      </label>

      {error ? (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending
            ? "Saving…"
            : mode === "edit"
              ? "Save changes"
              : "Create recipe"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label>
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label>
      <Label>{label}</Label>
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-surface text-foreground hover:bg-surface-muted",
      )}
    >
      {children}
    </button>
  );
}

function groupTags(tags: Tag[]): { type: string; tags: Tag[] }[] {
  const order = [
    "course",
    "method",
    "diet",
    "occasion",
    "cuisine",
    "ingredient",
    "season",
    "custom",
  ];
  const groups: { type: string; tags: Tag[] }[] = [];
  for (const tag of tags) {
    let g = groups.find((x) => x.type === tag.tag_type);
    if (!g) {
      g = { type: tag.tag_type, tags: [] };
      groups.push(g);
    }
    g.tags.push(tag);
  }
  groups.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  return groups;
}
