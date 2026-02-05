'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, ChevronRight } from 'lucide-react';
import { EndpointDefinition, EndpointGroupMeta } from '@/lib/types';

interface EndpointSelectorProps {
  selectedEndpoint: EndpointDefinition | null;
  onSelect: (endpoint: EndpointDefinition) => void;
}

interface ApiResponse {
  groups: EndpointGroupMeta[];
  endpoints: EndpointDefinition[];
}

export function EndpointSelector({ selectedEndpoint, onSelect }: EndpointSelectorProps) {
  const [groups, setGroups] = useState<EndpointGroupMeta[]>([]);
  const [endpoints, setEndpoints] = useState<EndpointDefinition[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadEndpoints();
  }, []);

  const loadEndpoints = async () => {
    try {
      const res = await fetch('/api/endpoints');
      const data: ApiResponse = await res.json();
      setGroups(data.groups || []);
      setEndpoints(data.endpoints || []);

      // Expand all groups by default for better discoverability
      if (data.groups?.length > 0) {
        setExpandedGroups(new Set(data.groups.map(g => g.id)));
      }
    } catch (err) {
      console.error('[deapi-tester] Failed to load endpoints:', err);
    }
  };

  const filteredEndpoints = useMemo(() => {
    if (!searchQuery.trim()) return endpoints;
    const query = searchQuery.toLowerCase();
    return endpoints.filter(
      e => e.name.toLowerCase().includes(query) ||
           e.id.toLowerCase().includes(query) ||
           e.description?.toLowerCase().includes(query)
    );
  }, [endpoints, searchQuery]);

  const getEndpointsByGroup = (groupId: string) => {
    return filteredEndpoints.filter((e) => e.group === groupId);
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const visibleGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    return groups.filter(g => getEndpointsByGroup(g.id).length > 0);
  }, [groups, searchQuery, filteredEndpoints]);

  return (
    <div className="h-full flex flex-col bg-[var(--surface)]">
      {/* Search */}
      <div className="p-2 border-b border-[var(--border)]">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500 w-3.5 h-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search endpoints..."
            className="w-full pl-7 pr-2 py-1.5 text-xs rounded"
          />
        </div>
      </div>

      {/* Endpoints List */}
      <div className="flex-1 overflow-y-auto">
        {visibleGroups.map((group) => {
          const groupEndpoints = getEndpointsByGroup(group.id);
          const isExpanded = expandedGroups.has(group.id);

          return (
            <div key={group.id}>
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-zinc-800/50 transition-colors"
              >
<ChevronRight className={`w-2.5 h-2.5 text-zinc-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                <span className="text-sm">{group.icon}</span>
                <span className="flex-1 text-xs font-medium text-zinc-400">{group.label}</span>
                <span className="text-[10px] text-zinc-600 font-mono">{groupEndpoints.length}</span>
              </button>

              {isExpanded && groupEndpoints.length > 0 && (
                <div className="pb-1">
                  {groupEndpoints.map((endpoint) => (
                    <button
                      key={endpoint.id}
                      onClick={() => onSelect(endpoint)}
                      className={`w-full flex items-center gap-2 pl-7 pr-2 py-1.5 text-left transition-colors ${
                        selectedEndpoint?.id === endpoint.id
                          ? 'bg-blue-600/10 text-blue-400 border-l-2 border-blue-500'
                          : 'text-zinc-500 hover:bg-zinc-800/30 hover:text-zinc-300 border-l-2 border-transparent'
                      }`}
                    >
                      <span className="flex-1 text-xs truncate">{endpoint.name}</span>
                      {endpoint.isAsync && (
                        <span className="text-[9px] px-1 py-0.5 bg-yellow-500/10 text-yellow-500 rounded">
                          async
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {visibleGroups.length === 0 && searchQuery && (
          <div className="p-4 text-center text-xs text-zinc-600">
            No endpoints found
          </div>
        )}
      </div>
    </div>
  );
}
