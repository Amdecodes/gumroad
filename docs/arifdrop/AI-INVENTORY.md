# ArifDrop AI Functionality Audit

**Project**: ArifDrop (Gumroad fork for Ethiopia)  
**Date**: October 2026  
**Auditor**: Antigravity Assistant  
**Repository Baseline**: `antiwork/gumroad` (`cc4d616c7`)

---

## 1. Executive Summary

Gumroad contains an extensive, sophisticated AI surface spanning conversational store assistants, automated product generator tools, MCP (Model Context Protocol) endpoints for external AI agents (Claude, ChatGPT, Muse), and background moderation/classification pipelines.

All AI features incur direct API token costs (billed through OpenAI, Vercel AI Gateway, or OpenRouter) and contain hard-coded eligibility barriers (e.g. requiring confirmed seller status, completed payouts, and at least $100 USD in historical sales).

For ArifDrop's launch in Ethiopia:

- Platform automation that improves safety (e.g. Content Moderation) should be evaluated.
- Cost-heavy and English-centric generative features (Store Agent, Product Generator) should be **feature-flagged off** for MVP launch to avoid uncontrolled foreign-currency API expenses and broken UI flows.
- Dead / experimental code should be marked for removal later.

---

## 2. Customer-Facing AI Capabilities

### 2.1 Conversational Store Agent (`/agent`, `/internal/agent/*`, `/mobile/agent/*`)

- **Description**: An interactive conversational assistant embedded in the seller dashboard and mobile apps. It allows creators to ask natural language questions about their sales and catalog and _propose_ store mutations (e.g., updating landing page copy, creating discounts, tweaking layouts).
- **Routes & Endpoints**:
  - `GET /agent` -> `AgentController#index`
  - `POST /internal/agent/messages` -> `Api::Internal::AgentMessagesController#create`
  - `POST /internal/agent/messages/stream` -> `Api::Internal::AgentMessageStreamsController#create`
  - `POST /internal/agent/actions` -> `Api::Internal::AgentMessagesController#execute`
  - `GET /internal/agent/actions/status` -> `Api::Internal::AgentConversationsController#action_status`
  - `GET /internal/agent/conversations/latest` -> `Api::Internal::AgentConversationsController#latest`
  - `GET /internal/agent/turns/:client_turn_id` -> `Api::Internal::AgentConversationsController#turn_status`
  - `POST /internal/agent/custom_html_preview` -> `Api::Internal::AgentCustomHtmlPreviewsController#create`
  - `GET /internal/agent/custom_html_previews/:token` -> `Api::Internal::AgentCustomHtmlPreviewsController#show`
  - `GET /api/mobile/agent/meta` -> `Api::Mobile::AgentController#meta`
  - `GET /api/mobile/agent/conversations/latest` -> `Api::Mobile::AgentController#latest_conversation`
  - `GET /api/mobile/agent/turns/:client_turn_id` -> `Api::Mobile::AgentController#turn_status`
  - `POST /api/mobile/agent/messages` -> `Api::Mobile::AgentController#create`
  - `POST /api/mobile/agent/messages/stream` -> `Api::Mobile::AgentStreamsController#create`
  - `POST /api/mobile/agent/actions` -> `Api::Mobile::AgentController#execute`
- **Underlying Models & Services**:
  - `Ai::StoreAgentService` (`app/services/ai/store_agent_service.rb` - 103 KB): System prompt, 25-turn loop, read/write tool dispatcher.
  - `Ai::AnthropicClient` (`app/services/ai/anthropic_client.rb` - 32 KB): Client calling Vercel AI Gateway or OpenRouter.
  - `Ai::StoreAgentApiClient` (`app/services/ai/store_agent_api_client.rb`): OAuth-scoped client executing internal reads.
  - `Ai::StoreAgentActionExecutor` (`app/services/ai/store_agent_action_executor.rb`): Mutates store records once the seller clicks "Confirm".
  - `Ai::StoreAgentApiCatalog` (`app/services/ai/store_agent_api_catalog.rb` - 37 KB): Declarative registry of allowable read/write API endpoints.
  - `AiConversation`, `AiMessage` (`app/models/ai_conversation.rb`, `app/models/ai_message.rb`): Database persistence of conversation history.
- **Providers & Models**:
  - Primary: Anthropic `claude-opus-4-7` (fallback: `anthropic/claude-opus-5`).
  - Fallback: `~openai/gpt-latest` via OpenRouter.
  - Ramped alternatives: `x-ai/grok-4.5`, `deepseek/deepseek-v4.1-flash`.
- **Feature Flags & Gating**:
  - `store_agent_grok`, `store_agent_deepseek`, `store_agent_deepseek_no_hidden_reasoning`, `store_agent_deepseek_ttft_deadline`.
  - Eligibility Gate: `User#eligible_for_store_agent?` in `app/models/user.rb:1529`. Requires `confirmed?`, `!suspended?`, `has_completed_payouts?`, and `sales_cents_total >= 10_000` ($100 USD).
- **Environment Variables**:
  - `STORE_AGENT_AI_GATEWAY_API_KEY`: Vercel AI Gateway.
  - `STORE_AGENT_OPENROUTER_API_KEY`, `OPENROUTER_API_KEY`: OpenRouter.
- **Cost / Billing**: Billed per token (input/output) to platform API accounts. High cost per conversation turn (especially with Opus and 25-turn caps).
- **ArifDrop Recommendation**: **FEATURE-FLAG-OFF**  
  _Rationale_: High USD API costs, complex English prompts, reliance on USD earnings gates, and non-essential for initial marketplace liquidity in Ethiopia.

---

### 2.2 AI Product Details & Content Generator (`/internal/ai_product_details_generations`)

- **Description**: A creation helper on the product edit screen that takes a short text prompt (e.g. "Create an ebook about coffee brewing in Sidama") and automatically drafts product name, description, summary, native type, price, cover image, and full Tiptap rich content chapters.
- **Routes & Endpoints**:
  - `POST /internal/ai_product_details_generations` -> `Api::Internal::AiProductDetailsGenerationsController#create`
  - `POST /settings/dismiss_ai_product_generation_promo` -> `Settings::DismissAiProductGenerationPromosController#create`
- **Underlying Models & Services**:
  - `Ai::ProductDetailsGeneratorService` (`app/services/ai/product_details_generator_service.rb` - 10 KB)
- **Providers & Models**:
  - OpenAI `gpt-4o-mini` (product details extraction and Tiptap rich content pages).
  - OpenAI `gpt-image-1` / DALL-E (1024x1024 cover image generation).
- **Throttling & Eligibility**:
  - Rate limit: 10 requests per hour per seller via Redis (`RedisKey.ai_request_throttle`).
  - Eligibility: `User#eligible_for_ai_product_generation?` in `app/models/user.rb:1515`. Requires `sales_cents_total >= 10_000` ($100 USD) and `has_completed_payouts?`.
- **Environment Variables**:
  - `OPENAI_ACCESS_TOKEN` (`config/initializers/openai.rb`).
- **Cost / Billing**: Moderate per-generation cost (gpt-4o-mini is low-cost, image generation is ~$0.04/image).
- **ArifDrop Recommendation**: **FEATURE-FLAG-OFF**  
  _Rationale_: Hardcoded to check USD sales, generates US/English-centric defaults, and requires OpenAI USD payment account. Turn off for MVP.

---

### 2.3 External Agent Connectors & MCP (`/muse`, `/claude`, `/chatgpt`)

- **Description**: Model Context Protocol (MCP) server endpoints allowing external AI assistants (such as Anthropic's Claude Desktop / Code, ChatGPT plugins, or Meta Muse) to connect to a creator's Gumroad store over OAuth2 and list products, create drafts, publish products, check sales, and inspect payouts.
- **Routes & Endpoints**:
  - `GET /muse`, `GET /claude` -> `McpConnectorsController#show`
  - `GET /:client/v1/status` -> `Api::V2::MuseController#status`
  - `GET /:client/v1/oauth2/authorize` -> `Oauth::AuthorizationsController#new`
  - `POST /:client/v1/oauth2/token` -> `Oauth::TokensController#create`
  - `POST /:client/v1/oauth2/register` -> `Api::V2::MuseController#register`
  - `POST /:client/v1/mcp` -> `Api::V2::MuseController#mcp` (JSON-RPC MCP protocol)
  - `GET /.well-known/mcp.json` -> `Api::V2::MuseController#mcp_discovery`
  - `GET /.well-known/openai-apps-challenge` -> `Api::V2::MuseController#openai_apps_challenge`
  - `GET /.well-known/oauth-authorization-server` -> `Api::V2::MuseController#oauth_metadata`
  - `GET /.well-known/oauth-protected-resource` -> `Api::V2::MuseController#protected_resource_metadata`
- **Underlying Models & Services**:
  - `Muse::Mcp` (`app/services/muse/mcp.rb` - 14 KB): JSON-RPC handler for `get_account`, `list_products`, `get_product`, `create_draft_product`, `publish_product`, `unpublish_product`, `list_sales`, `list_payouts`.
  - `Muse::DynamicClientOauth` (`app/services/muse/dynamic_client_oauth.rb`).
  - `Muse::OauthClientRegistration` (`app/services/muse/oauth_client_registration.rb`).
- **Providers & Models**: None directly invoked server-side; this exposes Gumroad's API to client-side LLMs via standard JSON-RPC protocol version `2025-03-26`.
- **Hard-coded Currency Issue**: `Muse::Mcp#tool_list_sales` hardcodes `currency: Currency::USD` on line 284!
- **ArifDrop Recommendation**: **KEEP**  
  _Rationale_: Zero platform LLM cost (the client pays for tokens), standard open API surface for advanced developers, but line 284 must be noted for currency fix.

---

## 3. Internal Developer & Platform Automation AI

### 3.1 Content Moderation Classifier & Prompt Strategies

- **Description**: Automated content screening that checks product title, description, rich text, and cover images for policy violations (adult content, violence, fraud, hate speech) upon publish or update.
- **Files**:
  - `app/services/content_moderation/moderate_record_service.rb`
  - `app/services/content_moderation/strategies/classifier_strategy.rb`: Uses OpenAI moderation API to batch-evaluate text and images.
  - `app/services/content_moderation/strategies/prompt_strategy.rb`: Uses custom prompts against OpenAI to classify edge-case content.
  - `app/services/content_moderation/content_extractor.rb`
- **Providers & Keys**: `OPENAI_ACCESS_TOKEN`.
- **ArifDrop Recommendation**: **EVALUATE**  
  _Rationale_: Useful safeguard against abusive marketplace uploads, but requires active OpenAI account and English/multilingual moderation accuracy for Ethiopian content (Amharic text). Can be replaced with rule-based or human admin review initially.

---

### 3.2 Username Generator Service

- **Description**: Suggests available, clean usernames when a creator signs up based on their name.
- **Files**:
  - `app/services/username_generator_service.rb`: Calls `OpenAI::Client.new.chat` with a prompt to suggest creative usernames.
- **Providers & Keys**: `OPENAI_ACCESS_TOKEN`.
- **ArifDrop Recommendation**: **REMOVE-LATER**  
  _Rationale_: Extreme overkill to invoke an LLM for simple username slug generation; standard regex/parameterize handles this reliably and without API latency or cost.

---

### 3.3 Year in Review Email Generator Job

- **Description**: Annual marketing summary generating personalized creator highlights using an LLM.
- **Files**:
  - `app/sidekiq/send_year_in_review_email_job.rb`: Invokes `gpt-4o-mini` to write custom congratulatory blurbs.
- **Providers & Keys**: `OPENAI_ACCESS_TOKEN`.
- **ArifDrop Recommendation**: **REMOVE-LATER**  
  _Rationale_: Seasonal, non-core marketing job that adds external dependencies.

---

## 4. Summary Table of AI Inventory & Recommendations

| Feature Component              | Surface / Route                                        | Provider & Model                                     | Cost Driver           | ArifDrop Status      |
| :----------------------------- | :----------------------------------------------------- | :--------------------------------------------------- | :-------------------- | :------------------- |
| **Conversational Store Agent** | `/agent`, `/internal/agent/*`, `/mobile/agent/*`       | Anthropic Opus, Grok, DeepSeek via Vercel/OpenRouter | High (multi-turn LLM) | **FEATURE-FLAG-OFF** |
| **Product Details Generator**  | `/internal/ai_product_details_generations`             | OpenAI `gpt-4o-mini`, `gpt-image-1`                  | Medium (image + text) | **FEATURE-FLAG-OFF** |
| **MCP Connectors**             | `/{muse,claude,chatgpt}/v1/*`, `/.well-known/mcp.json` | None (server-side JSON-RPC protocol)                 | Zero server LLM cost  | **KEEP**             |
| **Content Moderation**         | Background upon product publish                        | OpenAI Moderation API                                | Low (cents per batch) | **EVALUATE**         |
| **Username Generator**         | `UsernameGeneratorService`                             | OpenAI chat                                          | Low                   | **REMOVE-LATER**     |
| **Year-In-Review Generator**   | `SendYearInReviewEmailJob`                             | OpenAI `gpt-4o-mini`                                 | Low                   | **REMOVE-LATER**     |
