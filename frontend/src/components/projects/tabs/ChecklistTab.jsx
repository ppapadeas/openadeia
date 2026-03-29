import Checklist from '../../nok/Checklist.jsx';

export default function ChecklistTab({ project }) {
  return <Checklist type={project.type} project={project} />;
}
