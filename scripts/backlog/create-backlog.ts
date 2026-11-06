/**
 * Creates the GitHub backlog (labels, sprint milestones, epics, user stories and tasks)
 * from docs/PLAN.md. Idempotent: existing issues/milestones/labels are matched by title
 * and skipped, so it can be re-run after editing the plan.
 *
 * Usage:
 *   node scripts/backlog/create-backlog.ts [--dry-run] [--tasks S0,S1] [--start 2026-11-09]
 *
 * --tasks   Sprints whose stories also get their subtasks created as sub-issues
 *           (subtasks are created per sprint, at sprint planning). Default: S0.
 * --start   Monday the first sprint starts. Sprints last 14 days.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import {
  parsePlan,
  storyBranch,
  taskBranch,
  type Epic,
  type Sprint,
  type Story,
  type Task,
} from './parse-plan.ts';

const { values: args } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    tasks: { type: 'string', default: 'S0' },
    start: { type: 'string', default: '2026-11-09' },
  },
});
const DRY_RUN = args['dry-run'];
const TASK_SPRINTS = new Set(
  args.tasks
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);
const SPRINT_DAYS = 14;

const LABELS: Record<string, { color: string; description: string }> = {
  epic: { color: '5319e7', description: 'Agrupa user stories' },
  'user-story': { color: '1d76db', description: "User story (sub-issue d'un epic)" },
  task: { color: 'c5def5', description: "Subtasca d'una user story = una branca task/" },
  backlog: { color: 'ededed', description: 'Fora dels sprints planificats' },
  optional: { color: 'fef2c0', description: 'Opcional' },
  'store-compliance': { color: 'd93f0b', description: "Requisit de l'App Store / Google Play" },
  'beta-feedback': { color: 'fbca04', description: 'Feedback de la beta' },
  chore: { color: 'bfdadc', description: 'Manteniment, tooling, CI' },
};

// ---------- gh helpers ----------

const sleep = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function gh(args: string[], input?: unknown): string {
  return execFileSync('gh', args, {
    encoding: 'utf8',
    input: input === undefined ? undefined : JSON.stringify(input),
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function ghJsonLines<T>(path: string, jq: string): T[] {
  return gh(['api', '--paginate', path, '--jq', jq])
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as T);
}

/** Write call to the API, throttled to stay under GitHub's content-creation limits. */
function ghWrite<T>(method: string, path: string, body: unknown): T {
  const out = gh(['api', '--method', method, path, '--input', '-'], body);
  sleep(1100);
  return (out ? JSON.parse(out) : {}) as T;
}

const repo = JSON.parse(gh(['repo', 'view', '--json', 'nameWithOwner'])).nameWithOwner as string;

// ---------- labels & milestones ----------

function ensureLabels() {
  const existing = new Set(
    ghJsonLines<{ name: string }>(`repos/${repo}/labels?per_page=100`, '.[] | {name}').map((l) => l.name),
  );
  for (const [name, { color, description }] of Object.entries(LABELS)) {
    if (existing.has(name)) continue;
    console.log(`+ label ${name}`);
    if (!DRY_RUN) ghWrite('POST', `repos/${repo}/labels`, { name, color, description });
  }
}

function milestoneTitle(sprint: Sprint) {
  return `${sprint.key} · ${sprint.goal}`;
}

function ensureMilestones(sprints: Sprint[]): Map<string, number> {
  const existing = new Map(
    ghJsonLines<{ title: string; number: number }>(
      `repos/${repo}/milestones?state=all&per_page=100`,
      '.[] | {title, number}',
    ).map((m) => [m.title, m.number]),
  );
  const byKey = new Map<string, number>();
  const start = new Date(`${args.start}T00:00:00Z`);

  for (const sprint of sprints) {
    if (sprint.key === 'Backlog') continue;
    const title = milestoneTitle(sprint);
    const index = Number(sprint.key.slice(1));
    const due = new Date(start.getTime() + ((index + 1) * SPRINT_DAYS - 1) * 86_400_000);
    let number = existing.get(title);
    if (number === undefined) {
      console.log(`+ milestone ${title} (fins ${due.toISOString().slice(0, 10)})`);
      number = DRY_RUN
        ? -1
        : ghWrite<{ number: number }>('POST', `repos/${repo}/milestones`, {
            title,
            due_on: due.toISOString(),
            description: `Sprint de ${SPRINT_DAYS} dies. Objectiu: ${sprint.goal}`,
          }).number;
    }
    byKey.set(sprint.key, number);
  }
  return byKey;
}

// ---------- issues ----------

interface IssueRef {
  number: number;
  id: number;
  title: string;
}

const existingIssues = new Map(
  ghJsonLines<IssueRef>(
    `repos/${repo}/issues?state=all&per_page=100`,
    '.[] | select(.pull_request == null) | {number, id, title}',
  ).map((i) => [i.title.split(' · ')[0], i]),
);

function ensureIssue(
  key: string,
  title: string,
  body: string,
  labels: string[],
  milestone: number | undefined,
  parent?: IssueRef,
): IssueRef {
  const found = existingIssues.get(key);
  if (found) return found;

  console.log(`+ issue ${title}${parent ? `  (sub-issue de #${parent.number})` : ''}`);
  if (DRY_RUN) {
    const fake = { number: -1, id: -1, title };
    existingIssues.set(key, fake);
    return fake;
  }
  const created = ghWrite<IssueRef>('POST', `repos/${repo}/issues`, {
    title,
    body,
    labels,
    ...(milestone !== undefined ? { milestone } : {}),
  });
  if (parent && parent.number > 0) {
    ghWrite('POST', `repos/${repo}/issues/${parent.number}/sub_issues`, { sub_issue_id: created.id });
  }
  existingIssues.set(key, created);
  return created;
}

const epicKey = (epic: Epic) => `EPIC-${String(epic.number).padStart(2, '0')}`;

function epicBody(epic: Epic): string {
  const rows = epic.stories.map(
    (s) => `- **${s.id}** · ${s.title} (${s.points} pts${s.sprint ? ` · ${s.sprint.key}` : ''})`,
  );
  return [
    `Epic **${epic.title}**. Les user stories en són sub-issues.`,
    '',
    '### User stories',
    ...rows,
    '',
    '_Generat des de `docs/PLAN.md` per `scripts/backlog/create-backlog.ts`._',
  ].join('\n');
}

function storyBody(story: Story): string {
  const parts: string[] = [];
  if (story.description.length) parts.push(story.description.join('\n'), '');
  if (story.acceptance.length) {
    parts.push("### Criteris d'acceptació", ...story.acceptance.map((a) => `- [ ] ${a}`), '');
  }
  if (story.tasks.length) {
    parts.push('### Subtasques', ...story.tasks.map((t) => `- **${t.id}** · ${t.title}`), '');
  }
  parts.push(
    '---',
    `**Story points:** ${story.points} · **Sprint:** ${story.sprint?.key ?? '—'}`,
    `**Branca:** \`${storyBranch(story)}\` (des de \`main\`, PR cap a \`main\` amb *merge commit*)`,
  );
  if (story.flags.length) parts.push(`**Notes:** ${story.flags.join(' · ')}`);
  return parts.join('\n');
}

function taskBody(story: Story, task: Task): string {
  return [
    `Subtasca de **${story.id} · ${story.title}**.`,
    ...(task.notes.length ? ['', ...task.notes.map((n) => `- ${n}`)] : []),
    '',
    '---',
    `**Branca:** \`${taskBranch(story, task)}\` (des de \`${storyBranch(story)}\`)`,
    `PR cap a \`${storyBranch(story)}\` amb *squash merge* i \`Closes #<aquest issue>\`.`,
  ].join('\n');
}

function storyLabels(story: Story): string[] {
  const labels = ['user-story'];
  if (story.sprint?.key === 'Backlog') labels.push('backlog');
  if (story.flags.some((f) => /opcional/i.test(f))) labels.push('optional');
  if (story.flags.some((f) => /obligatori/i.test(f))) labels.push('store-compliance');
  return labels;
}

// ---------- main ----------

const plan = parsePlan(readFileSync(new URL('../../docs/PLAN.md', import.meta.url), 'utf8'));
console.log(
  `${DRY_RUN ? '[dry-run] ' : ''}Repo ${repo} · subtasques per a: ${[...TASK_SPRINTS].join(', ') || 'cap'}`,
);

ensureLabels();
const milestones = ensureMilestones(plan.sprints);

for (const epic of plan.epics) {
  const epicIssue = ensureIssue(
    epicKey(epic),
    `${epicKey(epic)} · ${epic.title}`,
    epicBody(epic),
    ['epic'],
    undefined,
  );
  for (const story of epic.stories) {
    const milestone = story.sprint ? milestones.get(story.sprint.key) : undefined;
    const storyIssue = ensureIssue(
      story.id,
      `${story.id} · ${story.title}`,
      storyBody(story),
      storyLabels(story),
      milestone,
      epicIssue,
    );
    if (!story.sprint || !TASK_SPRINTS.has(story.sprint.key)) continue;
    for (const task of story.tasks) {
      ensureIssue(
        task.id,
        `${task.id} · ${task.title}`,
        taskBody(story, task),
        ['task'],
        milestone,
        storyIssue,
      );
    }
  }
}
console.log('Fet.');
