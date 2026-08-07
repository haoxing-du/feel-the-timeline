# Feel the Timeline — Hackathon Roadmap

## Product promise

Choose a date from November 5, 2019 onward, arrive in the world of that day, and interact with a representative AI model using the interface it actually had at the time. Older completion models must remain completion models; the site must not disguise them as modern chat assistants.

## Core experience

1. Ask for a birth year (optional and stored only in the browser).
2. Let the visitor choose a date from November 5, 2019 through today.
3. Play a short, skippable arrival sequence:
   - “You were X years old.”
   - Major headline from that day.
   - Music or pop-culture snapshot.
   - Selected world leaders.
   - Bitcoin and major-market snapshot when available.
4. Reveal the frontier/open-model exhibit available on that date.
5. Explain the model’s native interaction style, then let the visitor use it.
6. Allow the date to be changed without repeating onboarding.
7. After a historical response, offer “Compare with today.”

## Model exhibit manifest

The selected model is the newest verified exhibit with a release date on or before the visitor’s date. We do not force a new model into every calendar year when no trustworthy hosted checkpoint is available.

| Available from | Exhibit | Provider | Native experience | Status |
| --- | --- | --- | --- | --- |
| 2019-11-05 | GPT-2 XL 1.5B | Replicate community wrapper | Text continuation | Candidate; verify unsteered output |
| 2021-06-09 | GPT-J 6B | Replicate | Text continuation | Hosted and verified available |
| 2022-10-20 | FLAN-T5 XL 3B | Replicate | Independent, single-turn text-to-text instructions | Hosted and verified available |
| 2023-07-18 | Llama 2 13B Chat | Featherless | Multi-turn chat | Hosted and verified available |
| 2024-07-23 | Llama 3.1 8B Instruct | Featherless | Stronger multi-turn chat | Hosted and verified available |
| 2025-01-20 | DeepSeek-R1 Distill Qwen 14B | Featherless | Visible reasoning followed by an answer | Hosted and verified available |
| 2026-03-02 | Qwen 3.5 9B | Featherless | Modern multimodal/reasoning model, initially text-only here | Hosted and verified available |

For GPT-2, the activation-steering coefficient must be `0`. Generation should explicitly use temperature `1`, top-p `1`, and frequency penalty `0`; the endpoint is not accepted until its behavior is compared with an unmodified GPT-2 XL checkpoint.

## Build checklist

### 0. Research and decisions

- [x] Define the product around historical AI capability, not simulated knowledge cutoffs.
- [x] Research representative open/open-weight models from 2019–2026.
- [x] Overlay the exhibit models with OpenAI and Anthropic releases.
- [x] Preserve native interaction modes across eras.
- [x] Select Replicate and Featherless for the hosted-inference MVP.
- [x] Replace BLOOMZ with hosted FLAN-T5 XL for the 2022 exhibit.
- [ ] Smoke-test every selected endpoint with fixed prompts and record latency/output.
- [ ] Accept or replace the GPT-2 community wrapper after fidelity testing.

### 1. Specification and foundation

- [ ] Choose the web stack and deployment target.
- [ ] Define the model manifest schema: release date, provider ID, mode, parameters, prompt formatting, limits, and attribution.
- [ ] Define the historical-day schema and fallback behavior for missing data.
- [ ] Create the application shell and responsive visual system.
- [ ] Add environment validation for provider keys without exposing them to the browser.

### 2. Arrival experience

- [ ] Build optional birth-year onboarding and local-only persistence.
- [ ] Build accessible date selection constrained to the supported range.
- [ ] Calculate age correctly around birthdays; use “about X” when only a birth year is known.
- [ ] Build the animated, skippable arrival sequence.
- [ ] Add reduced-motion support.
- [ ] Make historical facts cite their sources and degrade gracefully when unavailable.

### 3. Historical context

- [ ] Select reliable sources/APIs and confirm hackathon usage rights.
- [ ] Add one major headline with publication and link.
- [ ] Add a music snapshot (for example, chart leader or latest major release).
- [ ] Add selected world leaders for the chosen date.
- [ ] Add Bitcoin, S&P 500, and one or two recognizable stock snapshots.
- [ ] Cache date-level results so repeated visits do not repeat external calls.
- [ ] Clearly distinguish “on that date,” prior market close, and publication date.

### 4. Model gateway

- [ ] Add server-only Replicate integration.
- [ ] Add server-only Featherless integration.
- [ ] Normalize streaming, errors, timeouts, and usage without normalizing model behavior.
- [ ] Route dates to the newest eligible model release.
- [ ] Pin exact Replicate model versions and exact Featherless model IDs.
- [ ] Apply per-IP/session limits and maximum generation lengths.
- [ ] Show a useful “waking up this old model” state for cold starts.

### 5. Era-native interaction

- [ ] GPT-2/GPT-J: present a document-completion canvas, not chat bubbles.
- [ ] FLAN-T5: present independent single-turn tasks without invented memory.
- [ ] Llama 2/Llama 3.1: use their documented chat templates.
- [ ] DeepSeek-R1: visually separate reasoning from the final answer.
- [ ] Qwen 3.5: begin with text; add multimodality only as a stretch goal.
- [ ] Provide small era-appropriate example prompts without silently improving user input.
- [ ] Add “Compare with today” outside the historical transcript.

### 6. Trust, safety, and privacy

- [ ] Keep birth information optional, local-only, and easy to clear.
- [ ] Warn that archival models can generate biased, explicit, false, or incoherent text.
- [ ] Do not add hidden system prompts that improve historical models.
- [ ] Do not expose API keys or provider error details to visitors.
- [ ] Add basic abuse controls without altering the historical model’s displayed capability.
- [ ] Publish model provenance, substitutions, parameters, and known fidelity limitations.

### 7. Quality and launch

- [ ] Test the day before, day of, and day after every model release boundary.
- [ ] Test missing historical data, provider downtime, rate limits, and cold starts.
- [ ] Test mobile, keyboard navigation, screen readers, and reduced motion.
- [ ] Add lightweight analytics for arrival completion, model reveal, first prompt, and date changes.
- [ ] Prepare a seeded demo path in case a provider is slow during judging.
- [ ] Deploy and run an end-to-end production smoke test.

## MVP completion criteria

The MVP is ready when a new visitor can enter an optional birth year, choose any supported date, complete or skip the arrival sequence, see sourced historical context, and successfully interact with the correct era-native model. Every model transition date must route correctly, secrets must remain server-side, and the experience must survive a provider timeout without breaking the page.

## Explicitly deferred

- Full profiles, accounts, or server-side storage of personal information.
- Dates before GPT-2 XL’s full release.
- A unique model for every calendar year.
- A comprehensive news archive or large country list.
- Voice, image, and computer-use interfaces.
- Self-hosted inference unless a selected public endpoint becomes unusable.
