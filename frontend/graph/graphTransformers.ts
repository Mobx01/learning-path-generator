// frontend/graphTransformers.ts

export function transformBranchedGraph(backendData: { nodes: any[], edges: any[] }) {
  const { nodes, edges } = backendData;
  
  // 1. Calculate in-degrees to find the starting nodes (roots)
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  
  nodes.forEach(n => {
    adj.set(n.id, []);
    inDegree.set(n.id, 0);
  });
  
  edges.forEach(e => {
    adj.get(e.source)?.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
  });
  
  // 2. Assign Y-coordinate Levels (Depth)
  const levels = new Map<string, number>();
  let queue = nodes.filter(n => inDegree.get(n.id) === 0).map(n => n.id);
  
  let currentLevel = 0;
  while (queue.length > 0) {
    const nextQueue: string[] = [];
    for (const nodeId of queue) {
      levels.set(nodeId, currentLevel);
      
      const children = adj.get(nodeId) || [];
      for (const child of children) {
        const currentInDegree = inDegree.get(child) || 0;
        inDegree.set(child, currentInDegree - 1);
        // Only move to next level if all parent dependencies are met
        if (currentInDegree - 1 === 0) {
          nextQueue.push(child);
        }
      }
    }
    queue = nextQueue;
    currentLevel++;
  }
  
  // 3. Group by level to calculate X-coordinates
  const levelGroups = new Map<number, string[]>();
  nodes.forEach(n => {
    const lvl = levels.get(n.id) || 0;
    if (!levelGroups.has(lvl)) levelGroups.set(lvl, []);
    levelGroups.get(lvl)?.push(n.id);
  });
  
  // 4. Create React Flow Nodes
  const rfNodes = nodes.map(n => {
    const lvl = levels.get(n.id) || 0;
    const group = levelGroups.get(lvl) || [];
    const indexInGroup = group.indexOf(n.id);
    
    // Dynamically space branches out on the X-axis
    const xSpacing = 250;
    const totalWidth = (group.length - 1) * xSpacing;
    const startX = -(totalWidth / 2);
    
    return {
      id: n.id,
      data: { label: n.label },
      position: { x: startX + (indexInGroup * xSpacing), y: lvl * 150 },
      type: 'default',
      style: {
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '10px 20px',
        color: '#1e293b',
        fontWeight: 'bold',
        width: 180,
        textAlign: 'center',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
      }
    };
  });
  
  // 5. Create React Flow Edges
  const rfEdges = edges.map(e => ({
    id: `e-${e.source}-${e.target}`,
    source: e.source,
    target: e.target,
    animated: true,
    style: { stroke: '#94a3b8', strokeWidth: 2 }
  }));
  
  return { nodes: rfNodes, edges: rfEdges };
}