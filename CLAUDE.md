# Epitome Automation — Project Rules

## Overview

This project explores survey design and data structure patterns. Uses `reference/` folder to study [epitome-automation](https://github.com/merle-epitome/epitome-automation.git) for architectural inspiration.

## Chat workflow

Summary only — full steps in `.ai/skills/start-chat/SKILL.md` and `.ai/skills/finish-coding/SKILL.md`.

### Start (automatic — first message of every new chat)

Follow `/start-chat`. User does not need to type the command.

### Finish coding (user invokes `/finish-coding`)

Code review → compile → tests → MEMORY (if warranted) → BUILD_JOURNAL (if warranted) → commit (with approval) → push.

## Before coding

- State assumptions explicitly before proceeding
- If ambiguous, present multiple interpretations — don't pick silently
- Outline changes before writing code, then wait for approval
- No large decisions made silently

## Reference folder

The `reference/` folder contains Merle's epitome-automation repo. Explore it to understand patterns, but this project builds its own solution.

