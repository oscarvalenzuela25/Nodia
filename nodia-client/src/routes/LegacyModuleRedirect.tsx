import { Navigate, useLocation, useParams } from "react-router";

/** Redirects have no page/authority of their own: the destination guard decides. */
export default function LegacyModuleRedirect({ destination }: { destination: string }) {
  const { search, hash } = useLocation();
  const { id } = useParams();
  const detail = id === undefined ? "" : `/${encodeURIComponent(id)}`;
  return <Navigate to={`${destination}${detail}${search}${hash}`} replace />;
}
