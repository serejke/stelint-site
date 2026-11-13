# The language of the website

These rules apply to each text that a person reads in this repository: the
pages, the captions in `assets/site.js`, the README and the commit messages.
`no-ai-slop.md` gives the patterns that you must not write.

## Rules for each text

1. The prose of each page must pass stelint. After each change to a page, run
   `scripts/check_prose.py`.
2. Write one fact or one instruction in each sentence.
3. Use the active voice.
4. Use one name for one object in all texts.
5. The prose of a rule file in `.claude/rules/` must also pass stelint. To
   check it, run `stelint --root . .claude/rules/`. Put a word that stelint
   does not accept in a code span, for example `leverage`.

## The message

1. Show the problem before stelint. The first text that a reader sees tells
   the problem that occurs without stelint.
2. Tell the reader the type of tool that stelint is, with a word that they
   know. For example, write linter or type checker. Do not make a new type of
   tool.
3. Each fact about stelint must be correct for its last release. Do not write
   that stelint does a check that it does not do. For example, stelint does not
   find two instructions that do not agree.
4. A text before the check must be bad for each reader. An engineer who knows
   the code must agree that it is bad. Do not show a good text that stelint
   does not accept, because then the reader does not see the problem.
5. A caption tells only the errors that stelint found in that text.

## The captions

The captions in `assets/site.js` have the attribute `data-nolint`, and
stelint does not check them. They can use words that are not approved. The
rules of `no-ai-slop.md` apply to them.
