export type TaskSpec = {
  task_id: string;
  tier: 1 | 2 | 3 | 4;
  worker: string;
  title: string;
  scope: string[];
  success_criteria: string[];
  constraints: string[];
  context_files: string[];
  max_output_chars?: number;
};

export type WorkerResult = {
  task_id: string;
  status: "completed" | "failed" | "escalated";
  summary: string;
  findings: string[];
  files_modified: string[];
  files_read: string[];
  action_items: string[];
  follow_up?: string;
};

export function formatTaskSpec(spec: TaskSpec): string {
  const lines = [
    `[TASK:${spec.task_id}] tier=${spec.tier} worker=${spec.worker}`,
    `Title: ${spec.title}`,
    `Scope: ${spec.scope.join(", ")}`,
    `Success: ${spec.success_criteria.join("; ")}`,
  ];
  if (spec.constraints.length > 0) {
    lines.push(`Constraints: ${spec.constraints.join("; ")}`);
  }
  if (spec.context_files.length > 0) {
    lines.push(`Context files: ${spec.context_files.join(", ")}`);
  }
  if (spec.max_output_chars) {
    lines.push(`Max output: ${spec.max_output_chars} chars`);
  }
  return lines.join("\n");
}

export function parseWorkerResult(raw: string): WorkerResult {
  const result: WorkerResult = {
    task_id: "",
    status: "completed",
    summary: "",
    findings: [],
    files_modified: [],
    files_read: [],
    action_items: [],
  };

  const taskMatch = raw.match(/\[RESULT:([^\]]+)\]/);
  if (taskMatch) result.task_id = taskMatch[1];

  const statusMatch = raw.match(/status:\s*(completed|failed|escalated)/i);
  if (statusMatch) result.status = statusMatch[1].toLowerCase() as WorkerResult["status"];

  const summaryMatch = raw.match(/(?:summary|result):\s*(.+?)(?:\n|$)/i);
  if (summaryMatch) result.summary = summaryMatch[1].trim();

  const findingsSection = raw.match(/findings?:\s*\n((?:[-*]\s+.+\n?)+)/i);
  if (findingsSection) {
    result.findings = findingsSection[1]
      .split("\n")
      .map((l) => l.replace(/^[-*]\s*/, "").trim())
      .filter(Boolean);
  }

  const modifiedMatch = raw.match(/(?:files?\s*(?:modified|changed|edited)):\s*(.+?)(?:\n|$)/i);
  if (modifiedMatch) {
    result.files_modified = modifiedMatch[1]
      .split(/[,\s]+/)
      .map((f) => f.trim())
      .filter(Boolean);
  }

  return result;
}

export function compressWorkerOutput(result: WorkerResult, maxChars: number = 2000): string {
  const lines: string[] = [];
  lines.push(`[RESULT:${result.task_id}] status=${result.status}`);
  lines.push(`Summary: ${result.summary}`);

  if (result.findings.length > 0) {
    const maxFindings = result.findings.slice(0, 5);
    lines.push(`Findings (${result.findings.length}):`);
    for (const f of maxFindings) {
      lines.push(`- ${f}`);
    }
    if (result.findings.length > 5) {
      lines.push(`... and ${result.findings.length - 5} more`);
    }
  }

  if (result.files_modified.length > 0) {
    lines.push(`Modified: ${result.files_modified.join(", ")}`);
  }

  if (result.action_items.length > 0) {
    lines.push(`Actions: ${result.action_items.join("; ")}`);
  }

  if (result.follow_up) {
    lines.push(`Follow-up: ${result.follow_up}`);
  }

  const output = lines.join("\n");
  if (output.length <= maxChars) return output;
  return output.slice(0, maxChars - 3) + "...";
}

export function compressRawOutput(raw: string, maxChars: number = 3000): string {
  if (raw.length <= maxChars) return raw;

  const lines = raw.split("\n");
  const headerLines = lines.slice(0, 5);
  const tailLines = lines.slice(-3);
  const truncatedCount = lines.length - 8;

  return [
    ...headerLines,
    `... [${truncatedCount} lines compressed] ...`,
    ...tailLines,
  ].join("\n");
}
