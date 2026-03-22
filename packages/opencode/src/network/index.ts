import { Flag } from "@/flag/flag"
import { Log } from "../util/log"
import { NamedError } from "@opencode-ai/util/error"
import z from "zod"

export namespace Network {
  const log = Log.create({ service: "network" })

  export const BlockedError = NamedError.create(
    "NetworkBlockedError",
    z.object({
      url: z.string().optional(),
      reason: z.string(),
    }),
  )

  /** Is the app in air-gapped / network-restricted mode? */
  export function offline(): boolean {
    return Flag.OPENCODE_AIR_GAPPED
  }

  /**
   * Fetch wrapper for automatic/app-initiated HTTP requests.
   * Blocked when air-gapped. User-initiated calls should use globalThis.fetch directly.
   */
  export async function fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    if (offline()) {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
      throw new BlockedError({ url, reason: "air-gapped mode is enabled (OPENCODE_AIR_GAPPED=true)" })
    }
    log.debug("fetch", { url: typeof input === "string" ? input : "Request" })
    return globalThis.fetch(input, init)
  }
}
