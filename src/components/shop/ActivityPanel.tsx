'use client';

import { useId, useState } from 'react';
import { Check, ChevronRight, CircleAlert, CircleCheck, CircleSlash, Loader2, type LucideIcon } from 'lucide-react';
import { Icon } from '@/components/ui/icon';
import { cx } from '@/components/ui/cx';
import { friendlyStep, type StepState } from '@/lib/assistant/friendly-steps';
import { argSummary, requestJson, resultSummary } from './activity-format';
import type { CallStatus, ToolCall } from './console-state';

const STATUS: Record<CallStatus, { icon: LucideIcon; label: string; className: string }> = {
  running: { icon: Loader2, label: 'Running', className: 'animate-spin text-ink-muted' },
  ok: { icon: CircleCheck, label: 'Done', className: 'text-ok' },
  error: { icon: CircleAlert, label: 'Error', className: 'text-error' },
  interrupted: { icon: CircleSlash, label: 'No answer', className: 'text-ink-muted' },
};

const STEP: Record<StepState, { icon: LucideIcon; label: string; className: string }> = {
  running: { icon: Loader2, label: 'Working on it', className: 'animate-spin text-ink-muted' },
  done: { icon: Check, label: 'Done', className: 'text-ok' },
  error: { icon: CircleAlert, label: 'Didn’t work', className: 'text-error' },
};

function Json({ label, children }: { label: string; children: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="type-meta font-semibold text-ink-soft">{label}</span>
      <pre className="rounded-sm bg-surface p-2.5 font-mono text-xs leading-5 whitespace-pre-wrap text-ink [overflow-wrap:anywhere]">
        {children}
      </pre>
    </div>
  );
}

/** One call in the Details view: tool name, arguments → result, expanding to its time and the raw MCP JSON. */
function CallRow({ call }: { call: ToolCall }) {
  const status = STATUS[call.status];
  const result = resultSummary(call);
  return (
    <li>
      <details className="group">
        <summary className="group/summary press-text flex min-h-tap list-none items-start gap-2.5 rounded-sm px-3 py-2.5 hover:bg-line [&::-webkit-details-marker]:hidden">
          <Icon icon={status.icon} size="sm" label={status.label} className={cx('mt-0.5', status.className)} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <code className="font-mono text-sm font-semibold text-ink">{call.name}</code>
            <span className="type-meta text-ink-muted [overflow-wrap:anywhere]">
              {argSummary(call.name, call.input)}
              <span aria-hidden="true"> → </span>
              <span className="sr-only">, result: </span>
              <span className={cx(call.status === 'error' && 'font-semibold text-error')}>{result}</span>
            </span>
          </span>
          <Icon icon={ChevronRight} size="sm" className="mt-0.5 text-ink-muted transition-[rotate,color] duration-(--duration-fast) group-open:rotate-90 group-hover/summary:text-ink" />
        </summary>
        <div className="flex flex-col gap-2.5 px-3 pt-1 pb-3">
          {call.ms !== undefined && <p className="type-meta type-price text-ink-muted">Took {call.ms} ms</p>}
          <Json label="MCP request">{requestJson(call.name, call.input)}</Json>
          {call.result !== undefined && <Json label="MCP response">{JSON.stringify(call.result, null, 2)}</Json>}
        </div>
      </details>
    </li>
  );
}

/**
 * What the assistant did for the buyer in one step of the conversation, in plain words ("Checked the menu",
 * "Placed your order · $27.00 · waiting for your PayPal approval"; `friendly-steps.ts`), each with a tick, a spinner
 * or an error mark. A quiet "Details" button under them opens the technical view: every agent-door call with its
 * arguments, result, time and raw MCP request and response. Each step carries `data-tool` and `data-state`. No
 * `aria-live` of its own: every panel sits inside the conversation's `role="log"`, which already announces new steps.
 */
export function ActivityPanel({ calls }: { calls: ToolCall[] }) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  return (
    <div role="group" aria-label="Activity" data-activity="" className="flex flex-col items-start">
      <ul className="flex flex-col gap-1 py-0.5">
        {calls.map((call) => {
          const step = friendlyStep(call);
          const mark = STEP[step.state];
          return (
            <li key={call.id} data-step="" data-tool={call.name} data-state={step.state} className="flex items-start gap-2 text-sm leading-5">
              <Icon icon={mark.icon} size="sm" label={mark.label} className={cx('mt-0.5', mark.className)} />
              <span className={cx('min-w-0 [overflow-wrap:anywhere]', step.state === 'error' ? 'font-semibold text-error' : 'text-ink-soft')}>{step.label}</span>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={() => setOpen((o) => !o)}
        className="group/details press-text -ml-2 flex min-h-tap items-center gap-1 rounded-sm px-2 type-meta text-ink-muted hover:text-ink"
      >
        Details
        <Icon icon={ChevronRight} size="sm" className={cx('transition-[rotate] duration-(--duration-fast)', open && 'rotate-90')} />
      </button>
      <div id={detailsId} hidden={!open} className="w-full rounded-(--card-radius) bg-surface-sunken">
        {open && (
          <ol aria-label="Agent door calls" className="flex flex-col py-1">
            {calls.map((call) => (
              <CallRow key={call.id} call={call} />
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
