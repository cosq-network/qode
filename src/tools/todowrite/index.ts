import { globalRegistry } from '../registry.js';
import type { RegisteredTool } from '../registry.js';

/**
 * In-memory task list for tracking progress.
 * Tasks persist across tool calls within a session but not across sessions.
 */
const taskLists: Map<string, TaskItem[]> = new Map();

export interface TaskItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'high' | 'medium' | 'low';
}

function getTasks(sessionId: string): TaskItem[] {
  if (!taskLists.has(sessionId)) {
    taskLists.set(sessionId, []);
  }
  return taskLists.get(sessionId)!;
}

function renderTaskList(tasks: TaskItem[]): string {
  if (tasks.length === 0) return 'No tasks. Use todowrite to add tasks.';

  const lines: string[] = ['# Task List', ''];

  const groups = {
    in_progress: tasks.filter((t) => t.status === 'in_progress'),
    pending: tasks.filter((t) => t.status === 'pending'),
    completed: tasks.filter((t) => t.status === 'completed'),
    cancelled: tasks.filter((t) => t.status === 'cancelled'),
  };

  if (groups.in_progress.length > 0) {
    lines.push('## In Progress');
    for (const t of groups.in_progress) {
      lines.push(`- [~] ${t.content} (${t.priority})`);
    }
    lines.push('');
  }

  if (groups.pending.length > 0) {
    lines.push('## Pending');
    for (const t of groups.pending) {
      lines.push(`- [ ] ${t.content} (${t.priority})`);
    }
    lines.push('');
  }

  if (groups.completed.length > 0) {
    lines.push('## Completed');
    for (const t of groups.completed) {
      lines.push(`- [x] ${t.content}`);
    }
    lines.push('');
  }

  if (groups.cancelled.length > 0) {
    lines.push('## Cancelled');
    for (const t of groups.cancelled) {
      lines.push(`- [-] ${t.content}`);
    }
    lines.push('');
  }

  const total = tasks.length;
  const done = groups.completed.length;
  const pct = Math.round((done / total) * 100);
  lines.push(`Progress: ${done}/${total} (${pct}%)`);

  return lines.join('\n');
}

const todowriteTool: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'todowrite',
      description: 'Create and maintain a structured task list for the current coding session. Tracks progress, organizes multi-step work, and surfaces status to the user.',
      parameters: {
        type: 'object' as const,
        properties: {
          todos: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                content: { type: 'string', description: 'Brief description of the task' },
                status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'], description: 'Current status' },
                priority: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Priority level' },
              },
              required: ['content', 'status', 'priority'],
            },
            description: 'The updated task list',
          },
        },
        required: ['todos'],
      },
    },
  },
  metadata: {
    category: 'planning',
    permissionKey: 'read',
  },
  execute: async (args: Record<string, unknown>) => {
    const todos = args.todos as TaskItem[];
    const sid = (args._sessionId as string) ?? 'default';
    const tasks = getTasks(sid);

    // Replace the task list
    tasks.length = 0;
    tasks.push(...todos);

    return renderTaskList(tasks);
  },
};

export function registerTodowriteTool(): void {
  globalRegistry.register(todowriteTool);
}
