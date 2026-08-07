import { useEffect, useState } from "react";

import {
    getAgents,
    type AgentSummary,
} from "../services/api";

export function useAgents() {
    const [agents, setAgents] = useState<AgentSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function load() {
            try {
                const result = await getAgents();
                setAgents(result);
            } catch {
                setError(
                    "Unable to load AIOS agents.",
                );
            } finally {
                setLoading(false);
            }
        }

        load();
    }, []);

    return {
        agents,
        loading,
        error,
    };
}