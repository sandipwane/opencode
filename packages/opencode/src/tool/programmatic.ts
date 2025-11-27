import z from "zod/v4"
import { Tool } from "./tool"
import { Log } from "../util/log"
import vm from "vm"

const log = Log.create({ service: "tool.programmatic" })

const DESCRIPTION = `Execute code that can programmatically call other tools.

This tool allows you to orchestrate multiple tool calls through code, keeping intermediate results out of context. Only the final output of your code enters the conversation.

## When to use this tool:
- When you need to call multiple tools and process their results
- When intermediate results are large but only a summary is needed
- When you need to filter, aggregate, or transform tool outputs
- When you need to perform conditional logic based on tool results

## Available tool functions:
All tools marked for programmatic access are available as async functions:
- \`tools.read(args)\` - Read file contents
- \`tools.glob(args)\` - Find files by pattern
- \`tools.grep(args)\` - Search file contents
- \`tools.bash(args)\` - Execute shell commands
- \`tools.list(args)\` - List directory contents
- And more...

## Code execution:
- Code runs in a sandboxed JavaScript environment
- Use \`await\` for async tool calls
- Return a value to send it back to the conversation
- Console.log outputs are captured and included in results
- Errors are caught and reported

## Example:
\`\`\`javascript
// Find all TypeScript files and count lines
const files = await tools.glob({ pattern: "**/*.ts" })
let totalLines = 0
for (const file of files.output.split("\\n").filter(f => f)) {
  const content = await tools.read({ filePath: file })
  totalLines += content.output.split("\\n").length
}
return "Total lines in " + files.output.split("\\n").length + " TypeScript files: " + totalLines
\`\`\`
`

/**
 * Creates tool wrappers for programmatic execution
 */
export async function createToolExecutors(input: {
  sessionID: string
  messageID: string
  agent: string
  abort: AbortSignal
}) {
  const { ToolRegistry } = await import("./registry")
  const tools = await ToolRegistry.tools("", "")

  const executors: Record<string, (args: unknown) => Promise<unknown>> = {}

  for (const tool of tools) {
    // Only include tools that allow code_execution caller
    const allowedCallers = tool.allowedCallers ?? ["direct"]
    if (!allowedCallers.includes("code_execution")) continue

    executors[tool.id] = async (args: unknown) => {
      log.info("programmatic tool call", { tool: tool.id, args })
      const result = await tool.execute(args as any, {
        sessionID: input.sessionID,
        messageID: input.messageID,
        agent: input.agent,
        abort: input.abort,
        extra: { programmatic: true },
        metadata: async () => {},
      })
      return result
    }
  }

  return executors
}

/**
 * Execute code with access to tool functions
 */
export async function executeWithTools(input: {
  code: string
  sessionID: string
  messageID: string
  agent: string
  abort: AbortSignal
  timeout?: number
}): Promise<{ output: string; logs: string[]; error?: string }> {
  const logs: string[] = []
  const timeout = input.timeout ?? 60000 // 60 second default timeout

  try {
    const tools = await createToolExecutors({
      sessionID: input.sessionID,
      messageID: input.messageID,
      agent: input.agent,
      abort: input.abort,
    })

    // Create a sandboxed context
    const context = {
      tools,
      console: {
        log: (...args: unknown[]) => {
          logs.push(args.map(String).join(" "))
        },
        error: (...args: unknown[]) => {
          logs.push(`[ERROR] ${args.map(String).join(" ")}`)
        },
        warn: (...args: unknown[]) => {
          logs.push(`[WARN] ${args.map(String).join(" ")}`)
        },
      },
      JSON,
      Array,
      Object,
      String,
      Number,
      Boolean,
      Date,
      Math,
      RegExp,
      Map,
      Set,
      Promise,
      setTimeout: undefined, // Disabled for safety
      setInterval: undefined, // Disabled for safety
    }

    vm.createContext(context)

    // Wrap code in an async function to allow top-level await
    const wrappedCode = `
      (async () => {
        ${input.code}
      })()
    `

    const script = new vm.Script(wrappedCode)

    // Execute with timeout
    const result = await Promise.race([
      script.runInContext(context),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Code execution timeout")), timeout),
      ),
    ])

    const output = result !== undefined ? String(result) : logs.join("\n")

    return {
      output,
      logs,
    }
  } catch (error) {
    log.error("programmatic execution error", { error })
    return {
      output: "",
      logs,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export const ProgrammaticTool = Tool.define("code_execute", {
  description: DESCRIPTION,
  parameters: z.object({
    code: z.string().describe("JavaScript code to execute. Use 'await tools.toolName(args)' to call tools."),
    timeout: z.number().optional().describe("Execution timeout in milliseconds (default: 60000)"),
  }),
  allowedCallers: ["direct"],
  async execute(args, ctx) {
    log.info("executing programmatic tool", { codeLength: args.code.length })

    const result = await executeWithTools({
      code: args.code,
      sessionID: ctx.sessionID,
      messageID: ctx.messageID,
      agent: ctx.agent,
      abort: ctx.abort,
      timeout: args.timeout,
    })

    if (result.error) {
      return {
        title: "Code Execution Error",
        metadata: { error: result.error as string | undefined, logs: result.logs },
        output: `Error executing code: ${result.error}${result.logs.length ? `\n\nLogs:\n${result.logs.join("\n")}` : ""}`,
      }
    }

    return {
      title: "Code Execution",
      metadata: { error: undefined as string | undefined, logs: result.logs },
      output: result.output + (result.logs.length ? `\n\nLogs:\n${result.logs.join("\n")}` : ""),
    }
  },
})
