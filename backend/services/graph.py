from collections import defaultdict, deque
from sqlalchemy.orm import Session
from models import models

def generate_learning_path(db: Session, target_topic_name: str):
    # 1. Verify the target topic exists
    target = db.query(models.Topic).filter(models.Topic.topic_name == target_topic_name).first()
    if not target:
        raise ValueError(f"Topic '{target_topic_name}' not found.")

    # 2. Fetch all topics and dependencies to construct the graph
    all_topics = db.query(models.Topic).all()
    all_deps = db.query(models.TopicDependency).all()

    # Create a quick dictionary to look up names by their ID
    id_to_name = {t.topic_id: t.topic_name for t in all_topics}

    # 3. Construct directed graph structures (Forward and Reverse)
    reverse_adj = defaultdict(list) # Child -> Parents (to find prerequisites)
    forward_adj = defaultdict(list) # Parent -> Child (to find learning order)
    
    for dep in all_deps:
        p_name = id_to_name[dep.parent_topic_id]
        c_name = id_to_name[dep.child_topic_id]
        reverse_adj[c_name].append(p_name)
        forward_adj[p_name].append(c_name)

    # 4. Find all required nodes (Target + all its ancestors) using a queue
    required_nodes = set()
    queue = deque([target_topic_name])
    
    while queue:
        curr = queue.popleft()
        if curr not in required_nodes:
            required_nodes.add(curr)
            for parent in reverse_adj[curr]:
                queue.append(parent)

    # 5. Cycle Detection & Topological Sorting (Kahn's Algorithm)
    in_degree = {node: 0 for node in required_nodes}
    for node in required_nodes:
        for child in forward_adj[node]:
            if child in required_nodes:
                in_degree[child] += 1

    topo_order = []
    # Start with topics that have 0 prerequisites
    zero_in_degree = deque([n for n in required_nodes if in_degree[n] == 0])

    while zero_in_degree:
        curr = zero_in_degree.popleft()
        topo_order.append(curr)
        for child in forward_adj[curr]:
            if child in required_nodes:
                in_degree[child] -= 1
                if in_degree[child] == 0:
                    zero_in_degree.append(child)

    # If the sorted list doesn't contain all nodes, there is an infinite loop!
    if len(topo_order) != len(required_nodes):
        raise ValueError("Invalid Graph: Cycle detected in prerequisites!")

    return topo_order