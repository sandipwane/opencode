# OpenCode AgentCore Native - Design Doc

## Overview

Stripped-down opencode rewrite using AWS AgentCore as native foundation.

## Current OpenCode Architecture

- ~8,500 lines core code
- Provider-agnostic (20+ LLM providers)
- Built-in tools: bash, read, write, edit, glob, grep, etc.
- Session management via local storage
- TUI + CLI + HTTP server
- Plugin system + MCP support

### Core Components

| Component | Lines | Purpose |
|-----------|-------|---------|
| prompt.ts | 1,780 | Agent loop |
| processor.ts | 406 | Stream handling |
| llm.ts | 238 | LLM wrapper |
| session/index.ts | 488 | Session CRUD |
| tool/ | 30KB | 30+ tools |
| server.ts | 2,908 | HTTP API |

## AgentCore Services

| Service | Purpose |
|---------|---------|
| Runtime | Serverless deployment, auto-scale, 8hr tasks |
| Memory | Session persistence, episodic memory |
| Gateway | Convert APIs to MCP tools |
| Code Interpreter | Sandboxed code execution |
| Browser Tool | Cloud browser for web tasks |
| Identity | Auth via Cognito/Okta/Entra |
| Observability | OTEL tracing, CloudWatch |
| Policy | Cedar-based guardrails |

## Target Architecture

```
opencode-agentcore/
├── cli/           # Local CLI (hybrid mode)
├── runtime/       # Serverless handler
└── shared/        # Agent logic + tools
```

### Component Mapping

| OpenCode | AgentCore Replacement |
|----------|----------------------|
| llm.ts | Strands Agents SDK |
| session storage | AgentCore Memory |
| code sandbox | AgentCore Code Interpreter |
| web browsing | AgentCore Browser Tool |
| API tools | AgentCore Gateway |
| deployment | AgentCore Runtime |
| auth | AgentCore Identity |
| logging | AgentCore Observability |

## Execution Modes

### Mode 1: Hybrid (Dev)

```
LOCAL                      AWS
─────                      ───
CLI ──────────────────►  Bedrock LLM
 │   prompt/response        │
 │                          │
 ▼                          │
Tools execute locally       │
(bash, read, write)         │
 │                          │
 ▼                          │
Your DB/files
```

- Tools run on YOUR machine
- Can access local DB, files, network
- LLM thinking happens in cloud

### Mode 2: Fully Serverless

```
AWS CLOUD (VPC)
───────────────
AgentCore Runtime
    │
    ├── Agent (your code)
    │       │
    │       ▼
    │   Bedrock LLM
    │       │
    │       ▼
    │   Tools execute in cloud
    │       │
    │       ▼
    └── RDS/DynamoDB (same VPC)
```

- Everything runs in AWS
- Access cloud resources via IAM
- Trigger from anywhere via API

## Trigger Methods

### 1. CLI

```bash
opencode-aws "migrate users table"
opencode-aws --cwd /project "fix tests"
```

### 2. HTTP API

```bash
curl -X POST https://agent.agentcore.aws/invoke \
  -d '{"prompt": "add pagination"}'
```

### 3. AWS SDK

```typescript
const client = new AgentCoreClient();
await client.invokeAgent({
  agentId: "opencode",
  prompt: "refactor auth"
});
```

### 4. Event-Driven

- GitHub webhooks
- EventBridge rules
- PR/commit triggers
- Cron/scheduled

### 5. Slack/Teams Bot

```
@opencode add rate limiting
```

### 6. Agent-to-Agent (A2A)

```python
orchestrator.delegate("opencode-agent", "build dashboard")
```

## DB Migration Example

| Scenario | Where Runs | DB Access |
|----------|-----------|-----------|
| Local DB + Hybrid | Your machine | localhost |
| AWS RDS + Hybrid | Your machine | Your creds |
| AWS RDS + Serverless | AgentCore Runtime | IAM role |
| Local DB + Serverless | ❌ | No access |

## Output Deliverables

1. `packages/opencode-agentcore/` - New package (~2K lines)
2. CLI binary - `opencode-aws` command
3. Lambda handler - AgentCore Runtime deployment
4. CDK/SAM template - One-click AWS deploy

## Benefits vs Current

| Feature | Current | AgentCore |
|---------|---------|-----------|
| Runs on | Local machine | AWS serverless |
| Scaling | Single instance | Auto-scales |
| Cost | Always on | Pay per request |
| Sessions | Local files | Cloud persisted |
| Long tasks | Terminal limited | Up to 8 hours |
| Code exec | Local shell | Sandboxed |
| Access | Terminal only | Anywhere (API) |

## Tech Stack

- Strands Agents SDK (TypeScript preview)
- AgentCore SDK
- Bedrock models
- CDK for infra

## References

- https://aws.amazon.com/bedrock/agentcore/
- https://github.com/aws/bedrock-agentcore-sdk-python
- https://github.com/strands-agents/sdk-python
- https://strandsagents.com/latest/
