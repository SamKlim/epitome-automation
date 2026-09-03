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

## Data Integrity

**No default or dummy data for survey responses.** If we cannot generate an accurate output (PDF, radar chart, scores) from real user data:
- Throw an error immediately
- Do not send the report/email
- Return the error to the API caller

Sending reports with incorrect data is worse than sending no report. Silent fallbacks mask data corruption.

## Architecture & Documentation

For data flow, system architecture, services, and ranking logic, see [backend/README.md](backend/README.md).

## Reference folder

The `reference/` folder contains Merle's epitome-automation repo. Explore it to understand patterns, but this project builds its own solution.

