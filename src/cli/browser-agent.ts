#!/usr/bin/env node
/**
 * wmux Browser Agent — autonomous browsing agent powered by Claude.
 *
 * Takes a high-level task, uses Claude API + wmux CDP bridge in a loop
 * to autonomously browse the web. All actions visible in the wmux browser panel.
 *
 * Usage: node browser-agent.js --task "find sushi restaurants in Paris"
 */

import Anthropic from '@anthropic-ai/sdk';
import net from 'net';

const PIPE_PATH = process.env.WMUX_PIPE || '\\\\.\\pipe\\wmux';
const MAX_STEPS = 25;
const MODEL = 'claude-sonnet-4-20250514';

// ── Pipe client ──────────────────────────────────────────────────────

function sendToPipe(method: string, params: Record<string, any> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const client = net.connect({ path: PIPE_PATH }, () => {
      client.write(JSON.stringify({ method, params, id: 1 }) + '\n');
    });
    let data = '';
    client.on('data', (chunk) => {
      data += chunk.toString();
      if (data.includes('\n')) {
        client.end();
        try {
          const response = JSON.parse(data.trim());
          if (response.error) reject(new Error(response.error.message));
          else resolve(response.result);
        } catch { resolve(data.trim()); }
      }
    });
    client.on('error', reject);
    setTimeout(() => { client.end(); reject(new Error('pipe timeout')); }, 30000);
  });
}

// ── Browser tools for Claude ─────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'navigate',
    description: 'Navigate the browser to a URL.',
    input_schema: {
      type: 'object' as const,
      properties: { url: { type: 'string', description: 'URL to navigate to' } },
      required: ['url'],
    },
  },
  {
    name: 'click',
    description: 'Click an element by its ref from the snapshot (e.g. @e5).',
    input_schema: {
      type: 'object' as const,
      properties: { ref: { type: 'string', description: 'Element ref like @e5' } },
      required: ['ref'],
    },
  },
  {
    name: 'type_text',
    description: 'Type text into an input element. Clicks the element first, then types.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ref: { type: 'string', description: 'Element ref like @e3' },
        text: { type: 'string', description: 'Text to type' },
      },
      required: ['ref', 'text'],
    },
  },
  {
    name: 'fill',
    description: 'Set the value of an input directly (faster than typing).',
    input_schema: {
      type: 'object' as const,
      properties: {
        ref: { type: 'string', description: 'Element ref' },
        value: { type: 'string', description: 'Value to set' },
      },
      required: ['ref', 'value'],
    },
  },
  {
    name: 'get_text',
    description: 'Get the text content of the page or a specific element.',
    input_schema: {
      type: 'object' as const,
      properties: { ref: { type: 'string', description: 'Element ref (optional — omit for full page)' } },
    },
  },
  {
    name: 'go_back',
    description: 'Navigate back in browser history.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'wait',
    description: 'Wait briefly for the page to update (e.g. after clicking).',
    input_schema: {
      type: 'object' as const,
      properties: { ms: { type: 'number', description: 'Milliseconds to wait (default 1000)' } },
    },
  },
  {
    name: 'done',
    description: 'The task is complete. Return the final answer to the user.',
    input_schema: {
      type: 'object' as const,
      properties: { result: { type: 'string', description: 'The final answer/result for the user' } },
      required: ['result'],
    },
  },
];

// ── Execute a tool call ──────────────────────────────────────────────

async function executeTool(name: string, input: any): Promise<string> {
  try {
    switch (name) {
      case 'navigate':
        await sendToPipe('browser.navigate', { url: input.url });
        const snapNav = await sendToPipe('browser.snapshot');
        return `Navigated to ${input.url}.\n\nPage snapshot:\n${snapNav.tree}`;

      case 'click':
        await sendToPipe('browser.click', { ref: input.ref });
        await new Promise(r => setTimeout(r, 800));
        const snapClick = await sendToPipe('browser.snapshot');
        return `Clicked ${input.ref}.\n\nPage snapshot:\n${snapClick.tree}`;

      case 'type_text':
        await sendToPipe('browser.type', { ref: input.ref, text: input.text });
        const snapType = await sendToPipe('browser.snapshot');
        return `Typed "${input.text}" into ${input.ref}.\n\nPage snapshot:\n${snapType.tree}`;

      case 'fill':
        await sendToPipe('browser.fill', { ref: input.ref, value: input.value });
        const snapFill = await sendToPipe('browser.snapshot');
        return `Filled ${input.ref} with "${input.value}".\n\nPage snapshot:\n${snapFill.tree}`;

      case 'get_text': {
        const result = await sendToPipe('browser.get_text', { ref: input.ref });
        return `Text content:\n${result.text}`;
      }

      case 'go_back':
        await sendToPipe('browser.eval', { js: 'history.back()' });
        await new Promise(r => setTimeout(r, 1000));
        const snapBack = await sendToPipe('browser.snapshot');
        return `Went back.\n\nPage snapshot:\n${snapBack.tree}`;

      case 'wait':
        await new Promise(r => setTimeout(r, input.ms || 1000));
        const snapWait = await sendToPipe('browser.snapshot');
        return `Waited ${input.ms || 1000}ms.\n\nPage snapshot:\n${snapWait.tree}`;

      case 'done':
        return `DONE: ${input.result}`;

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err: any) {
    return `Error executing ${name}: ${err.message}`;
  }
}

// ── Agent loop ───────────────────────────────────────────────────────

async function runAgent(task: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is required.');
    console.error('Set it with: export ANTHROPIC_API_KEY=sk-ant-...');
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });

  // Get initial page state
  let initialSnapshot: string;
  try {
    const snap = await sendToPipe('browser.snapshot');
    initialSnapshot = snap.tree;
  } catch {
    initialSnapshot = '(browser panel is empty or closed)';
  }

  const systemPrompt = `You are a browser agent controlling a real browser visible to the user. Your job is to complete the user's task by navigating web pages.

RULES:
- You can see the page via accessibility tree snapshots with @eN refs.
- After every action, you get an updated snapshot — use it to decide the next step.
- Be efficient: go directly to relevant pages, don't waste steps.
- For searches, use Google: navigate to https://www.google.com/search?q=URL_ENCODED_QUERY
- When you have the answer, call the "done" tool with a clear, helpful result.
- If stuck, try going back or navigating to a different URL.
- Max ${MAX_STEPS} steps — be concise.`;

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Task: ${task}\n\nCurrent browser state:\n${initialSnapshot}`,
    },
  ];

  console.error(`[browser-agent] Starting task: ${task}`);

  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      tools: TOOLS,
      messages,
    });

    // Collect all text + tool_use blocks
    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === 'text');

    // Log thinking
    for (const t of textBlocks) {
      if (t.text.trim()) console.error(`[browser-agent] Step ${step + 1}: ${t.text.trim()}`);
    }

    if (toolUses.length === 0) {
      // No tool calls — agent is done or confused
      const finalText = textBlocks.map(b => b.text).join('\n');
      console.error('[browser-agent] Agent finished (no more tool calls)');
      return finalText || 'Agent completed without a result.';
    }

    // Add assistant message
    messages.push({ role: 'assistant', content: response.content });

    // Execute tools and collect results
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const tool of toolUses) {
      console.error(`[browser-agent] Step ${step + 1}: ${tool.name}(${JSON.stringify(tool.input)})`);

      const result = await executeTool(tool.name, tool.input);

      // Check if done
      if (tool.name === 'done') {
        const answer = (tool.input as any).result;
        console.error('[browser-agent] Task complete!');
        return answer;
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: tool.id,
        content: result,
      });
    }

    messages.push({ role: 'user', content: toolResults });

    // Check stop reason
    if (response.stop_reason === 'end_turn') {
      console.error('[browser-agent] Agent ended turn');
      break;
    }
  }

  console.error('[browser-agent] Max steps reached');
  return 'Agent reached maximum steps without completing the task.';
}

// ── CLI entry point ──────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  // Parse --task flag
  const taskIdx = args.indexOf('--task');
  let task: string;
  if (taskIdx !== -1 && args[taskIdx + 1]) {
    task = args[taskIdx + 1];
  } else {
    // Everything after the script name is the task
    task = args.join(' ');
  }

  if (!task) {
    console.error('Usage: browser-agent --task "your task here"');
    console.error('   or: browser-agent find sushi restaurants in Paris');
    process.exit(1);
  }

  try {
    const result = await runAgent(task);
    // Output result to stdout (for Claude Code to read)
    console.log(result);
  } catch (err: any) {
    console.error(`[browser-agent] Fatal error: ${err.message}`);
    process.exit(1);
  }
}

main();
