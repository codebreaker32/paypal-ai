# Judging rubric

This is the fixed rubric for the internal judge. Don't edit it during a build run.

## Who the judge is
- The judge is a **separate subagent** from the workers whose output it scores. It reads this rubric and the artifacts: specs, the running app, screenshots, test output and the code. It does **not** read the workers' own notes or claims about their work.
- The judge never edits code. It scores, cites evidence and lists fixes.
- Every score cites concrete evidence: a file, a screenshot, a command and its output. Any score below 4 comes with a specific fix.
- The judge scores what it can see working. Anything it can't run or see scores 1.

## Part A: the hackathon's official criteria (equally weighted)
Taken from the PayPal AI Hackathon judging criteria (see CLAUDE.md). Score each from 1 to 5.

| # | Criterion | 1 | 3 | 5 |
|---|---|---|---|---|
| A1 | **Technological implementation:** how thoroughly and skilfully PayPal and AI are used; a working, non-trivial build | A PayPal button and a chatbot bolted on | Real sandbox calls and real AI, but shallow or brittle | PayPal is central (several APIs, verified end to end) and the AI does real work in the core flow |
| A2 | **Design:** a complete, coherent product, not just a proof of concept | Raw scaffolding or a disconnected demo | Usable flows with rough edges | Feels like a shipped product: every state is handled and the whole thing is coherent |
| A3 | **Potential impact:** a credible, specific case for a real problem and a real audience, and the build addresses it | Vague audience or invented problem | Real problem, partly addressed | Specific audience and evidenced pain, and the demo clearly solves it |
| A4 | **Innovation:** creative, novel, different from existing concepts | Copies a common or listed example idea | Familiar idea with a twist | A concept judges haven't seen, done credibly |
| A5 | **Presentation readiness:** can the flow be shown end to end in under 3 minutes and make clear the problem, the audience and why it matters | No demoable flow | Demoable, but slow or confusing | A crisp, end-to-end flow that makes an obvious "wow" moment |

## Part B: the owner's dimensions
Score each from 1 to 5. Some overlap with Part A on purpose; score them independently.

| # | Dimension | What a 5 looks like |
|---|---|---|
| B1 | **Idea** | One sentence explains it, and people immediately want it |
| B2 | **Implementation** | It runs, the tests pass, it's verified against the real sandbox, and the code is clean and maintainable |
| B3 | **Depth of idea** | Goes past the obvious first version: handles real-world messiness (bad photos, edge cases, failures) and has a believable path to scale |
| B4 | **Usefulness** | A real seller would use it this week, and it saves real time or money |
| B5 | **Innovation** | A fresh angle on agentic commerce, not a re-skin of an existing product |

## Part C: frontend quality gates
Each item passes or fails, with evidence (screenshots at 390 px and 1440 px wide). Any fail blocks a "ship" verdict.

**UI/UX principles**
- Clear visual hierarchy on every screen, with one primary action.
- Every async action has loading, success, empty and error states.
- Contrast meets WCAG 2.1 AA, everything works with the keyboard, focus states are visible, and images have alt text.
- Works at phone width with no horizontal scroll and touch targets of at least 44 px.
- Copy is plain and specific, with no jargon and no placeholder text.

**Anti-AI-slop** (judged against design-taste-frontend-v2-experimental)
- No generic AI look: no purple or blue gradients by default, no glassmorphism or glow clichés, no emoji standing in for icons.
- No default hero section that says nothing, and no three identical feature cards.
- No lorem ipsum or fake stats. Content is real or realistic.
- The design shows real choices: a deliberate type pairing, a palette tied to the product, and a consistent spacing scale.

**Frontend design**
- Design tokens (colour, type, spacing, radius) are defined once and used everywhere.
- Typography has a clear scale and comfortable line length.
- Components are consistent across screens, and motion is purposeful and subtle.

## The improvement loop
The build runs as repeated rounds of the same cycle:
1. **Workers build or fix.** The first round builds a milestone. Every round after that starts from the previous round's top 3 fixes and other critical suggestions.
2. **The judge scores** the result against this rubric, with fresh eyes, and writes `docs/judge/round-N.md`.
3. **The score must go up.** Each round appends a row to `docs/judge/SCORES.md`: round number, Part A total, Part B total, number of Part C fails, and a one-line summary of what changed. If a criterion's score drops from the round before, the workers fix that regression first, or revert the change that caused it.
4. **Every fix is accounted for.** The next round's verdict says which of the previous top 3 fixes were done and whether the score moved. A fix that didn't raise the score gets a different approach next time, not the same one again.

The loop continues until the verdict is **ship**. After that, each round looks for the next highest-value gain.

## Verdict format
Write each judging round to `docs/judge/round-N.md`:
1. A score table for A1–A5 and B1–B5, each with evidence, plus Part A's total out of 25 and Part B's total out of 25.
2. Part C as pass or fail per item, with evidence.
3. The **top 3 fixes**, ranked by how much they raise the Part A score.
4. When comparing two approaches: the winner, the scores for both, and what to **take from the loser**.
5. A verdict: **ship** (no Part C fails and Part A ≥ 20), **fix** or **rethink**.
