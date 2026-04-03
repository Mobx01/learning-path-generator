"use client";

import React, { useCallback, useState, useEffect } from 'react';
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

interface Resource {
  id: number;
  title: string;
  url: string;
  resource_type: string;
  difficulty: string;
}

export default function LearningPathGraph() {
  // Hardcoded for Phase 8 prototyping
  const currentUserId = 1;

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [allTopics, setAllTopics] = useState<any[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoadingResources, setIsLoadingResources] = useState(false);

  const [isExpanding, setIsExpanding] = useState(false);
  const [isMarkingKnown, setIsMarkingKnown] = useState(false);

  useEffect(() => {
    fetch('http://localhost:8000/topics/')
      .then(res => res.json())
      .then(data => setAllTopics(data))
      .catch(err => console.error("Failed to load topics:", err));
  }, []);

  const handleGeneratePath = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setError(null);
    setNodes([]);
    setEdges([]);
    setSelectedTopic(null);
    setSelectedTopicId(null);
    setResources([]);

    try {
      const response = await fetch('http://localhost:8000/generate-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Phase 8: Pass user_id to prune the graph!
        body: JSON.stringify({ topic: searchQuery, user_id: currentUserId }),
      });

      if (!response.ok) throw new Error("Failed to generate path.");

      const data = await response.json();
      const pathArray = Array.isArray(data) ? data : data.path; 

      const { nodes: newNodes, edges: newEdges } = transformPathToGraph(pathArray);
      setNodes(newNodes);
      setEdges(newEdges);
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExpandTopic = async () => {
    if (!selectedTopic) return;
    setIsExpanding(true);
    try {
      const response = await fetch('http://localhost:8000/expand-topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: selectedTopic, user_id: currentUserId }),
      });

      if (!response.ok) throw new Error("Failed to expand topic.");

      const data = await response.json();
      const pathArray = Array.isArray(data) ? data : data.path; 
      
      const { nodes: newNodes, edges: newEdges } = transformPathToGraph(pathArray);
      setNodes(newNodes);
      setEdges(newEdges);
      
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsExpanding(false);
    }
  };

  // Phase 8: Mark topic as known and re-render graph
  const handleMarkAsKnown = async () => {
    if (!selectedTopicId) return;
    setIsMarkingKnown(true);
    try {
      const response = await fetch(`http://localhost:8000/users/${currentUserId}/known-topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id: selectedTopicId }),
      });

      if (response.ok) {
        // Re-generate the graph to show the pruned tree
        await handleGeneratePath();
      }
    } catch (err) {
      console.error("Failed to mark as known", err);
    } finally {
      setIsMarkingKnown(false);
    }
  };

  const onNodeClick: NodeMouseHandler = useCallback(async (event, node) => {
    const clickedName = node.data.label;
    setSelectedTopic(clickedName);
    setResources([]);
    
    const matchedTopic = allTopics.find(t => t.topic_name === clickedName);
    
    if (matchedTopic) {
      setSelectedTopicId(matchedTopic.topic_id);
      setIsLoadingResources(true);
      try {
        const res = await fetch(`http://localhost:8000/topics/${matchedTopic.topic_id}/resources`);
        if (res.ok) {
          const data = await res.json();
          setResources(data);
        }
      } catch (err) {
        console.error("Failed to fetch resources:", err);
      } finally {
        setIsLoadingResources(false);
      }
    } else {
      setSelectedTopicId(null);
    }
  }, [allTopics]);

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 text-black">
      <div className="p-4 bg-white shadow-sm border-b border-gray-200 z-10 flex gap-4 items-center">
        <h1 className="font-bold text-xl mr-4 whitespace-nowrap">AI Path Generator</h1>
        <form onSubmit={handleGeneratePath} className="flex gap-2 w-full max-w-xl">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="What do you want to learn? (e.g. Machine Learning)"
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
        {error && <span className="text-red-500 font-medium text-sm">{error}</span>}
      </div>

      <div className="flex flex-grow overflow-hidden">
        <div className="flex-grow h-full border-r border-gray-200 relative">
          {nodes.length === 0 && !isLoading && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 pointer-events-none">
              Enter a topic above to generate your learning path.
            </div>
          )}
          <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={onNodeClick} fitView>
            <Background color="#ccc" gap={16} />
            <Controls />
            <MiniMap nodeStrokeWidth={3} zoomable pannable />
          </ReactFlow>
        </div>

        <div className="w-1/3 bg-white shadow-lg overflow-y-auto text-black flex flex-col">
          <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <h2 className="text-2xl font-bold">Topic Explorer</h2>
            <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">User ID: {currentUserId}</span>
          </div>
          
          <div className="p-6 flex-grow">
            {selectedTopic ? (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-blue-600">{selectedTopic}</h3>
                </div>
                
                {/* Phase 7 & 8 Action Buttons */}
                <div className="flex gap-2 mb-6">
                  <button 
                    onClick={handleExpandTopic}
                    disabled={isExpanding}
                    className="bg-purple-100 text-purple-700 text-xs font-bold px-3 py-1.5 rounded-md hover:bg-purple-200 transition-colors flex-1"
                  >
                    {isExpanding ? '✨ Expanding...' : '✨ Expand with AI'}
                  </button>
                  <button 
                    onClick={handleMarkAsKnown}
                    disabled={isMarkingKnown || !selectedTopicId}
                    className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1.5 rounded-md hover:bg-green-200 transition-colors flex-1"
                  >
                    {isMarkingKnown ? 'Saving...' : '✅ I know this'}
                  </button>
                </div>
                
                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Recommended Resources</h4>
                
                {isLoadingResources ? (
                  <div className="flex justify-center p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : resources.length > 0 ? (
                  <div className="space-y-3">
                    {resources.map((res) => (
                      <a key={res.id} href={res.url} target="_blank" rel="noopener noreferrer" className="block p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all bg-white group">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-100 text-blue-700">{res.resource_type}</span>
                          <span className="text-xs text-gray-500 capitalize">{res.difficulty}</span>
                        </div>
                        <h5 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">{res.title}</h5>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <p className="text-gray-500">No resources added for this topic yet.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center mt-20">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4"><span className="text-blue-300 text-3xl">👆</span></div>
                <p className="text-gray-500 font-medium">Click on any node in the graph</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}