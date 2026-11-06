import { Button, Popover } from '@qbeka/react';
import { useCallback, useRef, useState } from 'react';
import { DiagnosticPanel, useDiagnostics } from './Diagnostics';
import { ProjectRow } from './ProjectRow';
import { PROJECTS, type Project } from './projects-data';

export function ProjectsApp() {
  const [projects, setProjects] = useState(PROJECTS);
  const [archived, setArchived] = useState<{ project: Project; index: number } | null>(null);
  const [failNext, setFailNext] = useState(false);
  const [slowSave, setSlowSave] = useState(false);
  const [diagnostics, setDiagnostics] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { state, onTrace } = useDiagnostics(diagnostics, useCallback(() => listRef.current, []));

  const update = (next: Project) => setProjects((list) => list.map((p) => (p.id === next.id ? next : p)));

  const archive = (project: Project) => {
    setProjects((list) => {
      setArchived({ project, index: list.indexOf(project) });
      return list.filter((p) => p !== project);
    });
  };

  const restore = () => {
    if (!archived) return;
    setProjects((list) => [...list.slice(0, archived.index), archived.project, ...list.slice(archived.index)]);
    setArchived(null);
  };

  return (
    <section className="ex-app">
      <header className="ex-app-head">
        <h1 ref={headingRef} tabIndex={-1}>Projects</h1>
        <div className="ex-app-tools">
          <label className="ex-check"><input type="checkbox" checked={failNext} onChange={(e) => setFailNext(e.target.checked)} /> Fail saves</label>
          <label className="ex-check"><input type="checkbox" checked={slowSave} onChange={(e) => setSlowSave(e.target.checked)} /> Slow saves</label>
          <label className="ex-check"><input type="checkbox" data-testid="toggle-diagnostics" checked={diagnostics} onChange={(e) => setDiagnostics(e.target.checked)} /> Diagnostics</label>
          <Popover.Root>
            <Popover.Trigger render={<Button variant="ghost">How this works</Button>} />
            <Popover.Content title="How this works">
              <p className="ex-popover-text">Each row is one element that changes shape. Nothing is copied, so your typing and your selection stay. The newest request wins, and work that finishes late cannot undo it.</p>
            </Popover.Content>
          </Popover.Root>
        </div>
      </header>

      <div ref={listRef} className="ex-list" data-testid="project-list">
        {projects.map((project) => (
          <ProjectRow key={project.id} project={project} onChange={update} onArchive={() => archive(project)} saveOptions={{ delay: slowSave ? 2500 : 700, fail: failNext }} onTrace={onTrace} fallbackFocusRef={headingRef} />
        ))}
        {projects.length === 0 ? <p className="ex-empty">No projects left. {archived ? 'Restore the last one, or reload for the full list.' : 'Reload the page for the full list.'}</p> : null}
      </div>

      <p className="ex-toast" role="status">
        {archived ? <>Archived {archived.project.name}. <button type="button" className="ex-inline" onClick={restore}>Undo</button></> : null}
      </p>

      {diagnostics ? <DiagnosticPanel state={state} /> : null}
    </section>
  );
}
