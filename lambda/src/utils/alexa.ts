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
export function cleanTaskName(taskSlot: string): string {
  if (!taskSlot || taskSlot.trim().length === 0) {
    return taskSlot;
  }

  let cleaned = taskSlot.trim();
  
  // Remove common command prefixes
  // Note: We don't remove "finish" alone because it's often part of task names (e.g., "finish quarterly report")
  // We only remove it when it's clearly a command verb like "finish the task" or "finish my task"
  const commandPrefixes = [
    /^mark\s+/i,
    /^mark\s+the\s+/i,
    /^mark\s+my\s+/i,
    /^mark\s+a\s+/i,
    /^mark\s+an\s+/i,
    /^complete\s+/i,
    /^finish\s+the\s+/i,  // Only remove "finish the" not just "finish"
    /^finish\s+my\s+/i,
    /^finish\s+a\s+/i,
    /^finish\s+an\s+/i,
    /^do\s+/i,
    /^do\s+the\s+/i,
    /^do\s+my\s+/i,
    /^do\s+a\s+/i,
    /^do\s+an\s+/i,
    /^delete\s+/i,
    /^delete\s+the\s+/i,
    /^delete\s+my\s+/i,
    /^delete\s+a\s+/i,
    /^delete\s+an\s+/i,
    /^remove\s+/i,
    /^remove\s+the\s+/i,
    /^remove\s+my\s+/i,
    /^remove\s+a\s+/i,
    /^remove\s+an\s+/i,
    /^update\s+/i,
    /^update\s+the\s+/i,
    /^update\s+my\s+/i,
    /^update\s+a\s+/i,
    /^update\s+an\s+/i,
    /^change\s+/i,
    /^change\s+the\s+/i,
    /^change\s+my\s+/i,
    /^change\s+a\s+/i,
    /^change\s+an\s+/i,
  ];
  
  // Remove common command suffixes
  const commandSuffixes = [
    /\s+as\s+done$/i,
    /\s+as\s+complete$/i,
    /\s+done$/i,
    /\s+complete$/i,
    /\s+finished$/i,
    /\s+as\s+finished$/i,
    /\s+as\s+completed$/i,
    /\s+as\s+complete$/i,
  ];
  
  // Apply prefix removal
  for (const prefix of commandPrefixes) {
    cleaned = cleaned.replace(prefix, '');
  }
  
  // Apply suffix removal
  for (const suffix of commandSuffixes) {
    cleaned = cleaned.replace(suffix, '');
  }
  
  // Clean up extra spaces
  cleaned = cleaned.trim().replace(/\s+/g, ' ');
  
  // If cleaning removed everything, use original
  if (!cleaned || cleaned.length === 0) {
    cleaned = taskSlot.trim();
  }
  
  return cleaned;
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
export function findMatchingTask(
  searchTerm: string,
  tasks: Array<{ name: string; [key: string]: any }>
): { name: string; [key: string]: any } | null {
  if (!searchTerm || !tasks || tasks.length === 0) {
    return null;
  }

  const searchLower = searchTerm.toLowerCase().trim();
  const searchWords = searchLower.split(/\s+/).filter(w => w.length > 0);

  if (searchWords.length === 0) {
    return null;
  }

  // 1. Exact match (case-insensitive)
  let match = tasks.find(task => task.name.toLowerCase() === searchLower);
  if (match) {
    console.log('[findMatchingTask] Exact match found:', match.name);
    return match;
  }

  // 2. Word token matching - all search words must be present in task name
  // This handles cases like "quarterly report" matching "finish quarterly report"
  match = tasks.find(task => {
    const taskLower = task.name.toLowerCase();
    const taskWords = taskLower.split(/\s+/);
    
    // Check if all search words are present in task name
    return searchWords.every(searchWord => 
      taskWords.some(taskWord => taskWord.includes(searchWord) || searchWord.includes(taskWord))
    );
  });
  
  if (match) {
    console.log('[findMatchingTask] Word token match found:', match.name);
    return match;
  }

  // 3. Substring matching (bidirectional) - fallback
  match = tasks.find(
    task => task.name.toLowerCase().includes(searchLower) ||
           searchLower.includes(task.name.toLowerCase())
  );
  
  if (match) {
    console.log('[findMatchingTask] Substring match found:', match.name);
    return match;
  }

  console.log('[findMatchingTask] No match found for:', searchTerm);
  return null;
}

