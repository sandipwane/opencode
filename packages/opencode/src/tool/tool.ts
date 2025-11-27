import z from "zod/v4"

export namespace Tool {
  interface Metadata {
    [key: string]: any
  }
  export type Context<M extends Metadata = Metadata> = {
    sessionID: string
    messageID: string
    agent: string
    abort: AbortSignal
    callID?: string
    extra?: { [key: string]: any }
    metadata(input: { title?: string; metadata?: M }): void
  }

  /**
   * Input example for a tool, showing correct usage patterns
   */
  export interface InputExample {
    /** Human-readable description of this example */
    description?: string
    /** The example input arguments */
    input: Record<string, unknown>
  }

  /**
   * Allowed callers for programmatic tool invocation
   */
  export type AllowedCaller = "code_execution" | "direct"

  /**
   * Extended tool definition with advanced features
   */
  export interface Definition<Parameters extends z.ZodType = z.ZodType, M extends Metadata = Metadata> {
    description: string
    parameters: Parameters
    /** If true, tool will be discoverable via search but not loaded upfront */
    deferLoading?: boolean
    /** Examples showing correct tool usage patterns */
    inputExamples?: InputExample[]
    /** Which callers can invoke this tool (default: ["direct"]) */
    allowedCallers?: AllowedCaller[]
    /** Tags/categories for tool search */
    tags?: string[]
    execute(
      args: z.infer<Parameters>,
      ctx: Context,
    ): Promise<{
      title: string
      metadata: M
      output: string
    }>
  }

  export interface Info<Parameters extends z.ZodType = z.ZodType, M extends Metadata = Metadata> {
    id: string
    /** If true, tool will be discoverable via search but not loaded upfront */
    deferLoading?: boolean
    /** Tags/categories for tool search */
    tags?: string[]
    init: () => Promise<Definition<Parameters, M>>
  }

  export function define<Parameters extends z.ZodType, Result extends Metadata>(
    id: string,
    init: Info<Parameters, Result>["init"] | Definition<Parameters, Result>,
    options?: {
      deferLoading?: boolean
      tags?: string[]
    },
  ): Info<Parameters, Result> {
    return {
      id,
      deferLoading: options?.deferLoading,
      tags: options?.tags,
      init: async () => {
        if (init instanceof Function) return init()
        return init
      },
    }
  }
}
