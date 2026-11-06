/**
 * Parses docs/PLAN.md (sections 7 and 8) into a structured backlog.
 * PLAN.md is the single source of truth for epics, user stories, tasks and sprints.
 */

export interface Task {
  id: string; // US-001-T1
  title: string;
  notes: string[];
}

export interface Story {
  id: string; // US-001
  title: string;
  points: number;
  flags: string[]; // e.g. "backlog", "opcional", "obligatori per App Store..."
  description: string[];
  acceptance: string[];
  tasks: Task[];
  epic: number;
  sprint?: Sprint;
}

export interface Epic {
  number: number;
  title: string;
  stories: Story[];
}

export interface Sprint {
  key: string; // "S0" or "Backlog"
  goal: string;
  storyIds: string[];
}

export interface Backlog {
  epics: Epic[];
  sprints: Sprint[];
}

const EPIC_RE = /^### EPIC (\d+) — (.+)$/;
const STORY_RE = /^\*\*(US-\d+) · (.+?)\*\*\s*\((\d+)\)\s*(.*)$/;
const TASK_RE = /^- (T\d+) (.+)$/;
const AC_RE = /^- AC: (.+)$/;
const US_ID_RE = /US-\d+/g;

export function slugify(text: string, maxLength = 40): string {
  const slug = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length <= maxLength) return slug;
  const cut = slug.slice(0, maxLength + 1);
  const lastDash = cut.lastIndexOf('-');
  return (lastDash > 0 ? cut.slice(0, lastDash) : slug.slice(0, maxLength)).replace(/-+$/, '');
}

/** Removes markdown emphasis/code markers so text works as a plain issue title. */
export function plainText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .trim();
}

export function storyBranch(story: Story): string {
  return `feature/${story.id.toLowerCase()}-${slugify(story.title)}`;
}

export function taskBranch(story: Story, task: Task): string {
  const taskNum = task.id.split('-').pop()!.toLowerCase();
  return `task/${story.id.toLowerCase()}-${taskNum}-${slugify(plainText(task.title), 34)}`;
}

function section(markdown: string, startHeading: RegExp, endHeading: RegExp): string[] {
  const lines = markdown.split('\n');
  const start = lines.findIndex((l) => startHeading.test(l));
  if (start === -1) throw new Error(`Section not found: ${startHeading}`);
  const rel = lines.slice(start + 1).findIndex((l) => endHeading.test(l));
  return lines.slice(start + 1, rel === -1 ? undefined : start + 1 + rel);
}

function parseEpics(lines: string[]): Epic[] {
  const epics: Epic[] = [];
  let epic: Epic | undefined;
  let story: Story | undefined;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim() || line.startsWith('---')) continue;

    const epicMatch = EPIC_RE.exec(line);
    if (epicMatch) {
      epic = {
        number: Number(epicMatch[1]),
        title: epicMatch[2].replace(/\s*\(Sprint \d+\)$/, '').trim(),
        stories: [],
      };
      epics.push(epic);
      story = undefined;
      continue;
    }

    const storyMatch = STORY_RE.exec(line);
    if (storyMatch) {
      if (!epic) throw new Error(`Story outside epic: ${line}`);
      const flags = [...storyMatch[4].matchAll(/\*\((.+?)\)\*/g)].map((m) => m[1]);
      story = {
        id: storyMatch[1],
        title: plainText(storyMatch[2]),
        points: Number(storyMatch[3]),
        flags,
        description: [],
        acceptance: [],
        tasks: [],
        epic: epic.number,
      };
      epic.stories.push(story);
      continue;
    }

    if (!story) continue;

    const taskMatch = TASK_RE.exec(line);
    if (taskMatch) {
      story.tasks.push({ id: `${story.id}-${taskMatch[1]}`, title: plainText(taskMatch[2]), notes: [] });
      continue;
    }

    const acMatch = AC_RE.exec(line);
    if (acMatch) {
      story.acceptance.push(
        ...acMatch[1]
          .split(/;\s*/)
          .map((s) => s.trim())
          .filter(Boolean),
      );
      continue;
    }

    // Nested bullets belong to the last task; anything else is story description.
    const lastTask = story.tasks.at(-1);
    if (/^\s+- /.test(line) && lastTask) {
      lastTask.notes.push(line.trim().replace(/^- /, ''));
    } else {
      story.description.push(line.replace(/^- /, '').trim());
    }
  }
  return epics;
}

function parseSprints(lines: string[], orderedIds: string[]): Sprint[] {
  const sprints: Sprint[] = [];
  for (const line of lines) {
    if (!line.startsWith('|')) continue;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 3 || !/^(S\d+|Backlog)$/.test(cells[0])) continue;
    const [key, goal, usCell] = cells;
    const storyIds: string[] = [];
    // Expand ranges "US-1401 → US-1404" using backlog order, then plain lists.
    for (const part of usCell.split(',')) {
      const ids = part.match(US_ID_RE) ?? [];
      if (part.includes('→') && ids.length === 2) {
        const from = orderedIds.indexOf(ids[0]);
        const to = orderedIds.indexOf(ids[1]);
        if (from === -1 || to === -1) throw new Error(`Unknown range: ${part}`);
        storyIds.push(...orderedIds.slice(from, to + 1));
      } else {
        storyIds.push(...ids);
      }
    }
    sprints.push({ key, goal, storyIds });
  }
  return sprints;
}

export function parsePlan(markdown: string): Backlog {
  const epics = parseEpics(section(markdown, /^## 7\. /, /^## 8\. /));
  const stories = epics.flatMap((e) => e.stories);
  const orderedIds = stories.map((s) => s.id);
  const sprints = parseSprints(section(markdown, /^## 8\. /, /^## 9\. /), orderedIds);

  for (const sprint of sprints) {
    for (const id of sprint.storyIds) {
      const story = stories.find((s) => s.id === id);
      if (!story) throw new Error(`Sprint ${sprint.key} references unknown story ${id}`);
      story.sprint = sprint;
    }
  }
  return { epics, sprints };
}
