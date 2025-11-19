# OpenPipe Agent Training Integration

## Overview

Integrate OpenPipe.ai to collect agent interaction data and fine-tune specialized coding models.

**Goal**: Capture successful agent sessions → train cheaper, faster, domain-specific models → reduce costs while improving performance.

## Architecture

### Current State
- Agent uses Vercel AI SDK (`streamText`, `generateText`)
- Provider system: `packages/opencode/src/provider/provider.ts`
- Main prompt handling: `packages/opencode/src/session/prompt.ts`
- Agent definitions: `packages/opencode/src/agent/agent.ts`

### Proposed Changes

#### 1. Add OpenPipe Provider
Location: `packages/opencode/src/provider/provider.ts`

```typescript
CUSTOM_LOADERS: {
  openpipe: async () => ({
    autoload: Boolean(process.env.OPENPIPE_API_KEY),
    options: {
      // OpenPipe config
    }
  })
}
```

#### 2. Logging Middleware
Wrap LLM calls in `packages/opencode/src/session/prompt.ts`:
- Log request/response pairs
- Tag by task type (debugging, feature, refactor, search)
- Include success/failure metadata
- Store session context

#### 3. Data Collection Strategy

**High-Value Interactions:**
- Successful code edits
- Accurate file navigation
- Correct bash sequences
- Good commit messages
- Effective debugging paths
- Tool usage patterns

**Metadata to Capture:**
- Task type
- Success metrics
- User feedback (implicit/explicit)
- Execution time
- Token usage

## Implementation Phases

### Phase 1: Instrumentation
- [ ] Install OpenPipe SDK
- [ ] Add provider configuration
- [ ] Wrap `streamText`/`generateText` calls
- [ ] Add logging infrastructure
- [ ] Create tagging system

### Phase 2: Data Collection
- [ ] Define success criteria
- [ ] Implement auto-tagging
- [ ] Add opt-in/opt-out config
- [ ] Create data export utilities
- [ ] Monitor data quality

### Phase 3: Fine-Tuning Pipeline
- [ ] Set up OpenPipe project
- [ ] Create dataset from logs
- [ ] Filter/refine training data
- [ ] Fine-tune initial model
- [ ] Evaluate performance

### Phase 4: Deployment
- [ ] Add fine-tuned model as provider
- [ ] A/B test against base models
- [ ] Monitor quality metrics
- [ ] Iterate on training data

## Config Schema

```yaml
# opencode.config.yml
openpipe:
  enabled: true
  api_key: env:OPENPIPE_API_KEY
  logging:
    rate: 1.0  # Log 100% of requests
    tasks:
      - code_edit
      - debugging
      - file_search
      - bash_commands
  models:
    - name: opencode-specialized
      base: mistral-7b
      fallback: anthropic/claude-sonnet-4
```

## Data Schema

```typescript
interface AgentInteraction {
  sessionID: string
  messageID: string
  timestamp: number
  task_type: 'edit' | 'debug' | 'search' | 'plan' | 'bash'

  input: {
    system_prompt: string
    user_message: string
    context: object
  }

  output: {
    response: string
    tools_used: string[]
    success: boolean
  }

  metadata: {
    model: string
    tokens: { input: number, output: number }
    duration_ms: number
    user_feedback?: 'positive' | 'negative'
  }
}
```

## Cost Analysis

### Current State
- Primary models: Claude Sonnet 4, GPT-4
- Avg cost per session: ~$0.10-0.50
- High token usage for context-heavy tasks

### Expected Gains
- Fine-tuned Mistral: ~70% cost reduction
- Faster inference: 2-3x speedup
- Specialized performance for common tasks
- Fallback to larger models for complex cases

## Privacy & Security

- No code content in training data (configurable)
- Hash/anonymize file paths
- Remove API keys, secrets
- User opt-in required
- Data retention policies
- Export/delete capabilities

## Success Metrics

- Model performance vs base
- Cost savings per session
- Response time improvements
- User satisfaction scores
- Task completion rates

## Risks & Mitigations

**Risk**: Poor model quality
- Mitigation: Quality filters, human review, gradual rollout

**Risk**: Privacy concerns
- Mitigation: Clear opt-in, data controls, anonymization

**Risk**: Integration complexity
- Mitigation: Minimal changes to existing code, feature flags

**Risk**: Training data bias
- Mitigation: Diverse task sampling, regular audits

## Dependencies

- OpenPipe SDK (npm/bun)
- Storage for logs (local/cloud)
- Evaluation framework
- Config management

## Timeline Estimate

- Phase 1: 1-2 weeks
- Phase 2: 2-3 weeks (data collection)
- Phase 3: 1 week (training)
- Phase 4: 1-2 weeks (deployment)

**Total**: ~6-8 weeks for full implementation

## Open Questions

1. Default opt-in or opt-out?
2. Which tasks to prioritize for training?
3. Cloud vs local log storage?
4. Integration with existing telemetry?
5. How to handle multi-turn sessions?
6. Evaluation criteria for model quality?
