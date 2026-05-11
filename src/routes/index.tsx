import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: () => {
    const { loading, user } = useAuth();
    if (loading) return null;
    return <Navigate to={user ? "/dashboard" : "/login"} />;
  },
});
