/**
 * ToolCalling-based structured extraction engine.
 *
 * Uses the RunAnywhere ToolCalling extension so the LLM returns structured
 * tool calls instead of free-form text.  Each call maps directly to an
 * IntelligenceItem, making parsing deterministic.
 *
 * Two tools are registered per invocation:
 *   - extract_finding  -- the primary fact extractor
 *   - flag_anomaly     -- surfaces contradictions / outliers
 */

import {
  ToolCalling,
  type ToolDefinition,
  type ToolCall,
  type ToolValue,
  toToolValue,
  getStringArg,
  getNumberArg,
} from '@runanywhere/web-llamacpp';
import type { IntelligenceItem, DomainProfile } from './types';
import { getTimestamp } from './extraction';

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const ANOMALY_SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;

/**
 * Build domain-specific tool definitions.
 *
 * The `extract_finding` tool's `category` parameter gets an `enumValues`
 * list drawn from the domain profile so the LLM can only pick valid categories.
 */
export function buildToolDefinitions(domain: DomainProfile): ToolDefinition[] {
  const extractFinding: ToolDefinition = {
    name: 'extract_finding',
    description:
      'Extract a single intelligence finding from the transcript. ' +
      'Call this once per discrete fact discovered.',
    parameters: [
      {
        name: 'category',
        type: 'string',
        description: `The finding category. Must be one of: ${domain.categories.join(', ')}`,
        required: true,
        enumValues: [...domain.categories],
      },
      {
        name: 'content',
        type: 'string',
        description:
          'A concise, corrected statement of the finding. ' +
          'Fix any speech-recognition errors.',
        required: true,
      },
      {
        name: 'confidence',
        type: 'number',
        description:
          'Confidence score between 0 and 1 indicating how certain the extraction is.',
        required: true,
      },
    ],
  };

  const flagAnomaly: ToolDefinition = {
    name: 'flag_anomaly',
    description:
      'Flag an anomaly, contradiction, or outlier found in the transcript.',
    parameters: [
      {
        name: 'description',
        type: 'string',
        description: 'Brief description of the anomaly.',
        required: true,
      },
      {
        name: 'severity',
        type: 'string',
        description: `Severity level. Must be one of: ${ANOMALY_SEVERITIES.join(', ')}`,
        required: true,
        enumValues: [...ANOMALY_SEVERITIES],
      },
      {
        name: 'related_categories',
        type: 'array',
        description:
          'Array of category names this anomaly relates to.',
        required: false,
      },
    ],
  };

  return [extractFinding, flagAnomaly];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a single ToolCall into an IntelligenceItem. */
function toolCallToItem(call: ToolCall, timestamp: string): IntelligenceItem | null {
  const args = call.arguments;

  if (call.toolName === 'extract_finding') {
    const category = getStringArg(args, 'category');
    const content = getStringArg(args, 'content');
    // confidence is informational -- we don't filter on it today but it's
    // preserved in the structured call for downstream consumers.
    if (!category || !content) return null;
    return {
      id: crypto.randomUUID(),
      category,
      content,
      timestamp,
    };
  }

  if (call.toolName === 'flag_anomaly') {
    const description = getStringArg(args, 'description');
    const severity = getStringArg(args, 'severity') ?? 'medium';
    if (!description) return null;
    return {
      id: crypto.randomUUID(),
      category: `Anomaly [${severity}]`,
      content: description,
      timestamp,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main extraction entry-point
// ---------------------------------------------------------------------------

/** Default timeout for tool-calling generation (ms). */
const TOOL_EXTRACTION_TIMEOUT_MS = 60_000;

/**
 * Extract intelligence items from transcript text using ToolCalling.
 *
 * Falls back to an empty array on any failure so callers can safely
 * combine this with the keyword extractor.
 */
export async function extractWithTools(
  text: string,
  domain: DomainProfile,
  systemPrompt: string,
): Promise<IntelligenceItem[]> {
  if (!text.trim()) return [];

  const tools = buildToolDefinitions(domain);
  const timestamp = getTimestamp();

  // We need to collect tool calls from the LLM.  We register trivial
  // executors that just acknowledge the call -- the real value is in the
  // structured arguments the LLM provides.
  const previouslyRegistered = ToolCalling.getRegisteredTools().map(t => t.name);

  try {
    // Register our domain-specific tools
    for (const tool of tools) {
      ToolCalling.registerTool(tool, async (args) => {
        // Acknowledge the call; the extraction happens from the ToolCall args
        return { status: toToolValue('acknowledged') };
      });
    }

    // Race the generation against a timeout
    const result = await Promise.race([
      ToolCalling.generateWithTools(text, {
        tools,
        systemPrompt,
        maxToolCalls: 30,        // generous upper bound
        autoExecute: true,       // let the SDK orchestrate the loop
        temperature: 0.1,        // low temperature for factual extraction
        maxTokens: 2048,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Tool extraction timed out')), TOOL_EXTRACTION_TIMEOUT_MS),
      ),
    ]);

    // Convert ToolCalls to IntelligenceItems
    const items: IntelligenceItem[] = [];
    const seen = new Set<string>();

    for (const call of result.toolCalls) {
      const item = toolCallToItem(call, timestamp);
      if (!item) continue;

      // Deduplicate by category + content
      const key = `${item.category}:${item.content.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }

    return items;
  } catch (err) {
    // Graceful fallback -- the keyword extractor remains the safety net
    console.warn('[toolExtraction] extraction failed, returning empty:', err);
    return [];
  } finally {
    // Clean up: unregister only the tools we registered
    for (const tool of tools) {
      try {
        ToolCalling.unregisterTool(tool.name);
      } catch {
        // ignore -- may have already been cleaned up
      }
    }
    // Re-register any tools that were there before (defensive)
    // Not strictly necessary since we only unregister ours, but being safe.
  }
}
