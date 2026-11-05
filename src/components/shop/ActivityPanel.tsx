import { ChevronRight, CircleAlert, CircleCheck, CircleSlash, DoorOpen, Loader2, type LucideIcon } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/components/ui/cx';
import { argSummary, requestJson, resultSummary } from './activity-format';
import type { CallStatus, ToolCall } from './console-state';

const STATUS: Record<CallStatus, { icon: LucideIcon; label: string; className: string }> = {
  running: { icon: Loader2, label: 'Running', className: 'animate-spin text-ink-muted' },
  ok: { icon: CircleCheck, label: 'Done', className: 'text-ok' },
  error: { icon: CircleAlert, label: 'Error', className: 'text-danger' },
  interrupted: { icon: CircleSlash, label: 'No answer', className: 'text-ink-muted' },
};

function Json({ label, children }: { label: string; children: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="type-meta font-semibold text-ink-soft">{label}</span>
      <pre className="rounded-sm bg-surface-sunken p-2.5 font-mono text-xs leading-5 whitespace-pre-wrap text-ink [overflow-wrap:anywhere]">
        {children}
      </pre>
    </div>
  );
}

function CallRow({ call }: { call: ToolCall }) {
  const status = STATUS[call.status];
  const result = resultSummary(call);
  return (
    <li>
      <details className="group">
        <summary className="flex min-h-tap list-none items-start gap-2.5 rounded-sm px-3 py-2.5 hover:bg-surface-sunken [&::-webkit-details-marker]:hidden">
          <Icon icon={status.icon} size="sm" label={status.label} className={cx('mt-0.5', status.className)} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex items-baseline gap-2">
              <code className="font-mono text-sm font-semibold text-ink">{call.name}</code>
              {call.ms !== undefined && <span className="ml-auto type-meta type-price text-ink-muted">{call.ms} ms</span>}
            </span>
            <span className="type-meta text-ink-muted [overflow-wrap:anywhere]">
              {argSummary(call.name, call.input)}
              <span aria-hidden="true"> → </span>
              <span className="sr-only">, result: </span>
              <span className={cx(call.status === 'error' && 'font-semibold text-danger')}>{result}</span>
            </span>
          </span>
          <Icon icon={ChevronRight} size="sm" className="mt-0.5 text-ink-muted transition-transform group-open:rotate-90" />
        </summary>
        <div className="flex flex-col gap-2.5 px-3 pt-1 pb-3">
          <Json label="MCP request">{requestJson(call.name, call.input)}</Json>
          {call.result !== undefined && <Json label="MCP response">{JSON.stringify(call.result, null, 2)}</Json>}
        </div>
      </details>
    </li>
  );
}

/**
 * The tool calls the assistant made through the shop's agent door in one step of the conversation: name, arguments,
 * result (or error code) and time, each expanding to the raw MCP request and response.
 */
export function ActivityPanel({ calls }: { calls: ToolCall[] }) {
  const running = calls.some((c) => c.status === 'running');
  return (
    <div role="group" aria-label="Activity" className="rounded-md border border-line-strong bg-surface">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2 type-meta text-ink-muted">
        <Icon icon={DoorOpen} size="sm" />
        <span className="font-semibold text-ink-soft">Activity</span>
        <span>
          · {calls.length} {calls.length === 1 ? 'call' : 'calls'} to the agent door{running ? '…' : ''}
        </span>
      </div>
      <ol className="flex flex-col py-1">
        {calls.map((call) => (
          <CallRow key={call.id} call={call} />
        ))}
      </ol>
    </div>
  );
}
