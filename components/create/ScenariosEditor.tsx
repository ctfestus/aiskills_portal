'use client';

// The scenarios/tasks builder for a Standard assignment. An assignment is a list of
// SCENARIOS (each a titled section with a rich intro); inside a scenario you add TASKS,
// each of a chosen type (written response, upload, MCQ, or an inline AI review). Plain,
// open, ungated at runtime -- this component only authors the structure.

import { useState } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { LessonEditor } from '@/components/lesson/LessonEditor';
import { LIGHT_C } from '@/lib/theme';
import { TaskFields } from '@/components/create/TaskFields';
import {
  Plus, Trash2, ChevronDown, ChevronUp, ArrowUp, ArrowDown,
  PenLine, Upload, ListChecks, Code2, FileSpreadsheet, LayoutDashboard, FileText,
} from 'lucide-react';
import type { AssignmentScenario, AssignmentTask, AssignmentTaskType } from '@/lib/assignment-scenarios';
import { TASK_TYPE_LABEL } from '@/lib/assignment-scenarios';

const TASK_PALETTE: { type: AssignmentTaskType; icon: React.ReactNode }[] = [
  { type: 'text',               icon: <PenLine style={{ width: 14, height: 14 }} /> },
  { type: 'upload',             icon: <Upload style={{ width: 14, height: 14 }} /> },
  { type: 'mcq',                icon: <ListChecks style={{ width: 14, height: 14 }} /> },
  { type: 'code_review',        icon: <Code2 style={{ width: 14, height: 14 }} /> },
  { type: 'excel_review',       icon: <FileSpreadsheet style={{ width: 14, height: 14 }} /> },
  { type: 'dashboard_critique', icon: <LayoutDashboard style={{ width: 14, height: 14 }} /> },
  { type: 'document_review',    icon: <FileText style={{ width: 14, height: 14 }} /> },
];

function newTask(type: AssignmentTaskType): AssignmentTask {
  const base: AssignmentTask = { id: crypto.randomUUID(), type, title: '' };
  if (type === 'mcq') base.options = ['', ''];
  if (type === 'code_review' || type === 'excel_review' || type === 'document_review') base.minScore = 70;
  return base;
}

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function ScenariosEditor({ scenarios, onChange, C }: {
  scenarios: AssignmentScenario[];
  onChange: (scenarios: AssignmentScenario[]) => void;
  C: typeof LIGHT_C;
}) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [openScenarios, setOpenScenarios] = useState<Set<string>>(() => new Set(scenarios.map(s => s.id)));
  const [openTasks, setOpenTasks] = useState<Set<string>>(new Set());
  const [addingFor, setAddingFor] = useState<string | null>(null);

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    setter(next);
  };

  const updateScenario = (id: string, updates: Partial<AssignmentScenario>) =>
    onChange(scenarios.map(s => s.id === id ? { ...s, ...updates } : s));

  const addScenario = () => {
    const s: AssignmentScenario = { id: crypto.randomUUID(), title: '', description: '', tasks: [] };
    onChange([...scenarios, s]);
    setOpenScenarios(prev => new Set(prev).add(s.id));
  };
  const removeScenario = (id: string) => onChange(scenarios.filter(s => s.id !== id));
  const moveScenario = (idx: number, dir: -1 | 1) => onChange(moveItem(scenarios, idx, idx + dir));

  const addTask = (scenarioId: string, type: AssignmentTaskType) => {
    const task = newTask(type);
    onChange(scenarios.map(s => s.id === scenarioId ? { ...s, tasks: [...s.tasks, task] } : s));
    setOpenTasks(prev => new Set(prev).add(task.id));
    setAddingFor(null);
  };
  const updateTask = (scenarioId: string, taskId: string, updates: Partial<AssignmentTask>) =>
    onChange(scenarios.map(s => s.id === scenarioId
      ? { ...s, tasks: s.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t) }
      : s));
  const removeTask = (scenarioId: string, taskId: string) =>
    onChange(scenarios.map(s => s.id === scenarioId ? { ...s, tasks: s.tasks.filter(t => t.id !== taskId) } : s));
  const moveTask = (scenarioId: string, idx: number, dir: -1 | 1) =>
    onChange(scenarios.map(s => s.id === scenarioId ? { ...s, tasks: moveItem(s.tasks, idx, idx + dir) } : s));

  const iconBtn = (onClick: () => void, disabled: boolean, children: React.ReactNode, title: string) => (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, border: `1px solid ${C.cardBorder}`, background: C.input, color: C.faint, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.35 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </button>
  );

  return (
    <section style={{ background: C.card, borderRadius: 16, boxShadow: C.cardShadow, padding: 24, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0 }}>Scenarios & Tasks</h2>
        <button type="button" onClick={addScenario}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: `1px solid ${C.cardBorder}`, background: C.pill, color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus style={{ width: 14, height: 14 }} /> Add scenario
        </button>
      </div>
      <p style={{ fontSize: 12, color: C.faint, marginTop: 0, marginBottom: 18 }}>
        Add scenarios, and inside each one add tasks of any kind. Students can work through them in any order and submit everything for your review.
      </p>

      {scenarios.length === 0 && (
        <div style={{ textAlign: 'center', padding: '28px 0', color: C.faint, fontSize: 13 }}>
          No scenarios yet. Add your first scenario to start building the assignment.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {scenarios.map((scenario, sIdx) => {
          const open = openScenarios.has(scenario.id);
          return (
            <div key={scenario.id} style={{ borderRadius: 12, border: `1px solid ${C.divider}`, background: C.page, overflow: 'hidden' }}>
              {/* Scenario header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.faint, minWidth: 62 }}>SCENARIO {sIdx + 1}</span>
                <input
                  value={scenario.title}
                  onChange={e => updateScenario(scenario.id, { title: e.target.value })}
                  placeholder="Scenario title (e.g. Investigate the churn spike)"
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.cardBorder}`, background: C.card, color: C.text, fontSize: 14, fontWeight: 600, outline: 'none' }}
                  maxLength={200}
                />
                {iconBtn(() => moveScenario(sIdx, -1), sIdx === 0, <ArrowUp style={{ width: 14, height: 14 }} />, 'Move up')}
                {iconBtn(() => moveScenario(sIdx, 1), sIdx === scenarios.length - 1, <ArrowDown style={{ width: 14, height: 14 }} />, 'Move down')}
                {iconBtn(() => removeScenario(scenario.id), false, <Trash2 style={{ width: 14, height: 14 }} />, 'Delete scenario')}
                {iconBtn(() => toggle(openScenarios, setOpenScenarios, scenario.id), false, open ? <ChevronUp style={{ width: 15, height: 15 }} /> : <ChevronDown style={{ width: 15, height: 15 }} />, open ? 'Collapse' : 'Expand')}
              </div>

              {open && (
                <div style={{ padding: '0 12px 14px' }}>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 5 }}>Scenario intro <span style={{ fontWeight: 400, color: C.faint }}>(optional)</span></label>
                    <LessonEditor
                      doc={scenario.doc}
                      bodyFallback={scenario.description}
                      onChange={({ doc, body }) => updateScenario(scenario.id, { doc, description: body })}
                      placeholder="Set the context for this scenario. Add images, steps, callouts, tables..."
                      isDark={isDark}
                    />
                  </div>

                  {/* Tasks */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {scenario.tasks.map((task, tIdx) => {
                      const tOpen = openTasks.has(task.id);
                      return (
                        <div key={task.id} style={{ borderRadius: 10, border: `1px solid ${C.divider}`, background: C.card, overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10 }}>
                            <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: C.lime, color: C.cta, whiteSpace: 'nowrap' }}>
                              {TASK_TYPE_LABEL[task.type]}
                            </span>
                            <span style={{ flex: 1, fontSize: 13, color: task.title ? C.text : C.faint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {task.title || 'Untitled task'}
                            </span>
                            {iconBtn(() => moveTask(scenario.id, tIdx, -1), tIdx === 0, <ArrowUp style={{ width: 13, height: 13 }} />, 'Move up')}
                            {iconBtn(() => moveTask(scenario.id, tIdx, 1), tIdx === scenario.tasks.length - 1, <ArrowDown style={{ width: 13, height: 13 }} />, 'Move down')}
                            {iconBtn(() => removeTask(scenario.id, task.id), false, <Trash2 style={{ width: 13, height: 13 }} />, 'Delete task')}
                            {iconBtn(() => toggle(openTasks, setOpenTasks, task.id), false, tOpen ? <ChevronUp style={{ width: 14, height: 14 }} /> : <ChevronDown style={{ width: 14, height: 14 }} />, tOpen ? 'Collapse' : 'Expand')}
                          </div>
                          {tOpen && (
                            <div style={{ padding: '4px 12px 14px', borderTop: `1px solid ${C.divider}` }}>
                              <TaskFields task={task} onChange={u => updateTask(scenario.id, task.id, u)} C={C} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Add task */}
                  {addingFor === scenario.id ? (
                    <div style={{ marginTop: 10, padding: 12, borderRadius: 10, border: `1px dashed ${C.cardBorder}`, background: C.card }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>Choose a task type</span>
                        <button type="button" onClick={() => setAddingFor(null)} style={{ fontSize: 12, color: C.faint, background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {TASK_PALETTE.map(({ type, icon }) => (
                          <button key={type} type="button" onClick={() => addTask(scenario.id, type)}
                            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', borderRadius: 9, border: `1px solid ${C.cardBorder}`, background: C.input, color: C.text, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                            {icon} {TASK_TYPE_LABEL[type]}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setAddingFor(scenario.id)}
                      style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: `1px dashed ${C.cardBorder}`, background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
                      <Plus style={{ width: 14, height: 14 }} /> Add task
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
