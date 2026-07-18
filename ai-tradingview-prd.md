# Product Requirements Document

## Product overview

**Working company name:** TradePilot AI  
**Product:** AI Chrome extension for TradingView with an AI Pine Script generator  
**Category:** Browser extension / trading productivity software / developer-assist tool

TradePilot AI is a Chrome extension that lives inside TradingView and helps traders describe an indicator or strategy in plain English, then generates runnable Pine Script for the TradingView Pine Editor. The product should also help users fix syntax errors, refactor scripts, explain code, and iterate quickly without leaving their charting workflow.

## Problem

Retail traders and strategy builders often know what they want to test, but they do not know Pine Script well enough to build it quickly. Existing workflows require switching between TradingView, documentation, forums, and general AI tools. That creates friction, low-quality code, and repeated debugging work.

## Product vision

Build the fastest path from trading idea to working Pine Script inside TradingView.

## Goals

- Turn plain-English strategy descriptions into valid Pine Script.
- Reduce time-to-first-working-script from hours to minutes.
- Increase successful script generation and first-pass compile rates.
- Keep users inside TradingView instead of pushing them to external chat tools.
- Create a paid SaaS business through subscriptions tied to extension usage.

## Non-goals

- Executing trades or placing broker orders.
- Providing financial advice or trade recommendations.
- Guaranteeing profitability of generated scripts.
- Replacing TradingView itself.
- Supporting all charting platforms in v1.

## Target users

### Primary users
- Beginner and intermediate traders who use TradingView and want custom indicators or strategies.
- Non-programmers who can describe trading logic but cannot write Pine Script.
- Strategy hobbyists who frequently iterate on entry, exit, and risk rules.

### Secondary users
- Advanced Pine Script users who want faster drafting, refactoring, and debugging.
- Trading educators and content creators who build sample strategies.
- Small trading communities that want internal templates and reusable scripts.

## Core value proposition

Users can describe a strategy in natural language and receive Pine Script that is ready to paste, run, and improve inside TradingView.

## User stories

- As a trader, I want to describe a strategy in plain English so I can generate Pine Script without coding from scratch.
- As a user, I want one-click insertion into the Pine Editor so I do not need to copy and paste between tools.
- As a user, I want AI error fixing so I can resolve compiler issues quickly.
- As a user, I want code explanations so I can learn what the generated script does.
- As a paid subscriber, I want saved prompt history and reusable templates so I can iterate faster.
- As a team admin, I want seat management and usage controls so I can manage multiple users.

## Jobs to be done

- Generate a new indicator from a text prompt.
- Generate a new strategy from a text prompt.
- Edit an existing Pine Script file.
- Debug compiler errors.
- Convert a high-level idea into configurable inputs and alerts.
- Optimize prompt-to-script iteration speed.

## Features

### MVP
- Chrome extension UI injected into TradingView.
- Secure user sign-in.
- Prompt box for natural-language strategy and indicator requests.
- AI-generated Pine Script output.
- One-click insert into Pine Editor.
- Error detection and AI fix suggestions.
- Code explanation panel.
- Prompt history.
- Usage metering and plan gating.
- Basic billing integration.
- Feedback controls: thumbs up/down on output.

### Post-MVP
- Strategy templates library.
- Multi-turn context memory per workspace.
- Script refactoring modes: simplify, optimize, comment, modularize.
- Version compare and rollback.
- Team workspace.
- Shared prompt libraries.
- Alert rule generation.
- Backtest interpretation summaries.
- Suggested parameters and optimization workflows.
- Web dashboard outside the extension.

## Functional requirements

### Extension experience
- The extension must detect when a user is on TradingView.
- The extension must render a persistent side panel or floating assistant.
- The extension must read editor content only after explicit user permission or action.
- The extension must insert generated code into the Pine Editor reliably.

### AI generation
- The system must convert user prompts into Pine Script compatible with the selected Pine version.
- The system must support at least indicators and strategies.
- The system must return structured output: title, summary, code, assumptions, warnings.
- The system must allow follow-up edits such as “add stop loss” or “convert to strategy.”

### Debugging
- The system must parse compiler errors pasted by the user or captured from the editor view.
- The system must propose fixes and explain the root cause.
- The system must preserve user intent while fixing code.

### Account and billing
- The system must support free and paid tiers.
- The system must meter requests, tokens, and premium actions.
- The system must manage subscriptions and plan entitlements.

### Admin and analytics
- The system must log generation events, failures, compile success, and retention events.
- The system must provide dashboards for product and support teams.

## User flow

1. User installs Chrome extension.
2. User creates account or signs in.
3. User opens TradingView and launches the assistant.
4. User enters a prompt such as “Build an RSI plus EMA crossover strategy with ATR stop loss.”
5. AI returns Pine Script, explanation, and warnings.
6. User inserts the script into Pine Editor.
7. User runs compile and backtest.
8. If errors occur, user asks for fixes.
9. User upgrades after hitting usage limits or needing premium features.

## Success metrics

### Product KPIs
- Weekly active users.
- Prompt-to-insert conversion rate.
- First-pass compile success rate.
- Average time from prompt to runnable script.
- Day-7 and day-30 retention.
- Free-to-paid conversion.
- Net revenue retention for teams.

### Quality KPIs
- Script acceptance rating.
- Error-fix success rate.
- Hallucination or invalid-code rate.
- Support tickets per 100 active users.

## Pricing concept

### Free
- Limited generations per month.
- Basic prompt history.
- Standard model quality.

### Pro
- Higher usage limits.
- Better model quality.
- Multi-turn editing.
- Debugging and refactoring tools.
- Priority support.

### Team
- Shared seats.
- Workspace templates.
- Admin dashboard.
- Centralized billing.

## Risks

- TradingView DOM changes may break extension injection.
- AI may generate invalid or non-performant Pine Script.
- Users may treat the product as financial advice.
- High inference costs may hurt margins.
- Compliance messaging may be insufficient in some jurisdictions.
- Platform policy changes in Chrome Web Store may affect distribution.

## Trust and safety

- Clear disclaimer that output is educational software assistance, not investment advice.
- No claims of guaranteed profits.
- Data minimization for chart and script access.
- Opt-in telemetry.
- Abuse controls for prompt injection and credential leakage.

## Launch plan

### Phase 1
- Private alpha with 25 to 50 active TradingView users.
- Focus on insertion reliability and compile quality.

### Phase 2
- Public beta with self-serve onboarding and Stripe billing.
- Add prompt history, debugging, and basic analytics.

### Phase 3
- Scale acquisition through creators, affiliates, SEO, and TradingView-adjacent communities.
- Add team plan and stronger retention loops.

## Open questions

- Should the product support Pine v5 only at launch or the newest available Pine version?
- Should generated code be cloud-saved by default or local-session only?
- How much editor access should be automatic versus user-triggered?
- Is the initial wedge better as a Pine generator, a full TradingView copilot, or both?
