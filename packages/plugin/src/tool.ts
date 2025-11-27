import { z } from "zod/v4"

export type ToolContext = {
  sessionID: string
  messageID: string
  agent: string
  abort: AbortSignal
}

/**
 * Input example for a tool, showing correct usage patterns
 */
export interface ToolInputExample {
  /** Human-readable description of this example */
  description?: string
  /** The example input arguments */
  input: Record<string, unknown>
}

/**
 * Allowed callers for programmatic tool invocation
 */
export type AllowedCaller = "code_execution" | "direct"

export function tool<Args extends z.ZodRawShape>(input: {
  description: string
  args: Args
  /** If true, tool will be discoverable via search but not loaded upfront */
  deferLoading?: boolean
  /** Examples showing correct tool usage patterns */
  inputExamples?: ToolInputExample[]
  /** Which callers can invoke this tool (default: ["direct"]) */
  allowedCallers?: AllowedCaller[]
  /** Tags/categories for tool search */
  tags?: string[]
  execute(args: z.infer<z.ZodObject<Args>>, context: ToolContext): Promise<string>
}) {
  return input
}
tool.schema = z

export type ToolDefinition = ReturnType<typeof tool>
