/**
 * Creates (or reuses) the "BeerApp" GitHub Project (v2) board, linked to the repo, with:
 * - Status: Backlog → Sprint backlog → In progress → In review → Done
 * - Story points (number) and Sprint (14-day iterations) fields
 * - every backlog issue added, with points and sprint set from docs/PLAN.md
 *
 * Needs the `project` scope: gh auth refresh -s project
 * Usage: node scripts/github/setup-project.ts [--start 2026-11-09] [--current S1]
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { parsePlan } from '../backlog/parse-plan.ts';

const { values: args } = parseArgs({
  options: {
    start: { type: 'string', default: '2026-11-09' },
    current: { type: 'string', default: 'S0' }, // sprint whose open items go to "Sprint backlog"
  },
});
const TITLE = 'BeerApp';
const SPRINT_DAYS = 14;
const STATUSES = [
  { name: 'Backlog', color: 'GRAY', description: 'Pendent de planificar' },
  { name: 'Sprint backlog', color: 'BLUE', description: "Planificat per a l'sprint actual" },
  { name: 'In progress', color: 'YELLOW', description: 'En curs' },
  { name: 'In review', color: 'PURPLE', description: 'PR oberta' },
  { name: 'Done', color: 'GREEN', description: 'Fet' },
];

const sleep = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const gh = (a: string[]) => execFileSync('gh', a, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
const ghJson = <T>(a: string[]) => JSON.parse(gh(a)) as T;

function graphql<T>(query: string, variables: Record<string, unknown>): T {
  const out = execFileSync('gh', ['api', 'graphql', '--input', '-'], {
    encoding: 'utf8',
    input: JSON.stringify({ query, variables }),
  });
  const parsed = JSON.parse(out);
  if (parsed.errors) throw new Error(JSON.stringify(parsed.errors));
  return parsed.data as T;
}

const repo = ghJson<{ nameWithOwner: string; owner: { login: string } }>([
  'repo',
  'view',
  '--json',
  'nameWithOwner,owner',
]);
const owner = repo.owner.login;

// ---------- project ----------
type ProjectSummary = { number: number; id: string; title: string };
let project = ghJson<{ projects: ProjectSummary[] }>([
  'project',
  'list',
  '--owner',
  owner,
  '--format',
  'json',
  '--limit',
  '100',
]).projects.find((p) => p.title === TITLE);

if (!project) {
  project = ghJson<ProjectSummary>([
    'project',
    'create',
    '--owner',
    owner,
    '--title',
    TITLE,
    '--format',
    'json',
  ]);
  gh(['project', 'link', String(project.number), '--owner', owner, '--repo', repo.nameWithOwner]);
  console.log(`+ project ${TITLE} (#${project.number})`);
}
const projectId = project.id;

// ---------- fields ----------
type Field = {
  id: string;
  name: string;
  dataType: string;
  options?: { id: string; name: string }[];
  configuration?: { iterations: { id: string; title: string }[] };
};
const loadFields = () =>
  graphql<{ node: { fields: { nodes: Field[] } } }>(
    `
      query ($id: ID!) {
        node(id: $id) {
          ... on ProjectV2 {
            fields(first: 50) {
              nodes {
                ... on ProjectV2FieldCommon {
                  id
                  name
                  dataType
                }
                ... on ProjectV2SingleSelectField {
                  options {
                    id
                    name
                  }
                }
                ... on ProjectV2IterationField {
                  configuration {
                    iterations {
                      id
                      title
                    }
                  }
                }
              }
            }
          }
        }
      }
    `,
    { id: projectId },
  ).node.fields.nodes;

let fields = loadFields();
const status = fields.find((f) => f.name === 'Status')!;
if (status.options?.map((o) => o.name).join() !== STATUSES.map((s) => s.name).join()) {
  graphql(
    `
      mutation ($field: ID!, $options: [ProjectV2SingleSelectFieldOptionInput!]) {
        updateProjectV2Field(input: { fieldId: $field, singleSelectOptions: $options }) {
          clientMutationId
        }
      }
    `,
    { field: status.id, options: STATUSES },
  );
  console.log('~ Status options');
}

if (!fields.some((f) => f.name === 'Story points')) {
  gh([
    'project',
    'field-create',
    String(project.number),
    '--owner',
    owner,
    '--name',
    'Story points',
    '--data-type',
    'NUMBER',
  ]);
  console.log('+ field Story points');
}

const plan = parsePlan(readFileSync(new URL('../../docs/PLAN.md', import.meta.url), 'utf8'));
const sprints = plan.sprints.filter((s) => s.key !== 'Backlog');
const start = new Date(`${args.start}T00:00:00Z`);
const sprintStart = (i: number) =>
  new Date(start.getTime() + i * SPRINT_DAYS * 86_400_000).toISOString().slice(0, 10);

if (!fields.some((f) => f.name === 'Sprint')) {
  graphql(
    `
      mutation ($project: ID!, $config: ProjectV2IterationFieldConfigurationInput!) {
        createProjectV2Field(
          input: { projectId: $project, dataType: ITERATION, name: "Sprint", iterationConfiguration: $config }
        ) {
          clientMutationId
        }
      }
    `,
    {
      project: projectId,
      config: {
        startDate: sprintStart(0),
        duration: SPRINT_DAYS,
        iterations: sprints.map((s, i) => ({
          title: s.key,
          startDate: sprintStart(i),
          duration: SPRINT_DAYS,
        })),
      },
    },
  );
  console.log('+ field Sprint');
}

fields = loadFields();
const statusField = fields.find((f) => f.name === 'Status')!;
const pointsField = fields.find((f) => f.name === 'Story points')!;
const sprintField = fields.find((f) => f.name === 'Sprint')!;
const optionId = (name: string) => statusField.options!.find((o) => o.name === name)!.id;
const iterationId = (key: string) => sprintField.configuration?.iterations.find((i) => i.title === key)?.id;

// ---------- items ----------
const stories = new Map(plan.epics.flatMap((e) => e.stories).map((s) => [s.id, s]));
// Items already on the board (the project may auto-add new issues without fields).
const existing = new Map(
  ghJson<{ items: { id: string; status?: string; content: { number?: number } }[] }>([
    'project',
    'item-list',
    String(project.number),
    '--owner',
    owner,
    '--format',
    'json',
    '--limit',
    '1000',
  ]).items.map((i) => [i.content.number, i]),
);
const issues = ghJson<{ number: number; title: string; url: string; state: string }[]>([
  'issue',
  'list',
  '--repo',
  repo.nameWithOwner,
  '--state',
  'all',
  '--limit',
  '1000',
  '--json',
  'number,title,url,state',
]);

function setField(itemId: string, fieldId: string, value: Record<string, unknown>) {
  graphql(
    `
      mutation ($p: ID!, $i: ID!, $f: ID!, $v: ProjectV2FieldValue!) {
        updateProjectV2ItemFieldValue(input: { projectId: $p, itemId: $i, fieldId: $f, value: $v }) {
          clientMutationId
        }
      }
    `,
    { p: projectId, i: itemId, f: fieldId, v: value },
  );
}

for (const issue of issues.sort((a, b) => a.number - b.number)) {
  const onBoard = existing.get(issue.number);
  if (onBoard?.status) continue; // already classified
  const key = issue.title.split(' · ')[0];
  const story = stories.get(key.replace(/-T\d+$/, ''));
  const itemId =
    onBoard?.id ??
    ghJson<{ id: string }>([
      'project',
      'item-add',
      String(project.number),
      '--owner',
      owner,
      '--url',
      issue.url,
      '--format',
      'json',
    ]).id;
  const isEpic = key.startsWith('EPIC-');
  const statusName =
    issue.state === 'CLOSED'
      ? 'Done'
      : !isEpic && story?.sprint?.key === args.current
        ? 'Sprint backlog'
        : 'Backlog';
  setField(itemId, statusField.id, { singleSelectOptionId: optionId(statusName) });
  if (story && key === story.id) setField(itemId, pointsField.id, { number: story.points });
  const iteration = !isEpic && story?.sprint ? iterationId(story.sprint.key) : undefined;
  if (iteration) setField(itemId, sprintField.id, { iterationId: iteration });
  console.log(`${onBoard ? '~' : '+'} item #${issue.number} ${key} → ${statusName}`);
  sleep(800);
}
console.log(`Fet: https://github.com/users/${owner}/projects/${project.number}`);
