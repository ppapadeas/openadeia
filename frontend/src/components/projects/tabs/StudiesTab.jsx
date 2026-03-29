import DocList from '../../documents/DocList.jsx';

export default function StudiesTab({ projectId, projectType }) {
  return <DocList projectId={projectId} type={projectType} studiesOnly />;
}
