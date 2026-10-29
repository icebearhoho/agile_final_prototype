import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Field, inputClass } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import type { ClassRecord } from "../../../data/schoolMgmt";
import { LEVELS, type Level, type Student } from "../../../data/students";
import { classNamesFor } from "../../../lib/registry";

const FORM_ID = "move-class-form";

type Props = {
  student: Student | null;
  classes: ClassRecord[];
  school?: string;
  onClose: () => void;
  onMove: (s: Student, p: { level: Level; class: string }) => void;
};

/** School view: move a student to another class (and level) within the school. */
export default function MoveClassModal({ student, classes: allClasses, school, onClose, onMove }: Props) {
  const [v, setV] = useState({ level: "", class: "" });
  useEffect(() => setV({ level: student?.level ?? "", class: student?.class ?? "" }), [student]);
  const levels = LEVELS.filter((l) => classNamesFor(allClasses, l, school).length > 0);
  const classes = LEVELS.includes(v.level as Level) ? classNamesFor(allClasses, v.level as Level, school) : [];
  const unchanged = v.class === student?.class && v.level === student?.level;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!student || !v.level || !v.class || unchanged) return;
    onMove(student, { level: v.level as Level, class: v.class });
    onClose();
  };

  return (
    <Modal
      open={!!student}
      onClose={onClose}
      title={`Move ${student?.name ?? ""} to another class`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form={FORM_ID} disabled={!v.class || unchanged}>Move student</Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field required label="Level">
          <select className={inputClass} value={v.level} onChange={(e) => setV({ level: e.target.value, class: "" })}>
            <option value="">Select level</option>
            {levels.map((l) => <option key={l}>{l}</option>)}
          </select>
        </Field>
        <Field required label="Class">
          <select className={inputClass} value={v.class} onChange={(e) => setV({ ...v, class: e.target.value })}>
            <option value="">Select class</option>
            {classes.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
      </form>
    </Modal>
  );
}
