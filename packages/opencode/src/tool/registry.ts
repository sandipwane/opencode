import { BashTool } from "./bash"
import { EditTool } from "./edit"
import { GlobTool } from "./glob"
import { GrepTool } from "./grep"
import { ListTool } from "./ls"
import { PatchTool } from "./patch"
import { ReadTool } from "./read"
import { TaskTool } from "./task"
import { TodoWriteTool, TodoReadTool } from "./todo"
import { WebFetchTool } from "./webfetch"
import { WriteTool } from "./write"
import { InvalidTool } from "./invalid"
import { ToolSearchTool } from "./tool-search"
import { ProgrammaticTool } from "./programmatic"
import type { Agent } from "../agent/agent"
import { Tool } from "./tool"
import { Instance } from "../project/instance"
import { Config } from "../config/config"
import path from "path"
import { type ToolDefinition } from "@opencode-ai/plugin"
import z from "zod/v4"
import { Plugin } from "../plugin"

export namespace ToolRegistry {
  // Built-in tools that ship with opencode (always loaded)
  const BUILTIN = [
    InvalidTool,
    BashTool,
    EditTool,
    WebFetchTool,
    GlobTool,
    GrepTool,
    ListTool,
    PatchTool,
    ReadTool,
    WriteTool,
    TodoWriteTool,
    TodoReadTool,
    TaskTool,
    ToolSearchTool,
    ProgrammaticTool,
  ]

  export const state = Instance.state(async () => {
    const custom = [] as Tool.Info[]
    const glob = new Bun.Glob("tool/*.{js,ts}")

    for (const dir of await Config.directories()) {
      for await (const match of glob.scan({ cwd: dir, absolute: true })) {
        const namespace = path.basename(match, path.extname(match))
        const mod = await import(match)
        for (const [id, def] of Object.entries<ToolDefinition>(mod)) {
          custom.push(fromPlugin(id === "default" ? namespace : `${namespace}_${id}`, def))
        }
      }
    }

    const plugins = await Plugin.list()
    for (const plugin of plugins) {
      for (const [id, def] of Object.entries(plugin.tool ?? {})) {
        custom.push(fromPlugin(id, def))
      }
    }

    return { custom }
  })

  function fromPlugin(id: string, def: ToolDefinition): Tool.Info {
    return {
      id,
      deferLoading: def.deferLoading,
      tags: def.tags,
      init: async () => ({
        parameters: z.object(def.args),
        description: def.description,
        deferLoading: def.deferLoading,
        inputExamples: def.inputExamples,
        allowedCallers: def.allowedCallers,
        tags: def.tags,
        execute: async (args, ctx) => {
          const result = await def.execute(args as any, ctx)
          return {
            title: "",
            output: result,
            metadata: {},
          }
        },
      }),
    }
  }

  export async function register(tool: Tool.Info) {
    const { custom } = await state()
    const idx = custom.findIndex((t) => t.id === tool.id)
    if (idx >= 0) {
      custom.splice(idx, 1, tool)
      return
    }
    custom.push(tool)
  }

  async function all(): Promise<Tool.Info[]> {
    const custom = await state().then((x) => x.custom)
    return [...BUILTIN, ...custom]
  }

  export async function ids() {
    return all().then((x) => x.map((t) => t.id))
  }

  /**
   * Get all tools, optionally filtering out deferred ones
   */
  export async function tools(_providerID: string, _modelID: string, options?: { includeDeferred?: boolean }) {
    const allTools = await all()
    const toolList = options?.includeDeferred ? allTools : allTools.filter((t) => !t.deferLoading)

    const result = await Promise.all(
      toolList.map(async (t) => ({
        id: t.id,
        deferLoading: t.deferLoading,
        tags: t.tags,
        ...(await t.init()),
      })),
    )
    return result
  }

  /**
   * Get a specific tool by ID (including deferred tools)
   */
  export async function get(toolId: string) {
    const allTools = await all()
    const tool = allTools.find((t) => t.id === toolId)
    if (!tool) return undefined

    return {
      id: tool.id,
      deferLoading: tool.deferLoading,
      tags: tool.tags,
      ...(await tool.init()),
    }
  }

  /**
   * Search for tools matching a query
   * Searches tool IDs, descriptions, and tags
   */
  export async function search(input: {
    query: string
    tags?: string[]
    includeExamples?: boolean
  }): Promise<
    Array<{
      id: string
      description: string
      tags?: string[]
      inputExamples?: Tool.InputExample[]
    }>
  > {
    const allTools = await all()
    const queryLower = input.query.toLowerCase()
    const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 0)

    const results: Array<{
      tool: Tool.Info
      def: Tool.Definition
      score: number
    }> = []

    for (const tool of allTools) {
      const def = await tool.init()

      // Skip the search tool itself and invalid tool
      if (tool.id === "tool_search" || tool.id === "invalid") continue

      let score = 0

      // Match against ID
      const idLower = tool.id.toLowerCase()
      if (idLower.includes(queryLower)) {
        score += 10
      }
      for (const word of queryWords) {
        if (idLower.includes(word)) score += 3
      }

      // Match against description
      const descLower = def.description.toLowerCase()
      if (descLower.includes(queryLower)) {
        score += 5
      }
      for (const word of queryWords) {
        if (descLower.includes(word)) score += 2
      }

      // Match against tags
      const toolTags = tool.tags ?? def.tags ?? []
      for (const tag of toolTags) {
        const tagLower = tag.toLowerCase()
        if (tagLower.includes(queryLower)) score += 8
        for (const word of queryWords) {
          if (tagLower.includes(word)) score += 4
        }
      }

      // Filter by requested tags
      if (input.tags?.length) {
        const hasMatchingTag = input.tags.some((reqTag) =>
          toolTags.some((t) => t.toLowerCase().includes(reqTag.toLowerCase())),
        )
        if (!hasMatchingTag) continue
      }

      if (score > 0) {
        results.push({ tool, def, score })
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score)

    return results.slice(0, 10).map(({ tool, def }) => ({
      id: tool.id,
      description: def.description.slice(0, 500) + (def.description.length > 500 ? "..." : ""),
      tags: tool.tags ?? def.tags,
      inputExamples: input.includeExamples ? def.inputExamples : undefined,
    }))
  }

  /**
   * Generate tool description with examples (if available)
   */
  export function formatDescription(tool: {
    description: string
    inputExamples?: Tool.InputExample[]
  }): string {
    let desc = tool.description

    if (tool.inputExamples?.length) {
      desc += "\n\n## Examples:\n"
      for (const example of tool.inputExamples) {
        desc += `\n### ${example.description || "Example"}\n`
        desc += "```json\n" + JSON.stringify(example.input, null, 2) + "\n```\n"
      }
    }

    return desc
  }

  export async function enabled(
    _providerID: string,
    _modelID: string,
    agent: Agent.Info,
  ): Promise<Record<string, boolean>> {
    const result: Record<string, boolean> = {}
    result["patch"] = false

    if (agent.permission.edit === "deny") {
      result["edit"] = false
      result["patch"] = false
      result["write"] = false
    }
    if (agent.permission.bash["*"] === "deny" && Object.keys(agent.permission.bash).length === 1) {
      result["bash"] = false
    }
    if (agent.permission.webfetch === "deny") {
      result["webfetch"] = false
    }

    return result
  }
}
