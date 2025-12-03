import { HandlerInput } from 'ask-sdk-core';
import { Response } from 'ask-sdk-model';

export function buildResponse(handlerInput: HandlerInput, speechText: string, repromptText?: string): Response {
  const responseBuilder = handlerInput.responseBuilder;
  responseBuilder
    .speak(speechText)
    .withShouldEndSession(false);

  if (repromptText) {
    responseBuilder.reprompt(repromptText);
  }

  return responseBuilder.getResponse();
}

export function buildSimpleResponse(handlerInput: HandlerInput, speechText: string): Response {
  return handlerInput.responseBuilder
    .speak(speechText)
    .withShouldEndSession(true)
    .getResponse();
}

export function buildLinkAccountResponse(handlerInput: HandlerInput): Response {
  return handlerInput.responseBuilder
    .speak('Please link your Notion account in the Alexa app to continue.')
    .withLinkAccountCard()
    .withShouldEndSession(true)
    .getResponse();
}

/**
 * Cleans up task names by removing common command words and phrases.
 * Examples:
 *   "mark finish report as done" -> "finish report"
 *   "delete the task" -> "task"
 *   "update my report" -> "report"
 */
export function cleanTaskName(raw: string): string {
  if (!raw) return "";

  let text = raw.trim().toLowerCase();

  // Remove ONLY top-level command wrappers
  // Do NOT remove verbs inside actual task names
  const prefixPatterns = [
    /^mark\s+/,
    /^set\s+/,
    /^update\s+/,
    /^change\s+/,
    /^complete\s+/,
    /^finish\s+/,
  ];

  const suffixPatterns = [
    /\s+as\s+done$/,
    /\s+as\s+complete$/,
    /\s+to\s+done$/,
    /\s+done$/,
    /\s+complete$/,
  ];

  for (const p of prefixPatterns) {
    text = text.replace(p, "");
  }
  for (const s of suffixPatterns) {
    text = text.replace(s, "");
  }

  // Remove filler words, but only if they do NOT affect the meaning
  const stopWords = ["the", "my", "a", "an", "some", "to"];
  text = text
    .split(/\s+/)
    .filter((w) => !stopWords.includes(w))
    .join(" ");

  return text.trim();
}

function stem(word: string): string {
  return word
    .toLowerCase()
    .replace(/ing$|ed$|s$/g, ""); // buy/buys/buying/bought → buy
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}


/**
 * Finds a matching task using a hybrid approach:
 * 1. Exact match (case-insensitive)
 * 2. Word token matching (all search words must be present in task name)
 * 3. Substring matching (fallback)
 * 
 * This handles cases like:
 * - "quarterly report" matching "finish quarterly report"
 * - "finish report" matching "finish quarterly report"
 * - "report quarterly" matching "finish quarterly report" (word order)
 */
export function findMatchingTask<T extends { name: string; [key: string]: any }>(
  rawSearch: string,
  tasks: T[]
): T | null {
  if (!rawSearch || tasks.length === 0) return null;

  const cleaned = cleanTaskName(rawSearch);
  const search = cleaned.toLowerCase();
  const searchWords = search.split(/\s+/).map(stem);

  // Normalize task names (preserve all original properties)
  const normalizedTasks = tasks.map((t) => ({
    ...t,
    raw: t.name,
    lower: t.name.toLowerCase(),
    words: t.name
      .toLowerCase()
      .split(/\s+/)
      .map(stem),
  }));

  // 1. Exact match
  let match = normalizedTasks.find((t) => t.lower === search);
  if (match) {
    // Return original task object (remove normalization properties)
    const { raw, lower, words, ...originalTask } = match;
    return originalTask as unknown as T;
  }

  // 2. Exact stemmed match
  match = normalizedTasks.find((t) => t.words.join(" ") === searchWords.join(" "));
  if (match) {
    const { raw, lower, words, ...originalTask } = match;
    return originalTask as unknown as T;
  }

  // 3. All search words exist inside task words (bag-of-words)
  match = normalizedTasks.find((t) =>
    searchWords.every((w) => t.words.some((tw) => tw === w))
  );
  if (match) {
    const { raw, lower, words, ...originalTask } = match;
    return originalTask as unknown as T;
  }

  // 4. Contains partial word (singular/plural, tense)
  match = normalizedTasks.find((t) =>
    searchWords.every((w) =>
      t.words.some((tw) => tw.includes(w) || w.includes(tw))
    )
  );
  if (match) {
    const { raw, lower, words, ...originalTask } = match;
    return originalTask as unknown as T;
  }

  // 5. Fuzzy word match (Levenshtein ≤ 2)
  match = normalizedTasks.find((t) =>
    searchWords.every((w) =>
      t.words.some((tw) => levenshtein(w, tw) <= 2)
    )
  );
  if (match) {
    const { raw, lower, words, ...originalTask } = match;
    return originalTask as unknown as T;
  }

  // 6. Substring match (final fallback)
  match = normalizedTasks.find(
    (t) => t.lower.includes(search) || search.includes(t.lower)
  );
  if (match) {
    const { raw, lower, words, ...originalTask } = match;
    return originalTask as unknown as T;
  }

  return null;
}


