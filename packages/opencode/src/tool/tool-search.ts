import z from "zod/v4"
import { Tool } from "./tool"

const DESCRIPTION = `Search for available tools based on capability needs.

This tool allows you to discover tools dynamically instead of having all tool definitions loaded upfront. Use this when you need a specific capability but aren't sure which tool provides it.

## When to use this tool:
- When you need to perform an action but don't see a relevant tool in your active tools
- When you want to find tools related to a specific domain (e.g., "file operations", "git", "database")
- When you need to discover what capabilities are available

## Search tips:
- Use descriptive capability queries like "edit files" or "search code"
- Use tags/categories like "file", "git", "web", "code" for broader searches
- The search looks at tool names, descriptions, and tags

Returns a list of matching tools with their descriptions and example usage.`

export const ToolSearchTool = Tool.define("tool_search", {
  description: DESCRIPTION,
  parameters: z.object({
    query: z.string().describe("Search query describing the capability you need (e.g., 'edit files', 'search code')"),
    tags: z
      .array(z.string())
      .optional()
      .describe("Optional tags/categories to filter by (e.g., ['file', 'code'])"),
    include_examples: z
      .boolean()
      .optional()
      .describe("If true, include input examples in the results (default: false)"),
  }),
  async execute(args, _ctx) {
    // Import dynamically to avoid circular dependency
    const { ToolRegistry } = await import("./registry")

    const results = await ToolRegistry.search({
      query: args.query,
      tags: args.tags,
      includeExamples: args.include_examples,
    })

    if (results.length === 0) {
      return {
        title: "Tool Search",
        metadata: { query: args.query, resultCount: 0, tools: [] as string[] },
        output: `No tools found matching "${args.query}". Try a different search query or broader terms.`,
      }
    }

    const output = results
      .map((tool) => {
        let entry = `## ${tool.id}\n${tool.description}`
        if (tool.tags?.length) {
          entry += `\nTags: ${tool.tags.join(", ")}`
        }
        if (args.include_examples && tool.inputExamples?.length) {
          entry += `\n\n### Examples:\n${tool.inputExamples.map((ex) => `- ${ex.description || "Usage"}: \`${JSON.stringify(ex.input)}\``).join("\n")}`
        }
        return entry
      })
      .join("\n\n---\n\n")

    return {
      title: "Tool Search",
      metadata: {
        query: args.query,
        resultCount: results.length,
        tools: results.map((t) => t.id),
      },
      output: `Found ${results.length} tool(s) matching "${args.query}":\n\n${output}`,
    }
  },
})
