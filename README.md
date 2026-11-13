# The website of stelint

This repository holds the pages of stelint on GitHub Pages. The pages are
HTML files with one CSS file and one JavaScript file. They have no build
step.

## Files

| Path | Holds |
|---|---|
| `index.html`, `how.html` | The pages. |
| `assets/` | The CSS, the JavaScript and the data of the examples. |
| `examples/` | The examples of the editor, and the six sentences in `examples/cases/`. Each folder is a small project. |
| `scripts/` | The scripts that run stelint. |

## The data of the examples

Each diagnostic on the pages comes from a run of stelint. Do not write a
diagnostic into a page. After a change to an example, run this command:

```bash
scripts/build_data.py
```

The script runs stelint on each example and writes `assets/data.js`. It
stops if the last text of an example has a diagnostic. It removes the
replacements of a private word list from the help texts, because the pages
must not hold that list.

## The prose of the pages

The prose of the pages obeys the rules of stelint. To check it, run this
command:

```bash
scripts/check_prose.py
```

The script writes the text of each page as Markdown in a temporary
project with the folder `.stelint/` of this repository. Then it runs
stelint on that project.
An element with the attribute `data-nolint` is not prose of the pages.
The examples of bad text and the code have this attribute.

The two scripts use the private word list `~/.stelint/words/english.toml`.
This repository does not hold it.

## A local server

```bash
python3 -m http.server 8000
```

## License

The license of this repository is the MIT license. `LICENSE` gives its text.
