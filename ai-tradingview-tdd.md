# Technical Design Document

## System overview

TradePilot AI is a SaaS-backed Chrome extension that injects an assistant into TradingView and connects to a cloud AI platform that generates, edits, and explains Pine Script. The architecture should separate browser-side UI and editor integration from server-side orchestration, billing, authentication, analytics, and model routing.

## Architecture

### Major components
- Chrome extension frontend.
- Content scripts for TradingView page interaction.
- Background service worker for auth state, API calls, and secure message passing.
- Backend API service.
- AI orchestration service.
- Authentication service.
- Billing service.
- Analytics and observability stack.
- Data store for users, prompts, generations, subscriptions, and feedback.

### High-level flow
1. User enters prompt in extension UI.
2. Content script packages TradingView context and user input.
3. Background worker sends authenticated request to backend API.
4. Backend validates quota and plan.
5. AI orchestration service builds prompt and calls model provider.
6. Response is normalized into structured generation output.
7. Extension displays code and explanation.
8. On user action, content script inserts code into TradingView Pine Editor.
9. Events are logged for analytics and quality measurement.

## Frontend design

### Chrome extension modules
- **Popup UI:** lightweight access, account state, settings.
- **Injected panel:** main chat and generation workspace inside TradingView.
- **Content script:** detects TradingView routes, finds Pine Editor, inserts code, optionally reads visible errors.
- **Background service worker:** token refresh, secure fetch, event relay, feature flags.

### Browser permissions
- tradingview.com host permissions.
- storage only if needed for non-sensitive preferences.
- identity or OAuth-related permissions depending on auth method.
- strict minimization of clipboard and tab permissions.

### UI states
- Signed out.
- Free tier active.
- Paid tier active.
- Generation loading.
- Success with code preview.
- Insertion success.
- Compile error detected.
- Quota exceeded.
- Service unavailable.

## Backend services

### API gateway
Responsibilities:
- Authenticate extension requests.
- Enforce plan limits.
- Route requests to generation, history, feedback, and billing endpoints.
- Apply rate limiting and abuse protection.

### Generation service
Responsibilities:
- Accept prompt, editor context, selected Pine version, and task type.
- Build system prompt and guardrails.
- Call model provider.
- Validate output schema.
- Return normalized response.

### Debug service
Responsibilities:
- Accept current code and error messages.
- Identify likely compile issues.
- Produce corrected code and explanation.
- Score confidence.

### Billing service
Responsibilities:
- Integrate with Stripe.
- Manage subscriptions, trials, entitlements, and webhooks.
- Update plan state in user record.

### Analytics service
Responsibilities:
- Capture product events.
- Compute funnel and retention metrics.
- Feed dashboards and alerting.

## Data model

### Core entities
- **User:** id, email, auth_provider, plan, status, created_at.
- **Workspace:** id, user_id, name, preferences.
- **Generation:** id, user_id, workspace_id, prompt, task_type, pine_version, output_code, output_summary, token_cost, compile_status, created_at.
- **Feedback:** id, generation_id, user_id, rating, comment.
- **Subscription:** id, user_id, stripe_customer_id, stripe_subscription_id, plan, renewal_at, status.
- **FeatureUsage:** id, user_id, metric_type, count, period_start, period_end.

### Storage choices
- Relational database for users, subscriptions, generations, and feedback.
- Object storage for large logs or archived generation payloads.
- Redis for rate limiting, queue state, and temporary session context.

## API design

### Example endpoints
- `POST /v1/generate`
- `POST /v1/debug`
- `POST /v1/explain`
- `GET /v1/history`
- `POST /v1/feedback`
- `GET /v1/me`
- `POST /v1/billing/checkout`
- `POST /v1/billing/webhook`

### Generate request schema
```json
{
  "prompt": "Build an RSI strategy with ATR stop loss",
  "taskType": "strategy",
  "pineVersion": "v6",
  "editorContext": {
    "currentCode": "",
    "compilerErrors": []
  }
}
```

### Generate response schema
```json
{
  "title": "RSI ATR Strategy",
  "summary": "Strategy using RSI entry logic and ATR-based risk controls.",
  "code": "//@version=6 ...",
  "assumptions": ["Long-only", "Uses close price"],
  "warnings": ["Backtest before live use"],
  "usage": {
    "requestsRemaining": 18
  }
}
```

## AI orchestration

### Prompting layers
- System prompt with Pine Script rules, safety disclaimers, formatting contract.
- Task template for generate, edit, debug, explain, refactor.
- User prompt.
- Optional context: current script, selected symbol/timeframe, compiler errors.

### Guardrails
- Require structured JSON output from model.
- Validate Pine version markers.
- Reject or retry malformed outputs.
- Run static checks for dangerous or unsupported patterns.
- Add disclaimers for educational use and no financial advice.

### Model strategy
- Premium model for paid plans.
- Lower-cost model for free plan or fallback.
- Optional second-pass repair model when output validation fails.

## TradingView integration

### DOM interaction strategy
- Use resilient selectors with fallback discovery logic.
- Detect page mode: chart view, Pine Editor open, pop-out editor, unsupported pages.
- Insert code only after explicit user click.
- Avoid brittle automation that depends on exact pixel position.

### Failure handling
- If editor is not found, show guided steps.
- If insertion fails, provide copy-to-clipboard fallback.
- If TradingView updates DOM structure, send telemetry and disable broken automation paths via feature flag.

## Security

- OAuth or magic-link login with short-lived access tokens and refresh flow.
- No API secrets in extension bundle.
- Sensitive actions routed through backend only.
- Encrypt data in transit and at rest.
- Prompt logging controls for privacy-sensitive users.
- Signed event ingestion to reduce spoofed analytics.
- Webhook signature validation for billing events.

## Compliance and legal

- Mandatory disclaimer in onboarding and generation output.
- No promise of returns or performance.
- Terms covering educational tooling only.
- Region-aware privacy and consent handling where required.

## Observability

### Product events
- Extension installed.
- User signed up.
- TradingView detected.
- Prompt submitted.
- Generation succeeded.
- Generation failed.
- Code inserted.
- Debug request submitted.
- Upgrade started.
- Subscription activated.
- Churn event.

### Technical metrics
- API latency.
- Model latency.
- Generation success rate.
- Output validation failure rate.
- Insert-to-editor success rate.
- Error rate by extension version.
- Cost per generation.

### Alerting
- Spike in failed generations.
- Drop in insertion success rate.
- Stripe webhook failures.
- TradingView selector failure surge.

## Scalability

- Queue long-running AI jobs when needed.
- Cache repeated documentation context and prompt templates.
- Separate synchronous generation path from analytics ingestion.
- Add multi-region API only after meaningful usage concentration justifies it.

## Testing

### Frontend
- Unit tests for UI state and message passing.
- Integration tests for content script and background worker.
- End-to-end tests against TradingView-like DOM fixtures.

### Backend
- API contract tests.
- Schema validation tests.
- Billing webhook tests.
- Load tests for generation endpoints.

### AI quality
- Golden prompt set for indicator generation, strategy generation, debugging, and explanation.
- Measure compile success and regression on each prompt set update.
- Human review loop for failed or low-rated outputs.

## Deployment

### Extension
- CI pipeline builds signed packages for dev, staging, production.
- Progressive rollout by extension version.
- Remote feature flags for UI and selector logic.

### Backend
- Containerized deployment on managed cloud platform.
- Separate environments for dev, staging, prod.
- Managed Postgres, Redis, object storage, and observability tooling.

## Suggested stack

### Frontend
- TypeScript.
- React for extension UI.
- Plasmo or equivalent extension framework.
- Tailwind or lightweight design system.

### Backend
- TypeScript with Node.js and NestJS or Fastify, or Python with FastAPI.
- Postgres.
- Redis.
- Stripe.
- OpenAI, Anthropic, or equivalent LLM providers behind an abstraction layer.

### Infrastructure
- Vercel, Fly.io, Railway, Render, or AWS for API deployment.
- Neon, Supabase, RDS, or Cloud SQL for Postgres.
- Sentry, PostHog, and OpenTelemetry for monitoring and analytics.

## Milestones

### Milestone 1: Prototype
- Extension UI.
- Prompt to code generation.
- Manual copy/paste fallback.

### Milestone 2: Beta
- One-click Pine Editor insertion.
- Auth, usage limits, Stripe billing.
- Prompt history and feedback.

### Milestone 3: Production
- Robust debug workflow.
- Analytics dashboards.
- Team plan support.
- Feature flags and observability hardening.

## Key technical risks

- TradingView UI changes may break integration.
- Extension review delays may slow release cycles.
- LLM cost volatility may damage gross margins.
- Inconsistent Pine Script output quality may hurt retention.
- Browser permission scope may reduce install conversion.
