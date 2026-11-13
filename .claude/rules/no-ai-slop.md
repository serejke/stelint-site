# The patterns of agent text that you must not write

Agents write these patterns frequently. They add no fact, and a reader who
sees them does not read more. Do not write them in a page, a caption, a text
after the check, the README or a commit message.

A text before the check can have these patterns, because it shows the problem.

Each rule has a name in a code span. When you find a pattern in a text, write
the name of its rule.

## Words

### `slop-praise`

Do not use an adjective that only tells that a tool is good. Give a fact that
the reader can examine.

- Do not write: `blazing-fast`, `powerful`, `robust`, `seamless`,
  `cutting-edge`, `state-of-the-art`, `world-class`, `game-changing`.
- Write: The check uses no network.

### `slop-verb`

Do not use a long verb if a short verb has the same meaning.

- Do not write: `leverage`, `utilize`, `empower`, `unlock`, `elevate`,
  `streamline`, `harness`, `supercharge`, `delve`, `foster`, `facilitate`.
- Write: use, start, make, give, show.

### `slop-noun`

Do not use a general noun for one object. Write the name of the object.

- Do not write: `landscape`, `realm`, `journey`, `ecosystem`, `tapestry`,
  `synergy`, `paradigm`, `solution`.
- Write: the comments of your project.

### `slop-easy`

Do not tell the reader that a step is easy. If the step is hard for the
reader, these words make the reader feel bad.

- Do not write: `simply`, `just`, `easily`, `super easy`, `obviously`,
  `of course`, `that's it`.
- Write: Run `stelint init`.

### `slop-hedge`

Do not write a word that makes a fact not clear. Give the limit or the
condition.

- Do not write: `probably`, `generally`, `typically`, `arguably`,
  `should be fine`, `may potentially`.
- Write: A descriptive sentence has a maximum of 25 words.

### `slop-signpost`

Do not tell the reader that a fact comes. Write the fact.

- Do not write: `it's important to note`, `it's worth noting`, `note that`,
  `keep in mind`, `let's dive in`, `here's the thing`, `in conclusion`.

### `slop-quantity`

Do not write a quantity that has no number. Give the number or the list.

- Do not write: `various`, `numerous`, `a wide range of`, `countless`,
  `a variety of`.
- Write: stelint reads the comments of Rust files and Markdown files.

### `slop-helper`

Write the verb that tells the work. Do not put an empty verb before it.

- Do not write: `allows you to`, `enables you to`, `helps you`, `ensures`,
  `makes it easy to`.
- Write: stelint fails the check on a bad sentence.

### `slop-person`

Do not write that a program thinks or feels. Write the steps that the program
does.

- Do not write: `stelint understands`, `stelint knows`, `stelint cares about`.
- Write: stelint finds the word in the project dictionary.

## Sentences and headings

### `slop-count`

Use a number only to count objects that the reader sees on the page. A number
in a heading must not tell the reader that the list has all the items.

- Do not write: `Six errors that agents make`, `3 reasons to use`,
  `The 5 pillars of`.
- Write: These sentences look correct in a diff.

### `slop-three`

Do not write three adjectives or three phrases only for the sound of the
sentence. Write each fact in its sentence.

- Do not write: `fast, simple, and reliable`.
- Write: stelint uses no network. The same text always gets the same
  diagnostics.

### `slop-contrast`

Do not write an incorrect sentence that no reader agrees with, only to
correct it. You can compare two tools that a reader can use.

- Do not write: `It's not just a linter. It's a new way to write.`
- Do not write: `Docs aren't about words. They're about trust.`
- Write: A rule in `CLAUDE.md` is a request. A failed check is not.

### `slop-question`

Do not start a text with a sentence that has `?` at its end. Write the fact.

- Do not write: `Tired of unclear docs?`, `What if your agent wrote clearly?`,
  `The result?`, `Why does this matter?`

### `slop-dash`

Do not use `—` in prose. Write two sentences.

- Do not write: `One check — zero LLM calls.`
- Write: The check has no LLM.

### `slop-mark`

Do not use `!` in prose. Do not use a symbol in prose, for
example `🚀` or `✨`.

- Do not write: `That's it!`, `🚀 Quick start`, `✨ Features`.

### `slop-echo`

Do not write the heading again in the first sentence. Do not write the facts
of a section again at its end.

- Do not write: `In short,`, `To sum up,`, `In summary,`.

### `slop-bold`

Use `**` on a maximum of one sentence in each section.

### `slop-sell`

Do not write words that only make the reader feel good. Write as an engineer
who shows a tool to an engineer.

- Do not write: `Great question`, `Happy coding!`, `We've got you covered`,
  `Get started today!`, `Whether you're a beginner or an expert`.

## Facts

### `slop-claim`

Each fact must be correct. The reader must have a method to examine it. Do not
compare stelint with all other tools. Do not write a number that you did not
measure.

- Do not write: `the best`, `the only`, `10x faster`, `never fails`.
- Write: The same text always gets the same diagnostics.
