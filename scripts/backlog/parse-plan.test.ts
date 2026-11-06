import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parsePlan, slugify, storyBranch, taskBranch } from './parse-plan.ts';

const SAMPLE = `
## 7. Backlog

### EPIC 0 — Fonaments (Sprint 0)

**US-001 · Repositori i convencions** (3)
Com a dev vull un repo.
- T1 Crear repo GitHub, \`.gitignore\`
- T2 Plantilles

### EPIC 1 — Autenticació

**US-101 · Registre i login** (5)
- AC: Sign in with Apple; sessió persistent
- T1 Pantalles login
- T3 Seed amb logros:
  - Primera cervesa

**US-102 · Verificació d'edat** (2) *(backlog)*

## 8. Planificació

| Sprint | Objectiu | US |
|---|---|---|
| S0 | Fonaments | US-001 |
| S1 | Auth | US-101 → US-102 |

## 9. Verificació
`;

test('parses epics, stories, tasks and acceptance criteria', () => {
  const { epics } = parsePlan(SAMPLE);
  assert.equal(epics.length, 2);
  assert.equal(epics[0].title, 'Fonaments');
  const [us001] = epics[0].stories;
  assert.equal(us001.id, 'US-001');
  assert.equal(us001.points, 3);
  assert.deepEqual(us001.description, ['Com a dev vull un repo.']);
  assert.deepEqual(
    us001.tasks.map((t) => t.id),
    ['US-001-T1', 'US-001-T2'],
  );
  assert.equal(us001.tasks[0].title, 'Crear repo GitHub, .gitignore');

  const [us101, us102] = epics[1].stories;
  assert.deepEqual(us101.acceptance, ['Sign in with Apple', 'sessió persistent']);
  assert.deepEqual(us101.tasks[1].notes, ['Primera cervesa']);
  assert.deepEqual(us102.flags, ['backlog']);
  assert.equal(us102.tasks.length, 0);
});

test('assigns stories to sprints, expanding ranges', () => {
  const { epics, sprints } = parsePlan(SAMPLE);
  assert.deepEqual(
    sprints.map((s) => s.key),
    ['S0', 'S1'],
  );
  assert.deepEqual(sprints[1].storyIds, ['US-101', 'US-102']);
  assert.equal(epics[1].stories[1].sprint?.key, 'S1');
});

test('slugify strips accents and truncates on word boundary', () => {
  assert.equal(slugify("Verificació d'edat"), 'verificacio-d-edat');
  assert.equal(slugify('una frase molt llarga que supera el límit de caràcters', 20), 'una-frase-molt');
});

test('branch names follow the convention', () => {
  const { epics } = parsePlan(SAMPLE);
  const story = epics[0].stories[0];
  assert.equal(storyBranch(story), 'feature/us-001-repositori-i-convencions');
  assert.equal(taskBranch(story, story.tasks[0]), 'task/us-001-t1-crear-repo-github-gitignore');
});

test('the real PLAN.md parses and every sprint story exists', () => {
  const plan = readFileSync(new URL('../../docs/PLAN.md', import.meta.url), 'utf8');
  const { epics, sprints } = parsePlan(plan);
  assert.equal(epics.length, 16);
  const stories = epics.flatMap((e) => e.stories);
  assert.ok(stories.length >= 40);
  assert.ok(sprints.find((s) => s.key === 'S0')?.storyIds.includes('US-004'));
  // Every non-backlog story is scheduled somewhere.
  const unscheduled = stories.filter((s) => !s.sprint).map((s) => s.id);
  assert.deepEqual(unscheduled, []);
});
