// frontend/graphTransformers.ts
import { Node, Edge } from 'reactflow';
import dagre from 'dagre';

export interface BackendNode {
  id: string;
  label: string;
  is_completed?: boolean;
}

export interface BackendEdge {
  source: string;
  target: string;
}

export interface BackendGraphData {
  nodes: BackendNode[];
  edges: BackendEdge[];
}

const nodeWidth = 200;
const nodeHeight = 60;

export const transformBranchedGraph = (data: BackendGraphData) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // Configure Dagre layout engine
  dagreGraph.setGraph({
    rankdir: 'TB', // Top to Bottom layout
    nodesep: 30,   // Horizontal spacing between nodes
    ranksep: 80,   // Vertical spacing between levels
  });

  // 1. Add nodes to the layout engine
  data.nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  // 2. Add edges to the layout engine
  data.edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // 3. Calculate the optimal layout!
  dagre.layout(dagreGraph);

  // 4. Map the calculated positions back to React Flow nodes
  const nodes: Node[] = data.nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const isCompleted = node.is_completed;

    return {
      id: node.id,
      // We explicitly define target/source handles so smoothstep lines route properly
      targetPosition: 'top' as any, 
      sourcePosition: 'bottom' as any,
      // Dagre returns the center point, but React Flow needs the top-left coordinate:
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
      data: { label: node.label },
      type: 'default',
      style: isCompleted
        ? { 
            backgroundColor: '#dcfce7', 
            border: '2px solid #22c55e', 
            color: '#166534', 
            fontWeight: 'bold', 
            width: nodeWidth,
            borderRadius: '8px',
            padding: '10px',
            textAlign: 'center'
          }
        : { 
            backgroundColor: '#fff', 
            border: '1px solid #e2e8f0', 
            color: '#1e293b', 
            fontWeight: 'bold', 
            width: nodeWidth,
            borderRadius: '8px',
            padding: '10px',
            textAlign: 'center',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
          }
    };
  });

  // 5. Create React Flow Edges with smoothstep
  const edges: Edge[] = data.edges.map((edge, index) => ({
    id: `e-${edge.source}-${edge.target}-${index}`,
    source: edge.source,
    target: edge.target,
    animated: true,
    type: 'smoothstep', // Gives edges a structured, right-angled flow instead of messy straight lines
    style: { stroke: '#94a3b8', strokeWidth: 2 },
  }));

  return { nodes, edges };
};