# Graph-First Query Reference

## The Rule

Before reading files from the codebase, query the knowledge graph.

The project has a pre-built graph with 9,315 nodes and exact `source_file` paths. This eliminates blind exploration — you know where things are before you read.

---

## Python Query (Primary Method)

Use when you need to find related files, understand call graphs, or map service dependencies.

```python
import json
from pathlib import Path
from networkx.readwrite import json_graph
import networkx as nx

# Load the graph — networkx 3.x: do NOT pass edges='links', it causes TypeError
GRAPH_PATH = Path('graphify-out/graph.json')
G = json_graph.node_link_graph(
    json.loads(GRAPH_PATH.read_text())
)

def find_related_files(term: str, depth: int = 2) -> list[str]:
    """
    Find source files related to a given term.
    
    Args:
        term: Search term (class name, module keyword, etc.)
        depth: BFS depth (1 = direct neighbors, 2 = neighbors of neighbors, etc.)
    
    Returns:
        Sorted list of absolute file paths
    """
    # Find all nodes matching the term (case-insensitive)
    matches = [
        (n, d['label']) 
        for n, d in G.nodes(data=True)
        if term.lower() in d.get('label', '').lower()
    ]
    
    if not matches:
        return []
    
    # Take the first match (usually highest-importance node)
    root_id = matches[0][0]
    
    # BFS to find related nodes
    related_ids = list(nx.bfs_tree(G, root_id, depth_limit=depth).nodes())
    
    # Extract source_file paths
    files = sorted(set(
        G.nodes[n]['source_file']
        for n in related_ids
        if 'source_file' in G.nodes[n]
    ))
    
    return files


# Example usage:
# Service files: find_related_files('Possession')
# Related to a controller: find_related_files('DefaultController', depth=3)
# Auth surface: find_related_files('Auth', depth=2)
```

---

## Bash/Grep Fallback (When Python Unavailable)

If you can't run Python, use this grep-based approach on the Obsidian vault:

```bash
# Search community files for source_file entries matching a term
TERM="Possession"
grep -r "source_file" /Users/arunkumar/Documents/Application/obsidian-vault/ps3-portfolio/ \
  | grep -i "$TERM" \
  | awk -F': ' '{print $2}' \
  | sort -u

# Output: absolute paths like /Users/arunkumar/.../PossessionService.php
```

---

## What to Extract from Results

**source_file**
- Absolute path to the PHP file
- Use this directly with the `Read` tool
- Example: `/Users/arunkumar/.../backend/modules/possession/services/PossessionService.php`

**label**
- Human-readable node name (class, function, or file)
- Use to validate that the match is what you expected
- Example: `PossessionService`, `createPossession()`

**community**
- Integer community ID (0–2050)
- Use to explore related modules and understand architectural clustering
- Read the corresponding `_COMMUNITY_<id>.md` file in the Obsidian vault for a summary

---

## God Nodes (Always Relevant)

These are the 5 most-connected nodes in the project — central to all features:

1. **getScenario()** — 238 edges
   - Validation scenario router
   - Every model uses this to determine validation rules
   - Central to form handling and data validation

2. **PossessionService** — 124 edges
   - Core business logic for property possession tracking
   - Called by most controllers and services
   - Key to understanding the main domain flow

3. **DefaultController** — 116 edges
   - Base controller (likely AppController)
   - All controllers extend or depend on this
   - Check here for authentication, access control, common actions

4. **UserService** — 105 edges
   - Authentication and user management
   - Used by nearly every service that needs user context
   - Central to RBAC and permission checks

5. **PossessionReportsService** — 104 edges
   - Reporting and analytics for possession data
   - Aggregates data from possession and related modules

If you're implementing a feature, at least one of these god nodes is likely in your call graph.

---

## When to Query the Graph

| Scenario | Query |
|----------|-------|
| Implementing a new feature | Search by feature domain keyword (e.g., 'Possession', 'Compliance') |
| Reviewing code | Search by changed class name to find all callers |
| Writing tests | Search by class name + filter results to `tests/` paths |
| Security audit | Search by auth/validation terms to map entry points |
| Understanding architecture | BFS from god nodes to understand module dependencies |
| Finding fixtures | Search by test-related class name, look for `_data/` paths |

---

## Graph Structure (Reference)

The `graph.json` uses NetworkX node-link format:

```json
{
  "nodes": [
    {
      "id": "unique_node_id",
      "label": "PossessionService",
      "file_type": "code",
      "source_file": "/absolute/path/to/file.php",
      "source_location": "L42",
      "community": 5
    }
  ],
  "links": [
    {
      "source": "node_a_id",
      "target": "node_b_id",
      "relation": "calls",
      "confidence": "EXTRACTED"
    }
  ]
}
```

Key fields:
- `label` — what the node represents (class/function/file name)
- `source_file` — where to read the actual code
- `source_location` — line number where it's defined
- `relation` — edge type (calls, contains, extends, implements, etc.)

---

## Pro Tips

1. **Start with god nodes** — when lost, read PossessionService or UserService first. They're central to almost everything.

2. **Depth=2 is usually enough** — BFS depth 2 gives you the node + direct neighbors + neighbors-of-neighbors. Higher depths explode the result set.

3. **Filter by source_file patterns** — after querying, filter results to only files matching your context:
   - `backend/modules/` for services/models
   - `backend/tests/` for test files
   - `backend/views/` for templates

4. **Check community assignments** — if you get 50 files, check if they fall into 3–4 communities. Communities are architectural clusters — this tells you which modules are involved.

5. **Verify matches** — the grep fallback might give false positives (e.g., 'Service' in comments). Always check the `source_file` and read it to confirm it's relevant.

---

## Example Workflow

**Scenario: Build a feature for "Compliance Reporting"**

1. **Query:** `find_related_files('Compliance', depth=2)`
   → Returns: `ComplianceService.php`, `ComplianceController.php`, `Compliance.php` (model), test files, etc.

2. **Scan:** Look at source files — what's the module structure? Is it `backend/modules/compliance/`?

3. **Expand if needed:** Read ComplianceService to see what it calls. Query by those class names if not yet visible.

4. **God nodes check:** Does ComplianceService call UserService? Call PossessionService? This tells you the dependency tree.

5. **Now implement:** You have a map of the feature's code. Read top-down from services → controllers → models, not randomly.

This approach replaces 10+ exploratory file reads and Glob patterns with 1–2 graph queries.
