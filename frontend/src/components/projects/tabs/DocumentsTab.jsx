import DocList from '../../documents/DocList.jsx';

export default function DocumentsTab({ projectId, projectType }) {
  return <DocList projectId={projectId} type={projectType} />;
}
