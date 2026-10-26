#!/usr/bin/env bash
set -u
cd "$(dirname "$0")/../.." || exit 2

# First and last 40 characters of the 1503-character runtime default block.
first='### Work Type & Proportionate Paths:(?:\\n|\n)- L'
last='uman authority over release and closure\.'
# Match an expanded undecided paragraph, with either literal or escaped newlines.
# The sole renderer interpolates the shared evidence constant instead of duplicating it.
paragraph='(?s)### Work Type & Proportionate Paths:(?:\\n|\n)- Labels.{0,80}?are the only work-type source\.(?:\\n|\n)- When both or neither.{0,1800}?Both paths keep existing evidence rules and existing human authority over release and closure\.'

printf 'First 40-character pattern: %s\n' "$first"
/bin/grep -RPozn "$first" panel/ | tr '\0' '\n'
printf 'Last 40-character pattern: %s\n' "$last"
/bin/grep -RPon "$last" panel/
printf 'Full paragraph grep: /bin/grep -RPozl %q panel/\n' "$paragraph"
/bin/grep -RPozl "$paragraph" panel/
status=$?
printf 'Current duplicate paragraph exit=%s (1 = absent)\n' "$status"
[[ "$status" == 1 ]] || exit 1

scratch=/tmp/opencode/issue30-r3-duplicate-baseline
mkdir -p "$scratch"
git show cf7dd92:panel/core.ts > "$scratch/core.ts"
git show cf7dd92:panel/main.js > "$scratch/main.js"
/bin/grep -Pozl "$paragraph" "$scratch/core.ts" "$scratch/main.js"
status=$?
printf 'cf7dd92 duplicate paragraph exit=%s (0 = reproduced in source and bundle)\n' "$status"
[[ "$status" == 0 ]] || exit 1

/bin/grep -RPn 'typeof DEFAULT_WORK_INSTRUCTIONS' panel/
status=$?
printf 'Dead probe grep exit=%s (1 = absent)\n' "$status"
[[ "$status" == 1 ]] || exit 1
