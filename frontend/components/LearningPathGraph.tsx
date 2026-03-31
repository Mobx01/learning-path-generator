"use client";

import React, { useCallback, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  NodeMouseHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { transformPathToGraph } from '../graph/graphTransformers';

export default function LearningPathGraph() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGeneratePath = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setError(null);
    setNodes([]);
    setEdges([]);
    setSelectedTopic(null);

    try {
      const response = await fetch('http://localhost:8000/generate-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: searchQuery }),
      });

      // 🚨 Extract the exact error message sent by FastAPI's HTTPException
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to generate path from backend.");
      }

      const data = await response.json();
      
      // Handle the data whether FastAPI returns an array directly or an object like {"path": [...]}
      const pathArray = Array.isArray(data) ? data : data.path; 
      
      if (!pathArray || pathArray.length === 0) {
         throw new Error("No path generated for this topic.");
      }

      // Transform and set the graph
      const { nodes: newNodes, edges: newEdges } = transformPathToGraph(pathArray);
      setNodes(newNodes);
      setEdges(newEdges);
      
    } catch (err: any) {
      setError(err.message); // Displays the real error (e.g., "Topic not found")
    } finally {
      setIsLoading(false);
    }
  };

  const onNodeClick: NodeMouseHandler = useCallback((event, node) => {
    setSelectedTopic(node.data.label);
  }, []);

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 text-black">
      {/* Top Navigation & Search Bar */}
      <div className="p-4 bg-white shadow-sm border-b border-gray-200 z-10 flex gap-4 items-center">
        <h1 className="font-bold text-xl mr-4 whitespace-nowrap">AI Path Generator</h1>
        <form onSubmit={handleGeneratePath} className="flex gap-2 w-full max-w-xl">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="What do you want to learn? (e.g. Python)"
            className="flex-grow p-2 border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {isLoading ? 'Generating...' : 'Generate Graph'}
          </button>
        </form>
        {error && <span className="text-red-500 font-medium text-sm overflow-hidden text-ellipsis">{error}</span>}
      </div>

      {/* Main Interactive Graph Area */}
      <div className="flex flex-grow overflow-hidden">
        <div className="flex-grow h-full border-r border-gray-200 relative">
          {nodes.length === 0 && !isLoading && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 pointer-events-none">
              Enter a topic above to generate your learning path.
            </div>
          )}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            fitView
          >
            <Background color="#ccc" gap={16} />
            <Controls />
            <MiniMap nodeStrokeWidth={3} zoomable pannable />
          </ReactFlow>
        </div>

        {/* Side panel for Phase 5 (Resources) */}
        <div className="w-1/3 p-6 bg-white shadow-lg overflow-y-auto text-black">
          <h2 className="text-2xl font-bold mb-4 border-b pb-2">Topic Explorer</h2>
          {selectedTopic ? (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-xl font-semibold text-blue-600">{selectedTopic}</h3>
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-gray-700 text-sm mb-2 font-medium">Coming up in Phase 5:</p>
                <ul className="list-disc list-inside text-gray-600 space-y-1 text-sm ml-2">
                  <li>Fetch descriptions from PostgreSQL</li>
                  <li>Link video tutorials</li>
                  <li>Link articles & documentation</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                <span className="text-gray-400 text-2xl">👆</span>
              </div>
              <p className="text-gray-500 italic">Click on any node in the graph to view its details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}