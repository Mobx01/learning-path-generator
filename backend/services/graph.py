from collections import defaultdict, deque
from sqlalchemy.orm import Session
from models import models

def generate_learning_path(db: Session, target_topic_name: str, user_id: int = None):
    # 1. Clean input (remove trailing spaces)
    clean_name = target_topic_name.strip()
    
    # 2. Find the target topic (ilike allows case-insensitive matching)
    target = db.query(models.Topic).filter(models.Topic.topic_name.ilike(f"%{clean_name}%")).first()
    if not target:
        raise ValueError(f"Topic '{clean_name}' not found in database.")

    # Fetch all data
    all_topics = db.query(models.Topic).all()
    all_deps = db.query(models.TopicDependency).all()

    # Map IDs to Names for the final output
    id_to_name = {t.topic_id: t.topic_name for t in all_topics}

    # ==========================================
    # PHASE 8 LOGIC: Fetch user's known topics
    # ==========================================
    known_topic_ids = set()
    if user_id:
        known_records = db.query(models.UserKnownTopic).filter(models.UserKnownTopic.user_id == user_id).all()
        known_topic_ids = {record.topic_id for record in known_records}

    # 3. Construct directed graph using IDs (Safest method!)
    reverse_adj = defaultdict(list) # Child ID -> Parent IDs (Prerequisites)
    forward_adj = defaultdict(list) # Parent ID -> Child IDs (Next Steps)
    
    for dep in all_deps:
        reverse_adj[dep.child_topic_id].append(dep.parent_topic_id)
        forward_adj[dep.parent_topic_id].append(dep.child_topic_id)

# 4. Find all required node IDs using a queue
    required_ids = set()
    queue = deque([target.topic_id]) # Start the queue using the true ID!
    
    while queue:
        curr_id = queue.popleft()
        
        # If we already processed it, skip
        if curr_id in required_ids:
            continue
            
        # ==========================================
        # PHASE 8 PRUNING: If the user already knows this topic,
        # skip it entirely so it disappears from the graph!
        # (We keep the target_topic visible so the graph doesn't go blank)
        # ==========================================
        if curr_id in known_topic_ids and curr_id != target.topic_id:
            continue
            
        required_ids.add(curr_id)
        
        # Fetch prerequisites
        for parent_id in reverse_adj[curr_id]:
            queue.append(parent_id)


    # 5. Cycle Detection & Topological Sorting
    in_degree = {n: 0 for n in required_ids}
    for n in required_ids:
        for child_id in forward_adj[n]:
            if child_id in required_ids:
                in_degree[child_id] += 1

    topo_order_ids = []
    zero_in_degree = deque([n for n in required_ids if in_degree[n] == 0])

    while zero_in_degree:
        curr_id = zero_in_degree.popleft()
        topo_order_ids.append(curr_id)
        for child_id in forward_adj[curr_id]:
            if child_id in required_ids:
                in_degree[child_id] -= 1
                if in_degree[child_id] == 0:
                    zero_in_degree.append(child_id)

    # ... keep your cycle detection code ...
    if len(topo_order_ids) != len(required_ids):
        raise ValueError("Invalid Graph: Cycle detected in prerequisites!")

    # ==========================================
    # MULTI-BRANCH FIX: Return true nodes & edges
    # ==========================================
    result_nodes = [{"id": str(tid), "label": id_to_name[tid]} for tid in topo_order_ids]
    
    result_edges = []
    for parent_id in required_ids:
        for child_id in forward_adj[parent_id]:
            # Only include edges that are part of the pruned required path
            if child_id in required_ids:
                result_edges.append({
                    "source": str(parent_id),
                    "target": str(child_id)
                })

    return {
        "graph_data": {
            "nodes": result_nodes,
            "edges": result_edges
        },
        "path": [id_to_name[topic_id] for topic_id in topo_order_ids] # Kept for fallback
    }