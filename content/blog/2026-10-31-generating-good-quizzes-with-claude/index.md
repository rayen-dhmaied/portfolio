---
slug: generating-good-quizzes-with-claude
title: How QuizShip Generates Good Quizzes while Keeping Subscriptions Profitable
authors: [rayen-dhmaied]
tags: [llm, claude, evals, cost, python]
---

QuizShip turns a topic or a PDF into a quiz, and Claude writes the questions. Each subscription includes a monthly number of AI generations, so every generation is a cost that comes out of the subscription's margin.

The first version cost a median of $0.037 per quiz, but a 40-question quiz took 104 seconds, past the 90-second limit for a generation. The pipeline I run now writes that quiz in about 10 seconds, at about the same cost as before. This post covers how it works, the attempts that got it there, and why it's a fixed pipeline rather than an agent. I used Claude Code to write the evaluation scripts and run the experiments.

{/* truncate */}

{/* Imports sit below the truncate marker so the blog list page doesn't bundle the figures */}

import Pipeline from './img/pipeline.svg';
import PlanAndParts from './img/plan-and-parts.svg';
import Repair from './img/repair.svg';

## How a Quiz Is Generated Today

This section and its diagrams show the pipeline as it runs now. The sections after it start from the first version and go through the attempts that led here.

Teachers pick one of six formats, such as multiple choice, crossword, cloze (fill in the blanks) or progressive (clues revealed one at a time). Two models do the writing: Claude Sonnet 5.5 at $10 per million output tokens, and Claude Opus 5.5 at $20, or $40 in fast mode.

A short quiz is one Sonnet call. A long one, meaning 8 or more multiple choice questions or 5 or more progressive ones, is planned by Opus and written by Sonnet calls in parallel. Every call reuses a cached system prompt and returns JSON that matches the format's schema. Code then fixes and checks the draft, and the questions that fail go back to Sonnet:

<figure className="diagram">
  <Pipeline />
</figure>

### Planning Long Quizzes

Each writer is a separate Sonnet call that writes one part of the quiz, 5 multiple choice or 3 progressive questions. The writers can't see each other's questions, so two of them could ask the same one. Opus first writes a plan with one line per question, and each writer gets its own lines plus the others' as topics to avoid:

<figure className="diagram">
  <PlanAndParts />
</figure>

The plan costs 1 to 5 cents. Attempt 3 below shows why it runs on Opus.

### Fixing and Checking in Code

Anything that needs no judgment is done in code, for free. Code removes extra questions, moves timings and points into the game's allowed ranges, and turns a cloze blank back into normal text when its answer appears elsewhere in the paragraph. It also shuffles the options, because Claude's own placement of the correct answer wasn't random. Then it checks what can be checked exactly, from answer counts to crossword words that cross, and ties each problem to its question.

### Repairing Only What Failed

Only the failing questions go back to Sonnet, with the rest of the quiz as context so a replacement doesn't repeat another question:

<figure className="diagram">
  <Repair />
</figure>

Regenerating the whole quiz would mean paying for every question again and risking the ones that passed. If the quiz still fails after two repair rounds, the teacher gets an error instead of a broken quiz.

---

## Where I Started

The first version was one Sonnet call for the whole quiz, the code checks, and one full retry if a check failed.

To compare versions, I generated the same 19 requests with each one, across all six formats and 2 to 40 questions. A stronger Claude model reviewed every quiz without knowing which version wrote it, and counted serious problems: wrong facts or answer keys, ambiguous questions, wording that gives the answer away, and duplicates. The first version had a serious problem in 7% of its questions. At 19 requests, one or two questions either way is noise, so I only trusted differences that held up across runs.

Any change had to keep the median cost near $0.037 without adding serious problems.

---

## Attempt 1: Opus in Fast Mode for Everything

My first attempt targeted speed and quality together: a plan and parallel writers for long quizzes, repairs limited to the failing questions, and Opus in fast mode for every call.

| | first version | attempt 1 |
|---|---|---|
| median time | 20.9 s | 9.6 s |
| 40-question quiz | 104 s | 16 s |
| questions with a serious problem | 7% | 4% |
| median cost per quiz | $0.037 | $0.15 |

It fixed both problems at four times the cost. Opus is twice Sonnet's price, fast mode doubles that, and Opus used more thinking tokens: 2,081 output tokens for a 5-question quiz against Sonnet's 787.

Standard speed halves the price, but on my requests it took about four times as long as fast mode, not twice as long, and a 40-question quiz still cost $0.44 against $0.17. The timings showed that most of the speed came from the parallel writers, not from Opus. I had changed the model and the structure together and credited the model, so next I looked for ways to keep Sonnet writing.

---

## Attempt 2: Haiku Reviewing Sonnet's Quizzes

With Sonnet writing, better quality had to come from a review step: Claude Haiku 5.5 would flag serious problems, and extra questions written up front would replace the flagged ones. I first ran Haiku over 74 quizzes the stronger reviewer had already graded. It caught 49% to 66% of the serious problems and added 5 to 47 seconds per quiz. With extended thinking turned off it was fast, but it flagged a third of the good questions.

I dropped it and kept the code checks as the only review, accepting that a wrong fact code can't detect gets through. Measuring the reviewer on graded quizzes before building it is what showed me it wasn't worth adding.

---

## Attempt 3: Sonnet Planning and Writing

Sonnet writes 5 questions in about 6 seconds, faster than Opus in fast mode, so I let it write the plan too. On the 11 requests this changed, the cost matched the first version, but serious problems doubled, from 6 to 12 of 122 questions, and 11 of the 12 were in quizzes written in parts. Four were duplicates, such as two parts asking the same question about muscles and oxygen, so Sonnet's plan wasn't preventing overlap between parts.

---

## Attempt 4: Opus Plans, Sonnet Writes

The plan is only 2% to 16% of a long quiz's output, so running it on Opus adds little to the cost. I moved the plan back to Opus in fast mode and kept Sonnet for every question. This is what runs in production now:

| on the 19 test requests | first version | now |
|---|---|---|
| total cost | $0.88 | $0.91 |
| median time | 20.9 s | 14.2 s |
| slowest quiz | 104 s | 35 s |
| 40-question quiz | 104 s, $0.17 | 9.9 s, $0.14 |

On the long quizzes, the only ones written differently, the reviewer found 5 serious problems in 106 questions, the same as the first version, and no duplicates. The rule I took from this is to spend on the strongest model where its output is short and everything after it depends on it.

---

## What I Gave Up

Attempt 1 had fewer serious problems (4% against 7%) and a faster median (9.6 s against 14.2 s). I gave both up because it cost four times as much, and 5 seconds doesn't change whether a teacher can use the quiz.

Parallel writers made long quizzes up to ten times faster, but they also produced more small problems, 51 against 19, such as a wrong answer that's easy to rule out. Serious problems didn't change, so I kept them.

On cloze, Opus made a third as many serious problems as Sonnet, at five to eight times the price. In all of Sonnet's serious cloze problems the text gave the answer away, and several were blanks whose answer appeared elsewhere in the paragraph, so I fixed that case in code and kept Sonnet.

---

## Why I Didn't Build an Agent

The obvious alternative was an agent: give Claude tools to plan, write, check and repair, and let it loop until the quiz passes. But the steps are known before a request starts, and the attempts above settled each decision by measurement. An agent would make those decisions again on every request, pay tokens for them, and could decide differently for two identical requests. Fixed decisions also made the experiments comparable: attempts 3 and 4 differ in one setting, so I know the plan's model removed the duplicates.

The 90-second limit is another reason. The pipeline's slowest path is known, and each call gets the remaining time as its timeout. An agent picks its own number of turns and adds every result to its context, so each turn sends a longer prompt and costs more than the last. An agent fits work that has to find its own material, like searching a teacher's documents or checking facts online.

LangChain can make every call this pipeline makes, so the question is what it would add. It's the right call when you use several model providers and want to switch or fall back between them, when you need LangGraph's persistence for long-running agents, when you want LangSmith's tracing, or when you build retrieval-augmented generation (RAG) on its document loaders and retrievers. QuizShip uses one provider, finishes each request within 90 seconds, logs its own usage and works from what the teacher provides. LangChain would only replace the function that builds each request, and the code that runs the steps would still be mine to write:

```python
def _request(model, schema, effort):
    request = {
        "model": model,
        "max_tokens": 32000,
        "system": SYSTEM,  # the shared rules, cached
        "output_config": {"format": {"type": "json_schema", "schema": schema}, "effort": effort},
        # on a refusal, the API retries the request on another model
        "betas": ["server-side-fallback-2026-07-01"],
        "fallbacks": "default",
    }
    if model == "claude-opus-5-5":
        request["speed"] = "fast"
        request["betas"].append("fast-mode-2026-02-01")
    return request
```

The tests swap the SDK client for a fake one, so every branch, including refusals, rate limits, repairs and timeouts, runs without calling Claude.
