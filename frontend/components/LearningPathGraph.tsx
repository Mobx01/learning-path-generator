"use client";

import React, { useCallback, useState, useEffect, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  NodeMouseHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { transformBranchedGraph } from '../graph/graphTransformers';
import { useSession, signIn, signOut } from 'next-auth/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Resource { id: number; title: string; url: string; resource_type: string; difficulty: string; }
interface Project { id: number; title: string; description: string; difficulty: string; }

export default function LearningPathGraph() {
  // --- NextAuth Integration ---
  const { data: session, status } = useSession();
  
  // Dynamically grab the logged in user ID instead of hardcoding 1
  const currentUserId = session?.user && (session.user as any).id 
    ? parseInt((session.user as any).id) 
    : null;

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [allTopics, setAllTopics] = useState<any[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const [isExpanding, setIsExpanding] = useState(false);
  const [isMarkingKnown, setIsMarkingKnown] = useState(false);

  const [completedTopicIds, setCompletedTopicIds] = useState<number[]>([]);
  const [isTogglingCompletion, setIsTogglingCompletion] = useState(false);

  const fetchAllTopics = async () => {
    try {
      const res = await fetch(`${API_URL}/topics/`);
      if (res.ok) {
        setAllTopics(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch topics:", err);
    }
  };

  const fetchCompletedTopics = async () => {
    if (!currentUserId) return;
    try {
      const res = await fetch(`${API_URL}/users/${currentUserId}/completed-topics`);
      if (res.ok) {
        setCompletedTopicIds(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (currentUserId) {
      fetchAllTopics();
      fetchCompletedTopics();
    }
  }, [currentUserId]);

  const handleGeneratePath = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim() || !currentUserId) return;

    setIsLoading(true); setError(null); setNodes([]); setEdges([]);
    setSelectedTopic(null); setSelectedTopicId(null); setResources([]); setProjects([]);

    try {
      const response = await fetch(`${API_URL}/generator/generate-path`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: searchQuery, user_id: currentUserId }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || errData.detail || "Failed to generate path.");
      }

      const data = await response.json();
      const { nodes: newNodes, edges: newEdges } = transformBranchedGraph(data.graph_data);
      
      const styledNodes = newNodes.map(node => {
        const matchedTopic = allTopics.find(t => t.topic_name.toLowerCase() === node.data.label.toLowerCase());
        if (matchedTopic && completedTopicIds.includes(matchedTopic.topic_id)) {
          return { ...node, style: { backgroundColor: '#dcfce7', border: '2px solid #22c55e', color: '#166534', fontWeight: 'bold' } };
        }
        return node;
      });

      setNodes(styledNodes);
      setEdges(newEdges);
      
      await fetchAllTopics();
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (nodes.length > 0) {
      setNodes(nds => nds.map(node => {
        const matchedTopic = allTopics.find(t => t.topic_name.toLowerCase() === node.data.label.toLowerCase());
        const isComplete = matchedTopic && completedTopicIds.includes(matchedTopic.topic_id);
        return { 
          ...node, 
          style: isComplete 
            ? { backgroundColor: '#dcfce7', border: '2px solid #22c55e', color: '#166534', fontWeight: 'bold' } 
            : undefined
        };
      }));
    }
  }, [completedTopicIds, allTopics, setNodes]);

  const progressStats = useMemo(() => {
    if (nodes.length === 0) return { percent: 0, completed: 0, total: 0 };
    let completedCount = 0;
    nodes.forEach(n => {
      const matched = allTopics.find(t => t.topic_name.toLowerCase() === n.data.label.toLowerCase());
      if (matched && completedTopicIds.includes(matched.topic_id)) completedCount++;
    });
    return {
      percent: Math.round((completedCount / nodes.length) * 100),
      completed: completedCount,
      total: nodes.length
    };
  }, [nodes, allTopics, completedTopicIds]);

  const handleToggleCompletion = async () => {
    if (!selectedTopicId || !currentUserId) return;
    setIsTogglingCompletion(true);
    const isCurrentlyCompleted = completedTopicIds.includes(selectedTopicId);
    try {
      if (isCurrentlyCompleted) {
        await fetch(`${API_URL}/users/${currentUserId}/completed-topics/${selectedTopicId}`, { method: 'DELETE' });
      } else {
        await fetch(`${API_URL}/users/${currentUserId}/completed-topics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic_id: selectedTopicId }),
        });
      }
      await fetchCompletedTopics();
    } catch (err) {
      console.error(err);
    } finally {
      setIsTogglingCompletion(false);
    }
  };

  const handleExpandTopic = async () => {
    if (!selectedTopic || !currentUserId) return;
    setIsExpanding(true);
    try {
      const response = await fetch(`${API_URL}/generator/expand-topic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: selectedTopic, user_id: currentUserId }),
      });
      if (response.ok) {
        const data = await response.json();
        const { nodes: newNodes, edges: newEdges } = transformBranchedGraph(data.graph_data);
        
        const styledNodes = newNodes.map(node => {
          const matchedTopic = allTopics.find(t => t.topic_name.toLowerCase() === node.data.label.toLowerCase());
          if (matchedTopic && completedTopicIds.includes(matchedTopic.topic_id)) {
            return { ...node, style: { backgroundColor: '#dcfce7', border: '2px solid #22c55e', color: '#166534', fontWeight: 'bold' } };
          }
          return node;
        });

        setNodes(styledNodes);
        setEdges(newEdges);
        await fetchAllTopics();
      }
    } catch (err: any) { console.error(err); } finally { setIsExpanding(false); }
  };

  const handleMarkAsKnown = async () => {
    if (!selectedTopicId || !currentUserId) return;
    setIsMarkingKnown(true);
    try {
      const response = await fetch(`${API_URL}/users/${currentUserId}/known-topics`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id: selectedTopicId }),
      });
      if (response.ok) await handleGeneratePath();
    } catch (err) { console.error(err); } finally { setIsMarkingKnown(false); }
  };

  const onNodeClick: NodeMouseHandler = useCallback(async (event, node) => {
    const clickedName = node.data.label;
    setSelectedTopic(clickedName); setResources([]); setProjects([]);
    
    const matchedTopic = allTopics.find(t => t.topic_name.toLowerCase() === clickedName.toLowerCase());
    
    if (matchedTopic) {
      setSelectedTopicId(matchedTopic.topic_id);
      setIsLoadingData(true);
      try {
        const [resResponse, projResponse] = await Promise.all([
          fetch(`${API_URL}/topics/${matchedTopic.topic_id}/resources`),
          fetch(`${API_URL}/topics/${matchedTopic.topic_id}/projects`)
        ]);
        if (resResponse.ok) setResources(await resResponse.json());
        if (projResponse.ok) setProjects(await projResponse.json());
      } catch (err) { console.error(err); } finally { setIsLoadingData(false); }
    } else { 
      setSelectedTopicId(null); 
    }
  }, [allTopics]);

  // --- Auth Wall Render ---
  if (status === "loading") {
    return <div className="flex items-center justify-center h-screen bg-slate-50 text-black">Loading...</div>;
  }

  if (status === "unauthenticated" || !currentUserId) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 text-black">
        <h2 className="text-2xl font-bold mb-4">AI Learning Path Generator</h2>
        <p className="mb-6 text-gray-600">You must be logged in to view and generate your learning paths.</p>
        <button 
          onClick={() => signIn()} 
          className="px-6 py-2 text-white bg-blue-600 hover:bg-blue-700 font-bold rounded-md transition-colors"
        >
          Log In
        </button>
      </div>
    );
  }

  // --- Main App Render ---
  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 text-black">
      <div className="p-4 bg-white shadow-sm border-b border-gray-200 z-10 flex gap-4 items-center justify-between">
        <div className="flex items-center gap-4 flex-grow">
          <h1 className="font-bold text-xl mr-4 whitespace-nowrap">AI Path Generator</h1>
          <form onSubmit={handleGeneratePath} className="flex gap-2 w-full max-w-xl">
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="What do you want to learn?" className="flex-grow p-2 border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            <button type="submit" disabled={isLoading} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap">
              {isLoading ? 'Generating...' : 'Generate Graph'}
            </button>
          </form>
          {error && <span className="text-red-500 font-medium text-sm">{error}</span>}
        </div>
        
        {/* User Menu / Logout */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600 font-medium">Hello, {session?.user?.name}</span>
          <button 
            onClick={() => signOut()} 
            className="text-sm bg-gray-200 text-gray-700 hover:bg-gray-300 px-3 py-1.5 rounded-md transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>

      <div className="flex flex-grow overflow-hidden">
        {/* GRAPH AREA */}
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

        {/* SIDE PANEL */}
        <div className="w-1/3 bg-white shadow-lg overflow-y-auto text-black flex flex-col">
          <div className="p-6 border-b border-gray-100 bg-gray-50 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Dashboard</h2>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">User ID: {currentUserId}</span>
            </div>
            
            {nodes.length > 0 && (
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-sm font-bold text-gray-600">Learning Progress</span>
                  <span className="text-xl font-black text-green-600">{progressStats.percent}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 mb-1">
                  <div className="bg-green-500 h-2.5 rounded-full transition-all duration-500 ease-in-out" style={{ width: `${progressStats.percent}%` }}></div>
                </div>
                <span className="text-xs text-gray-400">{progressStats.completed} of {progressStats.total} modules completed</span>
              </div>
            )}
          </div>
          
          <div className="p-6 flex-grow">
            {selectedTopic ? (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-blue-600">{selectedTopic}</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mb-6">
                  {selectedTopicId && (
                    <button 
                      onClick={handleToggleCompletion}
                      disabled={isTogglingCompletion}
                      className={`col-span-2 py-2 rounded-md font-bold text-sm transition-colors flex items-center justify-center gap-2 ${
                        completedTopicIds.includes(selectedTopicId)
                        ? 'bg-green-600 text-white hover:bg-green-700 shadow-inner'
                        : 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100'
                      }`}
                    >
                      {completedTopicIds.includes(selectedTopicId) ? '🏆 Completed! (Click to Undo)' : '✔️ Mark as Completed'}
                    </button>
                  )}
                  <button 
                    onClick={handleExpandTopic} disabled={isExpanding}
                    className="bg-purple-100 text-purple-700 text-xs font-bold px-3 py-2 rounded-md hover:bg-purple-200 transition-colors"
                  >
                    {isExpanding ? '✨ Expanding...' : '✨ Deepen via AI'}
                  </button>
                  <button 
                    onClick={handleMarkAsKnown} disabled={isMarkingKnown || !selectedTopicId}
                    className="bg-gray-100 text-gray-700 text-xs font-bold px-3 py-2 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    {isMarkingKnown ? 'Pruning...' : '✂️ Prune Node'}
                  </button>
                </div>
                
                {isLoadingData ? (
                  <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
                ) : (
                  <>
                    <div className="mb-8">
                      <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2"><span className="text-orange-500">🚀</span> Milestone Projects</h4>
                      {projects.length > 0 ? (
                        <div className="space-y-3">
                          {projects.map((proj) => (
                            <div key={proj.id} className="p-4 rounded-lg border border-orange-200 bg-orange-50 shadow-sm">
                              <div className="flex justify-between items-start mb-2"><h5 className="font-bold text-orange-900">{proj.title}</h5></div>
                              {proj.description && <p className="text-sm text-gray-700 leading-relaxed">{proj.description}</p>}
                            </div>
                          ))}
                        </div>
                      ) : (<p className="text-sm text-gray-400 italic">No projects added yet.</p>)}
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2"><span className="text-blue-500">📚</span> Learning Resources</h4>
                      {resources.length > 0 ? (
                        <div className="space-y-3">
                          {resources.map((res) => (
                            <a key={res.id} href={res.url} target="_blank" rel="noopener noreferrer" className="block p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all bg-white group">
                              <h5 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">{res.title}</h5>
                            </a>
                          ))}
                        </div>
                      ) : (<p className="text-sm text-gray-400 italic">No resources added yet.</p>)}
                    </div>
                  </>
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