import { Node, Edge } from 'reactflow';

export const transformPathToGraph = (data: any[]) => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  if (!data || data.length === 0) return { nodes, edges };

  // =================================================================
  // SCENARIO A: Backend sent a flat array of strings (Topological Sort)
  // e.g., ["Linear Algebra", "Python", "Machine Learning"]
  // =================================================================
  if (typeof data[0] === 'string') {
    data.forEach((topic: string, index: number) => {
      nodes.push({
        id: topic,
        data: { label: topic },
        position: { x: 250, y: index * 100 }, // Space vertically
        type: 'default',
      });

      if (index > 0) {
        const prevTopic = data[index - 1];
        edges.push({
          id: `e-${prevTopic}-${topic}`,
          source: prevTopic,
          target: topic,
          animated: true,
        });
      }
    });
  } 
  // =================================================================
  // SCENARIO B: Backend sent database relationship objects
  // e.g., [{"parent_topic_id": 1, "child_topic_id": 4}]
  // =================================================================
  else if (typeof data[0] === 'object' && 'parent_topic_id' in data[0]) {
    const addedNodeIds = new Set<string>();
    let yOffset = 0;

    data.forEach((rel) => {
      const sourceId = String(rel.parent_topic_id);
      const targetId = String(rel.child_topic_id);

      if (!addedNodeIds.has(sourceId)) {
        addedNodeIds.add(sourceId);
        nodes.push({
          id: sourceId,
          data: { label: `Topic ID: ${sourceId}` },
          position: { x: (Math.random() * 100) + 150, y: yOffset },
          type: 'default',
        });
        yOffset += 100;
      }

      if (!addedNodeIds.has(targetId)) {
        addedNodeIds.add(targetId);
        nodes.push({
          id: targetId,
          data: { label: `Topic ID: ${targetId}` },
          position: { x: (Math.random() * 100) + 150, y: yOffset },
          type: 'default',
        });
        yOffset += 100;
      }

      edges.push({
        id: `e-${sourceId}-${targetId}`,
        source: sourceId,
        target: targetId,
        animated: true,
      });
    });
  }

  return { nodes, edges };
};