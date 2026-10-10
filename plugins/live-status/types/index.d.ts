export type Limit = { kind: string; pct: number; resetsAt?: string }

export type Usage = {
  ctxPercent: number | null
  ctxTokens: number | null
  ctxWindow: number
  limits: Limit[]
  costUsd: number | null
}

export type Turn = {
  isRunning: boolean
  startedAt: number
  steps: number
  tools: number
  lastSeconds: number
  agents: number
}

// The task being worked on, as reported through the `task` tool.
export type Task = {
  title: string
  total: number
  done: number
  current: string
  isFinished: boolean
}

// Subagents launched / finished since the turn began: the automatic fallback.
export type Crew = { spawned: number; done: number }

// One subagent, from agent.spawn to its last turn.
export type Run = {
  id: string
  agentId?: string
  type: string
  description: string
  model: string
  effort?: string
  status: 'running' | 'done' | 'failed'
  startedAt: number
  endedAt?: number
  contextTokens: number
  contextMax: number
  tokens: number
  steps: number
}

export type Panel = { isCompact: boolean; isDoneCollapsed: boolean }

// One Claude Code session on this machine, from its entry in ~/.claude/sessions.
export type SessionRow = {
  id: string
  pid: number
  name: string
  project: string
  entry: string
  status: 'busy' | 'idle'
  updatedAt: number
  startedAt: number
  isSelf: boolean
  // The task that session reports (see the `task` tool); absent when it reports none.
  task?: { title: string; done: number; total: number; current: string; isFinished: boolean }
}

declare module 'claude-code' {
  interface PluginState {
    'live-status': {
      usage: Usage
      model: string
      effort: string
      turn: Turn
      task: Task | null
      crew: Crew
      runs: Run[]
      sessions: SessionRow[]
      panel: Panel
      now: number
      slow: number
      isHidden: boolean
      warned: string
    }
  }
}
